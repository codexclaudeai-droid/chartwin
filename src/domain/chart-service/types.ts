export const USER_ROLES = {
  guest: 'guest',
  member: 'member',
  trial: 'trial',
  subscriber: 'subscriber',
  salesperson: 'salesperson',
  admin: 'admin',
  superAdmin: 'super_admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_ACCOUNT_STATUSES = {
  active: 'active',
  suspended: 'suspended',
} as const;

export type UserAccountStatus = typeof USER_ACCOUNT_STATUSES[keyof typeof USER_ACCOUNT_STATUSES];

export const SUBSCRIPTION_STATUSES = {
  none: 'none',
  trialRequested: 'trial_requested',
  trialActive: 'trial_active',
  trialExpired: 'trial_expired',
  paymentRequested: 'payment_requested',
  paymentPending: 'payment_pending',
  active: 'active',
  expiring: 'expiring',
  expired: 'expired',
  cancelRequested: 'cancel_requested',
  cancelled: 'cancelled',
  refundRequested: 'refund_requested',
  refunded: 'refunded',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[keyof typeof SUBSCRIPTION_STATUSES];

export const PAYMENT_STATUSES = {
  requested: 'requested',
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

export const REFERRAL_LEDGER_STATUSES = {
  pending: 'pending',
  confirmed: 'confirmed',
  reversed: 'reversed',
} as const;

export type ReferralLedgerStatus = typeof REFERRAL_LEDGER_STATUSES[keyof typeof REFERRAL_LEDGER_STATUSES];

export type Actor = {
  id: string;
  role: UserRole;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  durationDays: number;
  basePriceUsd: number;
  discountPercent: number;
  isActive: boolean;
};

export type SubscriptionRecord = {
  id: string;
  userId: string;
  planId: string | null;
  status: SubscriptionStatus;
  startsAt: string | null;
  endsAt: string | null;
  approvedByAdminId: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentRequestRecord = {
  id: string;
  userId: string;
  planId: string;
  subscriptionId: string;
  method: 'bank_transfer' | 'usdt';
  amountUsd: number;
  amountKrw: number | null;
  exchangeRate: number | null;
  referralPointsUsed: number;
  status: PaymentStatus;
  depositorName: string | null;
  adminNote: string | null;
  confirmedByAdminId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReferralLedgerRecord = {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  paymentRequestId: string;
  amountUsd: number;
  percent: number;
  points: number;
  status: ReferralLedgerStatus;
  confirmAfter: string;
  confirmedAt: string | null;
  reversedAt: string | null;
  createdAt: string;
};

export type AuditLogDraft = {
  actorAdminId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: unknown;
  afterJson: unknown;
};

export type SupportCategory = 'deposit' | 'cancel' | 'partnership' | 'usage' | 'signal' | 'general';
export type SupportVisibility = 'public' | 'private';
export type SupportStatus = 'waiting' | 'answered' | 'closed';

export type SupportThreadRecord = {
  id: string;
  authorUserId: string;
  category: SupportCategory;
  title: string;
  visibility: SupportVisibility;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessageRecord = {
  id: string;
  threadId: string;
  authorUserId: string;
  body: string;
  isAdminReply: boolean;
  createdAt: string;
};

export type NotificationCategory =
  | 'support_reply'
  | 'qna'
  | 'subscription'
  | 'payment'
  | 'signal'
  | 'expiry'
  | 'notice';

export type NotificationRecord = {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};
