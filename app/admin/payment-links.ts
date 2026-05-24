export function getAdminPaymentDomId(paymentId: string): string {
  return `admin-payment-${paymentId}`;
}

export function createAdminPaymentUrl(paymentId: string): string {
  return `/admin#admin-payment-${encodeURIComponent(paymentId)}`;
}
