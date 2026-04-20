import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { Api, Dialogs } from 'vuetify-extended';

const STORAGE_KEY = 'bookmame-shop-current-shop-id';

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

  async function switchShop(itemId?: any): Promise<boolean> {
    const targetShopId = normalizeShopId(itemId) ?? localStorage.getItem(STORAGE_KEY);

    try {
      const shops = await accessibleShops();

      if (shops.length === 0) {
        shop.value = null;
        hasInitializedShop.value = true;
        return false;
      }

      let selectedShop = shops[0];
      if (targetShopId) {
        selectedShop = shops.find((item: any) => item.id.toString() === targetShopId) || shops[0];
      }

      shop.value = selectedShop;
      localStorage.setItem(STORAGE_KEY, selectedShop.id.toString());
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
