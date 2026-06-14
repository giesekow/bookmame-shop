import { AppManager } from 'vuetify-extended';
import { shopOrdersCollection, shopOrdersReport } from '../pages/orders';
import { shopFinanceSummaryReport } from '../pages/finance-summary';
import { shopRatingsCollection } from '../pages/ratings';
import { supportCasesCollection } from '../pages/support-cases';

export type PartnerLaunchTarget = {
  target: string;
  targetId?: string | null;
  targetAction?: string | null;
  sourceNotificationId?: string | null;
  tenantId?: string | null;
  source?: string | null;
  returnUrl?: string | null;
};

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parsePartnerLaunchTarget(): PartnerLaunchTarget {
  const url = new URL(window.location.href);
  return {
    target: normalize(url.searchParams.get('target')),
    targetId: normalizeId(url.searchParams.get('targetId')),
    targetAction: normalizeId(url.searchParams.get('targetAction')),
    sourceNotificationId: normalizeId(url.searchParams.get('sourceNotificationId')),
    tenantId: normalizeId(url.searchParams.get('tenantId')),
    source: normalizeId(url.searchParams.get('source')),
    returnUrl: normalizeId(url.searchParams.get('returnUrl')),
  };
}

export function readPartnerLaunchTarget(): PartnerLaunchTarget | null {
  const parsed = parsePartnerLaunchTarget();
  const target = normalize(parsed.target);

  if (!target) {
    return null;
  }

  return {
    ...parsed,
    target,
  };
}

function isAllowedPartnerReturnUrl(value: string | null) {
  if (!value) {
    return false;
  }

  if (value.startsWith('com.bookmame.partner.app://auth/')) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'partner.bookmame.com' || url.hostname === 'partner.dev.bookmame.com');
  } catch (_error) {
    return false;
  }
}

export function readPartnerPortalReturnUrl(): string | null {
  const parsed = parsePartnerLaunchTarget();
  if (parsed.source !== 'partner-wrapper') {
    return null;
  }

  return isAllowedPartnerReturnUrl(parsed.returnUrl ?? null) ? parsed.returnUrl ?? null : null;
}

export function hasPartnerPortalReturnTarget(): boolean {
  return Boolean(readPartnerPortalReturnUrl());
}

export function returnToPartnerPortal(): boolean {
  const returnUrl = readPartnerPortalReturnUrl();
  if (!returnUrl) {
    return false;
  }

  window.location.assign(returnUrl);
  return true;
}

export function openPartnerLaunchTarget(target: PartnerLaunchTarget): boolean {
  switch (normalize(target.target)) {
    case 'dashboard':
    case 'home':
      return true;
    case 'orders':
      target.targetId ? AppManager.showReport(shopOrdersReport(target.targetId)()) : AppManager.showCollection(shopOrdersCollection()());
      return true;
    case 'order':
      target.targetId ? AppManager.showReport(shopOrdersReport(target.targetId)()) : AppManager.showCollection(shopOrdersCollection()());
      return true;
    case 'pending-orders':
      AppManager.showCollection(shopOrdersCollection({
        orderStatus: {
          $in: ['placed', 'accepted', 'ready_for_pickup'],
        },
      })());
      return true;
    case 'finance':
      AppManager.showReport(shopFinanceSummaryReport());
      return true;
    case 'ratings':
      AppManager.showCollection(shopRatingsCollection());
      return true;
    case 'support':
      AppManager.showCollection(supportCasesCollection());
      return true;
    default:
      return false;
  }
}
