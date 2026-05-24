import {
  SUBSCRIPTION_STATUSES,
  TRANSACTION_VERIFICATION_STATUSES,
  type PaymentRequestRecord,
  type PaymentStatus,
  type ReferralLedgerRecord,
  type ReferralLedgerStatus,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from './types.ts';

const DEFAULT_NOW = '2026-05-23T00:00:00.000Z';

export function createSubscriptionFixture(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  const { status = SUBSCRIPTION_STATUSES.none, ...rest } = overrides;
  return {
    id: 'sub_1',
    userId: 'user_1',
    planId: null,
    startsAt: null,
    endsAt: null,
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...rest,
    status: status as SubscriptionStatus,
  };
}

export function createPaymentRequestFixture(overrides: Partial<PaymentRequestRecord> = {}): PaymentRequestRecord {
  return {
    id: 'pay_1',
    userId: 'user_1',
    planId: 'plan_monthly',
    subscriptionId: 'sub_1',
    supportThreadId: null,
    method: 'bank_transfer',
    amountUsd: 199,
    amountKrw: 0,
    exchangeRate: null,
    referralPointsUsed: 0,
    status: 'pending' as PaymentStatus,
    depositorName: 'Tester',
    transactionId: null,
    transactionVerificationStatus: TRANSACTION_VERIFICATION_STATUSES.unchecked,
    transactionVerificationMessage: null,
    transactionVerifiedAt: null,
    adminNote: null,
    confirmedByAdminId: null,
    confirmedAt: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
  };
}

export function createReferralLedgerFixture(overrides: Partial<ReferralLedgerRecord> = {}): ReferralLedgerRecord {
  return {
    id: 'ref_ledger_1',
    referrerUserId: 'user_referrer',
    referredUserId: 'user_referred',
    paymentRequestId: 'pay_1',
    amountUsd: 199,
    percent: 20,
    points: 39.8,
    status: 'pending' as ReferralLedgerStatus,
    confirmAfter: '2026-05-30T00:00:00.000Z',
    confirmedAt: null,
    reversedAt: null,
    createdAt: DEFAULT_NOW,
    ...overrides,
  };
}
