export function createProfilePaymentLink(paymentId: string): string {
  return `/profile#payment-${encodeURIComponent(paymentId)}`;
}

export function createSupportThreadLink(threadId: string): string {
  const encodedThreadId = encodeURIComponent(threadId);
  return `/support?thread=${encodedThreadId}#support-${encodedThreadId}`;
}
