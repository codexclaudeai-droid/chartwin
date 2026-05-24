const ADMIN_SUBSCRIPTION_QUEUE_STATUSES = new Set([
  'payment_pending',
  'payment_requested',
  'cancel_requested',
  'refund_requested',
]);

export function getAdminSubscriptionDomId(subscriptionId: string): string {
  return `admin-subscription-${subscriptionId}`;
}

export function createAdminSubscriptionUrl(subscriptionId: string): string {
  return `/admin#admin-subscription-${encodeURIComponent(subscriptionId)}`;
}

export function isAdminSubscriptionQueueStatus(status: string): boolean {
  return ADMIN_SUBSCRIPTION_QUEUE_STATUSES.has(status);
}
