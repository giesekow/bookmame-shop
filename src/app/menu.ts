import { $MI, AppManager, Menu } from 'vuetify-extended';
import { shopAccess, shopHasAccess } from '../misc/access';
import { openProductCatalogDialog } from '../misc/product-catalog';
import { SHOP_DASHBOARD_WIDGET } from '../pages/dashboard';
import { shopCategoriesMenu } from '../pages/categories';
import { shopCatalogMenu } from '../pages/catalog';
import { shopDeliveryPartnersMenu } from '../pages/delivery-partners';
import { shopFinanceSummaryReport } from '../pages/finance-summary';
import { shopNotificationPreferencesReport } from '../pages/notification-preferences';
import { shopDeliverySettingsReport } from '../pages/delivery-settings';
import { shopOrdersCollection } from '../pages/orders';
import { shopRatingsCollection } from '../pages/ratings';
import { shopProfileReport } from '../pages/profile';
import { supportCasesCollection } from '../pages/support-cases';
import { shopStaffMenu } from '../pages/staff';
import { shopCancellationRefundsCollection } from '../pages/cancellation-refunds';
import { shopRemittanceBatchesCollection, shopSettlementBatchesCollection } from '../pages/settlement-batches';
import { shopRemittanceHistoryCollection, shopSettlementHistoryCollection } from '../pages/settlement-history';

export function buildHomeMenu() {
  return new Menu(
    {
      title: 'Shop Workspace',
      cols: 12,
      width: 320,
    },
    {
      children: async () => [
        $MI({
          text: 'Dashboard',
          icon: 'mdi-view-dashboard-outline',
          shortcut: 'D',
          action: 'function',
          color: 'success',
        }, {
          callback: async () => {
            AppManager.showUI(SHOP_DASHBOARD_WIDGET);
          },
          access: shopAccess('shop.dashboard.view'),
        }),
        $MI({
          text: 'Catalog',
          icon: 'mdi-package-variant-closed',
          shortcut: 'C',
          action: 'menu',
          color: 'primary',
        }, {
          menu: buildCatalogMenu,
          access: shopAccess('shop.catalog.view'),
        }),
        $MI({
          text: 'Orders',
          icon: 'mdi-cart-outline',
          shortcut: 'O',
          action: 'collection',
          mode: 'display',
          color: 'info',
        }, {
          collection: shopOrdersCollection(),
          access: shopAccess('shop.orders.view'),
        }),
        $MI({
          text: 'Ratings',
          icon: 'mdi-star-circle-outline',
          shortcut: 'R',
          action: 'collection',
          mode: 'display',
          color: 'info',
        }, {
          collection: shopRatingsCollection,
          access: shopAccess('shop.orders.view'),
        }),
        $MI({
          text: 'Support Cases',
          icon: 'mdi-lifebuoy',
          shortcut: 'U',
          action: 'collection',
          mode: 'display',
          color: 'warning',
        }, {
          collection: supportCasesCollection,
          access: shopAccess('shop.support_cases.view'),
        }),
        $MI({
          text: 'Finance',
          icon: 'mdi-currency-usd',
          shortcut: 'F',
          action: 'menu',
          color: 'secondary',
        }, {
          menu: buildFinanceMenu,
          access: shopAccess('shop.finance.view'),
        }),
        $MI({
          text: 'Settings',
          icon: 'mdi-cog-outline',
          shortcut: 'S',
          action: 'menu',
          color: 'warning',
        }, {
          menu: buildSettingsMenu,
          access: async () =>
            (await shopHasAccess('shop.profile.view')) ||
            (await shopHasAccess('shop.staff.manage')) ||
            (await shopHasAccess('shop.notifications.view')),
        }),
      ],
    },
  );
}

