import {
  SUBSCRIPTION_STATUSES,
  USER_ROLES,
  type SubscriptionStatus,
  type UserRole,
} from './types.ts';

export type AccessContext = {
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
};

export function canUseFullChart(context: AccessContext): boolean {
  if (context.role === USER_ROLES.admin || context.role === USER_ROLES.superAdmin) return true;
  if (context.subscriptionStatus === SUBSCRIPTION_STATUSES.trialActive) return true;
  return context.subscriptionStatus === SUBSCRIPTION_STATUSES.active ||
    context.subscriptionStatus === SUBSCRIPTION_STATUSES.expiring;
}

export function canViewPaidSignals(context: AccessContext): boolean {
  if (context.role === USER_ROLES.admin || context.role === USER_ROLES.superAdmin) return true;
  return context.subscriptionStatus === SUBSCRIPTION_STATUSES.trialActive ||
    context.subscriptionStatus === SUBSCRIPTION_STATUSES.active ||
    context.subscriptionStatus === SUBSCRIPTION_STATUSES.expiring;
}

export function canAccessAdmin(context: Pick<AccessContext, 'role'>): boolean {
  return context.role === USER_ROLES.admin || context.role === USER_ROLES.superAdmin;
}

export function canManageAdmins(context: Pick<AccessContext, 'role'>): boolean {
  return context.role === USER_ROLES.superAdmin;
}
