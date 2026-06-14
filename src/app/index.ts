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
import { hasPartnerPortalReturnTarget, returnToPartnerPortal } from '../misc/partner-launch-target';
import { resolveThemeMode, saveThemeMode } from '../misc/theme-mode';

type ThemeMode = 'light' | 'dark';

const lightShell = {
  backgroundColor: '#f2f5ef',
  backgroundGradient: 'linear-gradient(160deg, rgba(251,254,248,0.95) 0%, rgba(237,246,232,0.90) 52%, rgba(211,228,198,0.95) 100%)',
  backgroundOverlay: 'linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(246,250,242,0.90) 100%)',
};

const darkShell = {
  backgroundColor: '#11171d',
  backgroundGradient: 'radial-gradient(circle at top left, rgba(232,122,63,0.18), transparent 30%), radial-gradient(circle at 85% 15%, rgba(242,195,91,0.14), transparent 24%), radial-gradient(circle at bottom right, rgba(45,143,122,0.16), transparent 26%), linear-gradient(180deg, #1a2027 0%, #151b22 46%, #11171d 100%)',
  backgroundOverlay: 'linear-gradient(180deg, rgba(17,23,29,0.40) 0%, rgba(17,23,29,0.62) 100%)',
};

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
      ...lightShell,
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
            const currentMode = resolveThemeMode(Api.instance.userRef?.value ?? null);
            const nextMode = currentMode === 'dark' ? 'light' : 'dark';
            return [
              $BN({ text: `Theme: ${currentMode === 'dark' ? 'Dark' : 'Light'} (Switch to ${nextMode === 'dark' ? 'Dark' : 'Light'})`, icon: currentMode === 'dark' ? 'mdi-weather-night' : 'mdi-white-balance-sunny' }, {
                onClicked() {
                  saveThemeMode(nextMode);
                  window.dispatchEvent(new CustomEvent('bookmame-theme-mode-changed'));
                },
              }),
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
          ...(hasPartnerPortalReturnTarget()
            ? [
              new EnvironmentTag({
                text: 'Back to Portal',
                color: 'success',
                variant: 'outlined',
                hideOnMobile: true,
              }, {
                onClicked() {
                  returnToPartnerPortal();
                },
              }),
            ]
            : []),
          new EnvironmentTag({
            text: appStore.shop?.name || 'No shop selected',
            color: 'success',
            hideOnNonMobile: true,
          }),
        ];
      },
      footerEnd: () => [
        ...(hasPartnerPortalReturnTarget()
          ? [
            new EnvironmentTag({
              text: 'Back to Portal',
              color: 'success',
              variant: 'outlined',
              hideOnNonMobile: true,
            }, {
              onClicked() {
                returnToPartnerPortal();
              },
            }),
          ]
          : []),
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
    ...lightShell,
  });
}

export function applyShellThemeMode(
  app: AppMain,
  plainScreen: AppMain,
  mode: ThemeMode,
) {
  const shell = mode === 'dark' ? darkShell : lightShell;
  Object.assign(app.$params, shell);
  Object.assign(plainScreen.$params, shell);
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