const buildCatalogMenu = () => new Menu(
  {
    title: 'Catalog',
    cols: 12,
    width: 320,
  },
  {
    children: async () => [
      $MI({
        text: 'Stock Item',
        icon: 'mdi-package-variant-closed',
        shortcut: 'I',
        action: 'menu',
        color: 'primary',
      }, {
        menu: shopCatalogMenu,
        access: shopAccess('shop.catalog.view'),
      }),
      $MI({
        text: 'Stock Category',
        icon: 'mdi-shape-outline',
        shortcut: 'G',
        action: 'menu',
        color: 'secondary',
      }, {
        menu: shopCategoriesMenu,
        access: shopAccess('shop.catalog.view'),
      }),
      $MI({
        text: 'Print Product Catalog',
        icon: 'mdi-printer-outline',
        shortcut: 'P',
        action: 'function',
        color: 'error',
      }, {
        callback: async () => { openProductCatalogDialog() },
        access: shopAccess('shop.catalog.view'),
      }),
    ],
  },
);

const buildFinanceMenu = () => new Menu(
  {
    title: 'Finance',
    cols: 12,
    width: 320,
  },
  {
    children: async () => [
      $MI({
        text: 'Finance Summary',
        icon: 'mdi-cash-register',
        shortcut: 'F',
        action: 'report',
        mode: 'display',
        color: 'primary',
      }, {
        report: shopFinanceSummaryReport,
        access: shopAccess('shop.finance.view'),
      }),
      $MI({
        text: 'Settlement Batches',
        icon: 'mdi-cash-sync',
        shortcut: 'B',
        action: 'collection',
        mode: 'display',
        color: 'warning',
      }, {
        collection: shopSettlementBatchesCollection,
        access: shopAccess('shop.finance.view'),
      }),
      $MI({
        text: 'Remittance Batches',
        icon: 'mdi-cash-refund',
        shortcut: 'R',
        action: 'collection',
        mode: 'display',
        color: 'info',
      }, {
        collection: shopRemittanceBatchesCollection,
        access: shopAccess('shop.finance.view'),
      }),
      $MI({
        text: 'Remittance History',
        icon: 'mdi-history',
        shortcut: 'Y',
        action: 'collection',
        mode: 'display',
        color: 'secondary',
      }, {
        collection: shopRemittanceHistoryCollection,
        access: shopAccess('shop.finance.view'),
      }),
      $MI({
        text: 'Settlement History',
        icon: 'mdi-bank-transfer',
        shortcut: 'T',
        action: 'collection',
        mode: 'display',
        color: 'secondary',
      }, {
        collection: shopSettlementHistoryCollection,
        access: shopAccess('shop.finance.view'),
      }),
      $MI({
        text: 'Cancellation Refunds',
        icon: 'mdi-cash-remove',
        shortcut: 'C',
        action: 'collection',
        mode: 'display',
        color: 'error',
      }, {
        collection: shopCancellationRefundsCollection,
        access: shopAccess('shop.finance.view'),
      }),
    ],
  },
);

const buildSettingsMenu = () => new Menu(
  {
    title: 'Settings',
    cols: 12,
    width: 320,
  },
  {
    children: async () => [
      $MI({
        text: 'Profile',
        icon: 'mdi-store-cog-outline',
        shortcut: 'P',
        action: 'report',
        mode: 'display',
        color: 'primary',
      }, {
        report: shopProfileReport,
        access: shopAccess('shop.profile.view'),
      }),
      $MI({
        text: 'Delivery Partners',
        icon: 'mdi-truck-fast-outline',
        shortcut: 'D',
        action: 'menu',
        color: 'success',
      }, {
        menu: shopDeliveryPartnersMenu,
        access: shopAccess('shop.delivery_partners.manage'),
      }),
      $MI({
        text: 'Delivery Settings',
        icon: 'mdi-truck-check-outline',
        shortcut: 'V',
        action: 'report',
        mode: 'display',
        color: 'primary',
      }, {
        report: shopDeliverySettingsReport,
        access: shopAccess('shop.delivery_partners.manage'),
      }),
      $MI({
        text: 'Staff',
        icon: 'mdi-account-group-outline',
        shortcut: 'S',
        action: 'menu',
        color: 'warning',
      }, {
        menu: shopStaffMenu,
        access: shopAccess('shop.staff.manage'),
      }),
      $MI({
        text: 'Notifications',
        icon: 'mdi-bell-ring-outline',
        shortcut: 'N',
        action: 'report',
        mode: 'display',
        color: 'secondary',
      }, {
        report: shopNotificationPreferencesReport,
        access: shopAccess('shop.notifications.view'),
      }),
    ],
  },
);
