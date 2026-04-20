import { Api } from 'vuetify-extended';
import { useAppStore } from '../store/app';

type AccessPolicy = {
  strategy: 'allow_all_except' | 'deny_all_except';
  permissions: string[];
};

type RoleAssignment = {
  allowedApps?: string[];
  scopeType?: string | null;
  scopeId?: string | null;
  accessPolicy?: AccessPolicy | null;
};

type CurrentUser = {
  roleAssignments?: RoleAssignment[];
};

export const SHOP_PERMISSION_OPTIONS = [
  { id: 'shop.dashboard.view', name: 'Dashboard' },
  { id: 'shop.profile.view', name: 'Profile' },
  { id: 'shop.catalog.view', name: 'Catalog' },
  { id: 'shop.orders.view', name: 'Orders' },
  { id: 'shop.finance.view', name: 'Finance' },
];

function currentUser(): CurrentUser | null {
  return (Api.instance.userRef?.value as { user?: CurrentUser | null } | null)?.user ?? null;
}

function accessPolicyAllows(policy: AccessPolicy | null | undefined, permissionCode: string) {
  if (!policy) {
    return true;
  }

  const permissions = Array.isArray(policy.permissions) ? policy.permissions : [];
  if (policy.strategy === 'allow_all_except') {
    return !permissions.includes(permissionCode);
  }

  return permissions.includes(permissionCode);
}

export async function shopHasAccess(permissionCode?: string) {
  if (!permissionCode) {
    return true;
  }

  const shopId = useAppStore().shop?.id?.toString?.();
  const user = currentUser();
  const assignments = Array.isArray(user?.roleAssignments) ? user.roleAssignments : [];
  const shopAssignments = assignments.filter((assignment) =>
    Array.isArray(assignment.allowedApps) &&
    assignment.allowedApps.includes('bookmame-shop') &&
    assignment.scopeType === 'shop' &&
    (!shopId || assignment.scopeId === shopId),
  );

  if (shopAssignments.length === 0) {
    return false;
  }

  return shopAssignments.some((assignment) => accessPolicyAllows(assignment.accessPolicy, permissionCode));
}

export function shopAccess(permissionCode?: string) {
  return async () => shopHasAccess(permissionCode);
}
