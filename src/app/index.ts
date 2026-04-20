import {
  AccessDeniedScreen,
  Api,
  AppMain,
  AppManager,
  AppTitleBlock,
  EnvironmentTag,
  MailboxBell,
  ShellIconAction,
  UserArea,
  $BN,
} from 'vuetify-extended';
import { buildHomeMenu } from './menu';
import { createShopSwitchSelector } from './shop-switch';
import { useAppStore } from '../store/app';

export function createMainApp() {
  return new AppMain(
    {
      ref: 'bookmame-shop',
      title: import.meta.env.VITE_APP_TITLE,
      mobileTitle: import.meta.env.VITE_APP_TITLE,
      mobileLogo: '/favicon.png',
      showHeader: true,
      showFooter: true,
      headerLayout: 'auto',
      footerLayout: 'auto',
      backgroundColor: '#f2f5ef',
      backgroundGradient: 'linear-gradient(160deg, rgba(251,254,248,0.95) 0%, rgba(237,246,232,0.90) 52%, rgba(211,228,198,0.95) 100%)',
      backgroundOverlay: 'linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(246,250,242,0.90) 100%)',
    },
    {
      menu: async () => buildHomeMenu(),
      udfs: async () => [],
      headerStart: (app) => [
        new AppTitleBlock({
          title: app.$params.title || 'Bookmame Shop',
          subtitle: `Merchant workspace for ${import.meta.env.VITE_APP_NAME || 'Bookmame'}`,
          icon: 'mdi-storefront-outline',
          image: '/favicon.png',
          color: '#2f6b2f',
          hideOnMobile: true,
        }),
      ],
      headerCenter: () => {
        const appStore = useAppStore();
        return [
          new EnvironmentTag({
            text: appStore.shop?.name || 'No shop selected',
            color: 'success',
            hideOnMobile: true,
          }),
        ];
      },
      headerEnd: () => [
        new ShellIconAction({
          icon: 'mdi-home-switch',
          color: 'success',
          mobileLocation: 'header',
        }, {
          onClicked: async () => {
            const selector = await createShopSwitchSelector();
            AppManager.showSelector(selector);
          },
        }),
        new MailboxBell({
          color: 'success',
          badgeColor: 'error',
          title: 'Open Shop Mailbox',
          viewWidth: 980,
          mobileLocation: 'header',
        }),
        new UserArea({
          name: Api.instance.userRef?.value?.user?.displayName || 'Anonymous',
          email: Api.instance.userRef?.value?.user?.email || '',
          accountId: Api.instance.userRef?.value?.user?.accountId,
          avatarColor: 'success',
          mobileLocation: 'header',
        }, {
          buttons() {
            return [
              { label: 'Session', type: 'separator' },
              $BN({ text: 'Logout', icon: 'mdi-lock' }, {
                onClicked() {
                  Api.instance.logout!();
                },
              }),
            ];
          },
        }),
      ],
      footerStart: () => {
        const appStore = useAppStore();
        return [
          new EnvironmentTag({
            text: appStore.shop?.name || 'No shop selected',
            color: 'success',
            hideOnNonMobile: true,
          }),
        ];
      },
      footerEnd: () => [
        new EnvironmentTag({
          text: 'Copyright 2026 Hawkedin Limited',
          color: 'success',
          variant: 'outlined',
        }),
      ],
    },
  );
}

export function createPlainScreen() {
  return new AppMain({
    ref: 'bookmame-shop',
    title: import.meta.env.VITE_APP_TITLE,
    backgroundColor: '#f2f5ef',
    backgroundGradient: 'linear-gradient(160deg, rgba(251,254,248,0.95) 0%, rgba(237,246,232,0.90) 52%, rgba(211,228,198,0.95) 100%)',
  });
}

export function createAccessDeniedScreen() {
  return new AccessDeniedScreen({
    title: 'Application Access Required',
    subtitle: 'Authorization Needed',
    message: 'Access to this app is granted when your account is assigned as a shop super user or receives an active scoped role for a shop workspace.',
    backgroundGradient: 'radial-gradient(circle at top, rgba(74,222,128,0.18), transparent 44%), linear-gradient(160deg, #153b1b 0%, #245528 52%, #2f6b2f 100%)',
    actionText: 'Logout',
  }, {
    action() {
      Api.instance.logout!();
    },
  });
}
