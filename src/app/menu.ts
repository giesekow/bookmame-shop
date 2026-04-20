import { $MI, AppManager, Menu } from 'vuetify-extended';
import { shopAccess } from '../misc/access';
import { SHOP_DASHBOARD_WIDGET } from '../pages/dashboard';
import { shopCategoriesMenu } from '../pages/categories';
import { shopCatalogMenu } from '../pages/catalog';
import { shopFinanceSummaryReport } from '../pages/finance-summary';
import { shopOrdersCollection } from '../pages/orders';
import { shopProfileReport } from '../pages/profile';

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
          action: 'function',
          color: 'info',
        }, {
          callback: async () => {
            AppManager.showCollection(shopOrdersCollection());
          },
          access: shopAccess('shop.orders.view'),
        }),
        $MI({
          text: 'Finance',
          icon: 'mdi-currency-usd',
          shortcut: 'F',
          action: 'report',
          mode: 'display',
          color: 'secondary',
        }, {
          report: shopFinanceSummaryReport,
          access: shopAccess('shop.finance.view'),
        }),
        $MI({
          text: 'Profile',
          icon: 'mdi-store-cog-outline',
          shortcut: 'P',
          action: 'report',
          mode: 'display',
          color: 'warning',
        }, {
          report: shopProfileReport,
          access: shopAccess('shop.profile.view'),
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
    ],
  },
);
