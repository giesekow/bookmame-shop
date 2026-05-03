import { $SL, AppManager, Dialogs } from 'vuetify-extended';
import { useAppStore } from '../store/app';

export const createShopSwitchSelector = async () => {
  const selector = $SL({
    title: 'Switch Shop',
    width: 500,
  }, {
    async selected(item, currentSelector) {
      const appStore = useAppStore();
      Dialogs.$showProgress({});
      const switched = await appStore.switchShop(item);
      Dialogs.$hideProgress();

      if (switched) {
        currentSelector.forceCancel();
        AppManager.reload();
        location.reload()
      }
    },
    load: async () => {
      const appStore = useAppStore();
      return appStore.accessibleShops();
    },
  });

  return selector;
};
