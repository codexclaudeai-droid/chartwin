import {
  PAYMENT_STATUSES,
  type PaymentRequestRecord,
} from './types.ts';

export function confirmPaymentRequest(
  payment: PaymentRequestRecord,
  input: { adminId: string; confirmedAt: string; adminNote?: string },
): PaymentRequestRecord {
  if (payment.status !== PAYMENT_STATUSES.pending && payment.status !== PAYMENT_STATUSES.requested) {
    throw new Error(`Cannot confirm payment from status ${payment.status}`);
  }
  return {
    ...payment,
    status: PAYMENT_STATUSES.confirmed,
    confirmedByAdminId: input.adminId,
    confirmedAt: input.confirmedAt,
    adminNote: input.adminNote ?? payment.adminNote,
    updatedAt: input.confirmedAt,
  };
}

export function rejectPaymentRequest(
  payment: PaymentRequestRecord,
  input: { adminId: string; rejectedAt: string; adminNote: string },
): PaymentRequestRecord {
  if (payment.status !== PAYMENT_STATUSES.pending && payment.status !== PAYMENT_STATUSES.requested) {
    throw new Error(`Cannot reject payment from status ${payment.status}`);
  }
  return {
    ...payment,
    status: PAYMENT_STATUSES.rejected,
    adminNote: input.adminNote,
    updatedAt: input.rejectedAt,
  };
}

export function refundPaymentRequest(
  payment: PaymentRequestRecord,
  input: { adminId: string; refundedAt: string; adminNote: string },
): PaymentRequestRecord {
  if (payment.status !== PAYMENT_STATUSES.confirmed) {
    throw new Error(`Cannot refund payment from status ${payment.status}`);
  }
  return {
    ...payment,
    status: PAYMENT_STATUSES.refunded,
    adminNote: input.adminNote,
    updatedAt: input.refundedAt,
  };
}
