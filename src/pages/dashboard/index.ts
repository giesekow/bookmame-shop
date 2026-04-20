import { $DB, $DMW, $MI } from 'vuetify-extended';
import { useAppStore } from '../../store/app';

function currentShop() {
  return useAppStore().shop || null;
}

function countCountries(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export const SHOP_DASHBOARD_WIDGET = $DB({
  title: 'Dashboard',
  subtitle: 'Workspace readiness, current merchant profile, and the first shop operations scaffold.',
  fluid: true,
  theme: 'light',
  backgroundColor: '#f7fbf5',
  backgroundGradient: 'linear-gradient(180deg, rgba(251,255,249,0.98) 0%, rgba(239,247,234,0.94) 100%)',
  textColor: '#183022',
}, {
  menuItems: () => [
    $MI({
      text: 'Refresh',
      icon: 'mdi-refresh',
      action: 'function',
      color: 'primary',
    }, {
      callback: async () => {
        await useAppStore().switchShop(currentShop()?.id);
        await SHOP_DASHBOARD_WIDGET.refresh();
      },
    }),
  ],
  topChildren: () => [
    $DMW({
      title: 'Selected Shop',
      subtitle: 'The merchant workspace currently active in this session.',
      icon: 'mdi-storefront-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => currentShop()?.name || 'No shop selected',
    }),
    $DMW({
      title: 'Operational Status',
      subtitle: 'The current lifecycle status configured on the shop record.',
      icon: 'mdi-signal-cellular-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => currentShop()?.status || 'unknown',
    }),
    $DMW({
      title: 'Approval Status',
      subtitle: 'Whether the merchant record is ready for production use.',
      icon: 'mdi-check-decagram-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => currentShop()?.approvalStatus || 'pending',
    }),
    $DMW({
      title: 'Countries',
      subtitle: 'Number of operating countries already configured on the shop.',
      icon: 'mdi-earth',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => countCountries(currentShop()?.countryOfOperationCodes),
    }),
  ],
  bottomChildren: () => [
    $DMW({
      title: 'Scaffold Status',
      subtitle: 'The app shell, shop switching, and access-aware workspace are now in place.',
      icon: 'mdi-hammer-wrench',
      cols: 12,
      md: 12,
      lg: 6,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => 'Ready for catalog, order, and finance slices',
    }),
    $DMW({
      title: 'Next Recommended Slice',
      subtitle: 'The most natural next step is product catalog CRUD plus merchant-side order handling.',
      icon: 'mdi-arrow-right-circle-outline',
      cols: 12,
      md: 12,
      lg: 6,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => 'Catalog + Orders MVP',
    }),
  ],
});
