import {
  SUBSCRIPTION_STATUSES,
  type SubscriptionRecord,
} from './types.ts';

function addDays(isoDate: string, days: number): string {
  const next = new Date(isoDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export function approveSubscription(
  subscription: SubscriptionRecord,
  input: { adminId: string; approvedAt: string; durationDays: number },
): SubscriptionRecord {
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.paymentPending &&
    subscription.status !== SUBSCRIPTION_STATUSES.paymentRequested
  ) {
    throw new Error(`Cannot approve subscription from status ${subscription.status}`);
  }
  if (input.durationDays <= 0) {
    throw new Error('Subscription duration must be greater than zero');
  }
  return {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.active,
    startsAt: input.approvedAt,
    endsAt: addDays(input.approvedAt, input.durationDays),
    approvedByAdminId: input.adminId,
    approvedAt: input.approvedAt,
    updatedAt: input.approvedAt,
  };
}

export function cancelSubscription(
  subscription: SubscriptionRecord,
  input: { adminId: string; cancelledAt: string },
): SubscriptionRecord {
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.active &&
    subscription.status !== SUBSCRIPTION_STATUSES.expiring &&
    subscription.status !== SUBSCRIPTION_STATUSES.cancelRequested
  ) {
    throw new Error(`Cannot cancel subscription from status ${subscription.status}`);
  }
  return {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.cancelled,
    cancelledAt: input.cancelledAt,
    updatedAt: input.cancelledAt,
  };
}

export function refundSubscription(
  subscription: SubscriptionRecord,
  input: { adminId: string; refundedAt: string },
): SubscriptionRecord {
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.active &&
    subscription.status !== SUBSCRIPTION_STATUSES.expiring &&
    subscription.status !== SUBSCRIPTION_STATUSES.paymentRequested &&
    subscription.status !== SUBSCRIPTION_STATUSES.refundRequested
  ) {
    throw new Error(`Cannot refund subscription from status ${subscription.status}`);
  }
  return {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.refunded,
    refundedAt: input.refundedAt,
    updatedAt: input.refundedAt,
  };
}
