import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { Api, AppManager, Collection, Dialogs, Report } from 'vuetify-extended';
import { updateShopOrderView } from '../pages/orders';

const STORAGE_KEY = 'bookmame-shop-current-shop-id';
const ORDER_CHANNEL = 'shop.orders';
const SOCKET_LISTENER_REF = Symbol('bookmame-shop-order-realtime');

let activeRealtimeShopId: string | null = null;
let activeRealtimeServicePath: string | null = null;
let socketListenerBound = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRealtimeRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(async () => {
    refreshTimer = null;
    const currentView = AppManager.$app?.activeItemRef.value;
    if (!currentView) {
      return;
    }

    if (currentView.type === 'collection' && currentView.item instanceof Collection) {
      const coll = currentView.item;
      if (coll.$currentReport?.$get('isShopOrderView', false)) {
        await updateShopOrderView(coll.$currentReport.$master);
        coll.$currentReport.forceRender();
      }
    }

    if (currentView.type === 'report' && currentView.item instanceof Report) {
      const currentReport = currentView.item;
      if (currentReport.$get('isShopOrderView', false)) {
        await updateShopOrderView(currentReport.$master);
        currentReport.forceRender();
      }
    }
  }, 250);
}

function bindOrderRealtimeService(servicePath: string) {
  if (activeRealtimeServicePath === servicePath) {
    return;
  }

  if (activeRealtimeServicePath) {
    const previousService = Api.instance.service(activeRealtimeServicePath) as any;
    previousService.removeListener('created', scheduleRealtimeRefresh);
    previousService.removeListener('patched', scheduleRealtimeRefresh);
    previousService.removeListener('removed', scheduleRealtimeRefresh);
  }

  const nextService = Api.instance.service(servicePath) as any;
  nextService.on('created', scheduleRealtimeRefresh);
  nextService.on('patched', scheduleRealtimeRefresh);
  nextService.on('removed', scheduleRealtimeRefresh);
  activeRealtimeServicePath = servicePath;
}

function leaveOrderRoom(shopId: string | null) {
  if (!shopId) {
    return;
  }

  Api.instance.emitSocket?.('channel.leave', {
    channel: ORDER_CHANNEL,
    shopId,
  });
}

function joinOrderRoom(shopId: string) {
  Api.instance.emitSocket?.('channel.join', {
    channel: ORDER_CHANNEL,
    shopId,
  });
}

function ensureSocketReconnectBinding(getActiveShopId: () => string | null) {
  if (socketListenerBound) {
    return;
  }

  (Api.instance as any).on?.(
    'socket:connect',
    () => {
      const shopId = getActiveShopId();
      if (shopId) {
        joinOrderRoom(shopId);
      }
    },
    SOCKET_LISTENER_REF,
  );

  socketListenerBound = true;
}

export const useAppStore = defineStore('app', () => {
  const shop: Ref<any | null> = ref(null);
  const hasInitializedShop = ref(false);

  function normalizeShopId(item: any): string | null {
    if (!item) {
      return null;
    }

    if (typeof item === 'object' && item.id) {
      return item.id.toString();
    }

    return item.toString();
  }

  async function accessibleShops() {
    try {
      const shops: any[] = await Api.instance.service('me').get('shops', {
        query: { $paginate: false },
      });
      return shops;
    } catch (error: any) {
      Dialogs.$error(error?.message || 'Failed to load accessible shops.');
      return [];
    }
  }

  function syncShopRealtime(nextShopId: string | null) {
    ensureSocketReconnectBinding(() => normalizeShopId(shop.value));

    if (activeRealtimeShopId && activeRealtimeShopId !== nextShopId) {
      leaveOrderRoom(activeRealtimeShopId);
    }

    if (!nextShopId) {
      if (activeRealtimeServicePath) {
        const previousService = Api.instance.service(activeRealtimeServicePath) as any;
        previousService.removeListener('created', scheduleRealtimeRefresh);
        previousService.removeListener('patched', scheduleRealtimeRefresh);
        previousService.removeListener('removed', scheduleRealtimeRefresh);
      }

      activeRealtimeShopId = null;
      activeRealtimeServicePath = null;
      return;
    }

    bindOrderRealtimeService(`shops/${nextShopId}/orders`);
    joinOrderRoom(nextShopId);
    activeRealtimeShopId = nextShopId;
  }

  async function switchShop(itemId?: any): Promise<boolean> {
    const targetShopId = normalizeShopId(itemId) ?? localStorage.getItem(STORAGE_KEY);

    try {
      const shops = await accessibleShops();

      if (shops.length === 0) {
        shop.value = null;
        syncShopRealtime(null);
        hasInitializedShop.value = true;
        return false;
      }

      let selectedShop = shops[0];
      if (targetShopId) {
        selectedShop = shops.find((item: any) => item.id.toString() === targetShopId) || shops[0];
      }

      shop.value = selectedShop;
      const shopId = selectedShop.id.toString();
      localStorage.setItem(STORAGE_KEY, shopId);
      syncShopRealtime(shopId);
      hasInitializedShop.value = true;
      return true;
    } catch (error: any) {
      Dialogs.$error(error?.message || 'Failed to load accessible shops.');
      return false;
    }
  }

  async function initializeShop() {
    if (hasInitializedShop.value) {
      return Boolean(shop.value);
    }

    return switchShop();
  }

  async function logout() {
    shop.value = null;
    syncShopRealtime(null);
    hasInitializedShop.value = false;
  }

  return {
    shop,
    hasInitializedShop,
    accessibleShops,
    switchShop,
    initializeShop,
    logout,
  };
});
