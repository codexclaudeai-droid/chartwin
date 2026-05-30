import {
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
  TRANSACTION_VERIFICATION_STATUSES,
  approveSubscription,
  assertAdminActor,
  cancelSubscription,
  canUseFullChart,
  canViewPaidSignals,
  confirmPaymentRequest,
  createAuditLogDraft,
  rejectPaymentRequest,
  refundPaymentRequest,
  refundSubscription,
  reverseReferralLedger,
  type Actor,
  type PaymentRequestRecord,
  type SubscriptionPlan,
  type SubscriptionRecord,
  type SupportMessageRecord,
  type SupportThreadRecord,
} from '../../domain/chart-service/index.ts';
import type { ChartServiceRepository, PublicServiceUserRecord, ServiceUserRecord } from './repository.ts';
import { createUserNotification } from './notifications.ts';
import { createProfilePaymentLink } from './notification-links.ts';
import { getPaymentTransferSettingsForDisplay } from './payment-settings.ts';
import { createReferralLedgerForPayment } from './referral-program.ts';
import { notifyAdminsAboutSupportRequest } from './support-admin-notifications.ts';
import {
  createFailedTransactionVerificationResult,
  verifyTronUsdtTransactionPayload,
  type TronScanTransactionPayload,
} from './txid-verification.ts';
import { toPublicServiceUserRecord } from './user-serialization.ts';

export type ChartAccessSnapshot = {
  userId: string;
  role: string;
  subscriptionStatus: string;
  fullChart: boolean;
  paidSignals: boolean;
};

export type AdminPaymentQueueItem = {
  payment: PaymentRequestRecord;
  user: PublicServiceUserRecord;
  plan: SubscriptionPlan | null;
  subscription: SubscriptionRecord | null;
  supportThread: SupportThreadRecord | null;
};

export type AdminSubscriptionQueueItem = {
  subscription: SubscriptionRecord;
  user: PublicServiceUserRecord;
  plan: SubscriptionPlan | null;
  payment: PaymentRequestRecord | null;
};

export function getChartAccessSnapshot(
  repository: ChartServiceRepository,
  userId: string,
): ChartAccessSnapshot {
  const user = requireUser(repository, userId);
  const subscription = repository.getSubscriptionByUserId(userId);
  const subscriptionStatus = subscription?.status ?? SUBSCRIPTION_STATUSES.none;
  const context = { role: user.role, subscriptionStatus };

  return {
    userId,
    role: user.role,
    subscriptionStatus,
    fullChart: canUseFullChart(context),
    paidSignals: canViewPaidSignals(context),
  };
}

export function createManualPaymentRequest(
  repository: ChartServiceRepository,
  input: {
    userId: string;
    planId: string;
    method: 'bank_transfer' | 'usdt';
    requestedAt: string;
    depositorName?: string;
    transactionId?: string;
    exchangeRate?: number | null;
    referralPointsUsed?: number;
  },
): {
  payment: PaymentRequestRecord;
  subscription: SubscriptionRecord;
  supportThread: SupportThreadRecord;
  supportMessage: SupportMessageRecord;
} {
  const user = requireUser(repository, input.userId);
  const plan = repository.getPlanById(input.planId);
  if (!plan || !plan.isActive) {
    throw new Error(`Active plan not found: ${input.planId}`);
  }
  const subscriptionId = repository.nextId('sub');
  const paymentId = repository.nextId('pay');
  const supportThreadId = repository.nextId('support');

  const subscription: SubscriptionRecord = {
    id: subscriptionId,
    userId: input.userId,
    planId: plan.id,
    status: SUBSCRIPTION_STATUSES.paymentPending,
    startsAt: null,
    endsAt: null,
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: input.requestedAt,
    updatedAt: input.requestedAt,
  };
  const amountUsd = calculatePlanAmountUsd(plan.basePriceUsd, plan.discountPercent);
  const transactionId = normalizePaymentTransactionId(input.method, input.transactionId);
  const depositorName = normalizePaymentDepositorName(input.method, input.depositorName);
  const { thread: supportThread, message: supportMessage } = createDepositSupportThreadDraft({
    threadId: supportThreadId,
    messageId: repository.nextId('support_msg'),
    userId: input.userId,
    paymentId,
    plan,
    amountUsd,
    method: input.method,
    depositorName,
    transactionId,
    createdAt: input.requestedAt,
  });
  const payment: PaymentRequestRecord = {
    id: paymentId,
    userId: input.userId,
    planId: plan.id,
    subscriptionId: subscription.id,
    supportThreadId: supportThread.id,
    method: input.method,
    amountUsd,
    amountKrw: input.exchangeRate ? Math.round(amountUsd * input.exchangeRate) : null,
    exchangeRate: input.exchangeRate ?? null,
    referralPointsUsed: input.referralPointsUsed ?? 0,
    status: PAYMENT_STATUSES.pending,
    depositorName,
    transactionId,
    transactionVerificationStatus: TRANSACTION_VERIFICATION_STATUSES.unchecked,
    transactionVerificationMessage: null,
    transactionVerifiedAt: null,
    adminNote: null,
    confirmedByAdminId: null,
    confirmedAt: null,
    createdAt: input.requestedAt,
    updatedAt: input.requestedAt,
  };

  repository.saveSubscription(subscription);
  repository.saveSupportThread(supportThread);
  repository.saveSupportMessage(supportMessage);
  repository.savePayment(payment);
  const referralLedger = createReferralLedgerForPayment(repository, {
    user,
    payment,
    createdAt: input.requestedAt,
  });
  if (referralLedger) repository.saveReferralLedger(referralLedger);
  notifyAdminsAboutSupportRequest(repository, {
    thread: supportThread,
    message: supportMessage,
    author: user,
    createdAt: input.requestedAt,
  });
  createUserNotification(repository, {
    userId: payment.userId,
    category: 'payment',
    title: '입금확인 요청이 접수되었습니다',
    body: '관리자가 실제 입금 내역을 수동 확인한 뒤 구독 승인 단계로 진행합니다.',
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.requestedAt,
  });
  return { payment, subscription, supportThread, supportMessage };
}

export function createAuthenticatedManualPaymentRequest(
  repository: ChartServiceRepository,
  input: {
    actor: Actor;
    planId: string;
    method: 'bank_transfer' | 'usdt';
    requestedAt: string;
    depositorName?: string;
    transactionId?: string;
    exchangeRate?: number | null;
    referralPointsUsed?: number;
  },
): {
  payment: PaymentRequestRecord;
  subscription: SubscriptionRecord;
  supportThread: SupportThreadRecord;
  supportMessage: SupportMessageRecord;
} {
  return createManualPaymentRequest(repository, {
    userId: input.actor.id,
    planId: input.planId,
    method: input.method,
    requestedAt: input.requestedAt,
    depositorName: input.depositorName,
    transactionId: input.transactionId,
    exchangeRate: input.exchangeRate,
    referralPointsUsed: input.referralPointsUsed,
  });
}

export function listAdminPaymentQueue(repository: ChartServiceRepository): AdminPaymentQueueItem[] {
  return repository
    .listPayments()
    .map((payment) => {
      const user = repository.getUserById(payment.userId);
      if (!user) return null;

      return {
        payment,
        user: toPublicServiceUserRecord(user),
        plan: repository.getPlanById(payment.planId),
        subscription: repository.getSubscriptionById(payment.subscriptionId),
        supportThread: payment.supportThreadId ? repository.getSupportThreadById(payment.supportThreadId) : null,
      };
    })
    .filter((item): item is AdminPaymentQueueItem => item !== null)
    .sort((a, b) => new Date(b.payment.createdAt).getTime() - new Date(a.payment.createdAt).getTime());
}

export function verifyPaymentTransactionPayload(
  repository: ChartServiceRepository,
  input: {
    paymentId: string;
    admin: Actor;
    checkedAt: string;
    transactionPayload: TronScanTransactionPayload;
  },
): { payment: PaymentRequestRecord } {
  assertAdminActor(input.admin);
  const payment = requirePayment(repository, input.paymentId);
  if (payment.method !== 'usdt') {
    throw new Error('Only USDT payments can be verified with TronScan');
  }
  if (!payment.transactionId) {
    throw new Error('USDT transaction id required');
  }

  const settings = getPaymentTransferSettingsForDisplay(repository);
  const result = verifyTronUsdtTransactionPayload({
    payment,
    expectedAddress: settings.usdtAddress,
    transactionPayload: input.transactionPayload,
  });
  const updatedPayment: PaymentRequestRecord = {
    ...payment,
    transactionVerificationStatus: result.status,
    transactionVerificationMessage: result.message,
    transactionVerifiedAt: input.checkedAt,
    updatedAt: input.checkedAt,
  };

  repository.savePayment(updatedPayment);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.txid.verify',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment },
    afterJson: { payment: updatedPayment, verification: result },
  }));

  return { payment: updatedPayment };
}

export function markPaymentTransactionVerificationFailed(
  repository: ChartServiceRepository,
  input: {
    paymentId: string;
    admin: Actor;
    checkedAt: string;
    error: unknown;
  },
): { payment: PaymentRequestRecord } {
  assertAdminActor(input.admin);
  const payment = requirePayment(repository, input.paymentId);
  const result = createFailedTransactionVerificationResult(input.error);
  const updatedPayment: PaymentRequestRecord = {
    ...payment,
    transactionVerificationStatus: result.status,
    transactionVerificationMessage: result.message,
    transactionVerifiedAt: input.checkedAt,
    updatedAt: input.checkedAt,
  };
  repository.savePayment(updatedPayment);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.txid.verify',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment },
    afterJson: { payment: updatedPayment, verification: result },
  }));
  return { payment: updatedPayment };
}

export function requestSubscriptionCancellation(
  repository: ChartServiceRepository,
  input: { actor: Actor; requestedAt: string },
): SubscriptionRecord {
  const subscription = requireSubscriptionForUser(repository, input.actor.id);
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.active &&
    subscription.status !== SUBSCRIPTION_STATUSES.expiring
  ) {
    throw new Error(`Cannot request cancellation from status ${subscription.status}`);
  }

  const requestedSubscription = {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.cancelRequested,
    updatedAt: input.requestedAt,
  };
  repository.saveSubscription(requestedSubscription);
  return requestedSubscription;
}

export function requestSubscriptionRefund(
  repository: ChartServiceRepository,
  input: { actor: Actor; requestedAt: string },
): SubscriptionRecord {
  const subscription = requireSubscriptionForUser(repository, input.actor.id);
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.active &&
    subscription.status !== SUBSCRIPTION_STATUSES.expiring
  ) {
    throw new Error(`Cannot request refund from status ${subscription.status}`);
  }

  const requestedSubscription = {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.refundRequested,
    updatedAt: input.requestedAt,
  };
  repository.saveSubscription(requestedSubscription);
  return requestedSubscription;
}

export function listAdminSubscriptionQueue(repository: ChartServiceRepository): AdminSubscriptionQueueItem[] {
  return repository
    .listSubscriptions()
    .filter((subscription) => (
      subscription.status === SUBSCRIPTION_STATUSES.cancelRequested ||
      subscription.status === SUBSCRIPTION_STATUSES.refundRequested ||
      subscription.status === SUBSCRIPTION_STATUSES.paymentPending ||
      subscription.status === SUBSCRIPTION_STATUSES.paymentRequested
    ))
    .map((subscription) => {
      const user = repository.getUserById(subscription.userId);
      if (!user) return null;
      return {
        subscription,
        user: toPublicServiceUserRecord(user),
        plan: subscription.planId ? repository.getPlanById(subscription.planId) : null,
        payment: repository.listPayments().find((payment) => payment.subscriptionId === subscription.id) ?? null,
      };
    })
    .filter((item): item is AdminSubscriptionQueueItem => item !== null)
    .sort((a, b) => new Date(b.subscription.updatedAt).getTime() - new Date(a.subscription.updatedAt).getTime());
}

export function approveSubscriptionCancelRequest(
  repository: ChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; cancelledAt: string; adminNote: string },
): SubscriptionRecord {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const subscription = requireSubscription(repository, input.subscriptionId);
  const cancelledSubscription = cancelSubscription(subscription, {
    adminId: input.admin.id,
    cancelledAt: input.cancelledAt,
  });

  repository.saveSubscription(cancelledSubscription);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.cancel.approve',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { subscription },
    afterJson: { subscription: cancelledSubscription, adminNote },
  }));
  createUserNotification(repository, {
    userId: subscription.userId,
    category: 'subscription',
    title: '구독 취소가 승인되었습니다',
    body: adminNote,
    linkUrl: '/pricing',
    createdAt: input.cancelledAt,
  });
  return cancelledSubscription;
}

export function approveSubscriptionRefundRequest(
  repository: ChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; refundedAt: string; adminNote: string },
): { payment: PaymentRequestRecord; subscription: SubscriptionRecord; reversedReferralCount: number } {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const subscription = requireSubscription(repository, input.subscriptionId);
  const payment = repository.listPayments().find((item) => item.subscriptionId === subscription.id);
  if (!payment) {
    throw new Error(`Payment not found for subscription: ${subscription.id}`);
  }

  const refundedPayment = refundPaymentRequest(payment, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
    adminNote,
  });
  const refundedSubscription = refundSubscription(subscription, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
  });
  const reversedLedgers = repository
    .listReferralLedgersByPaymentId(payment.id)
    .map((ledger) => reverseReferralLedger(ledger, input.refundedAt));

  repository.savePayment(refundedPayment);
  repository.saveSubscription(refundedSubscription);
  reversedLedgers.forEach((ledger) => repository.saveReferralLedger(ledger));
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.refund.approve',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: refundedPayment, subscription: refundedSubscription, reversedLedgers },
  }));
  createUserNotification(repository, {
    userId: subscription.userId,
    category: 'subscription',
    title: '환불 요청이 승인되었습니다',
    body: adminNote,
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.refundedAt,
  });

  return {
    payment: refundedPayment,
    subscription: refundedSubscription,
    reversedReferralCount: reversedLedgers.length,
  };
}

export function rejectSubscriptionRequest(
  repository: ChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; rejectedAt: string; adminNote: string },
): SubscriptionRecord {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const subscription = requireSubscription(repository, input.subscriptionId);
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.cancelRequested &&
    subscription.status !== SUBSCRIPTION_STATUSES.refundRequested
  ) {
    throw new Error(`Cannot reject subscription request from status ${subscription.status}`);
  }

  const activeSubscription: SubscriptionRecord = {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.active,
    updatedAt: input.rejectedAt,
  };
  repository.saveSubscription(activeSubscription);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.request.reject',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { subscription },
    afterJson: { subscription: activeSubscription, adminNote },
  }));
  createUserNotification(repository, {
    userId: subscription.userId,
    category: 'subscription',
    title: '구독 요청이 반려되었습니다',
    body: adminNote,
    linkUrl: '/pricing',
    createdAt: input.rejectedAt,
  });

  return activeSubscription;
}

export function confirmManualPaymentRequest(
  repository: ChartServiceRepository,
  input: {
    paymentId: string;
    admin: Actor;
    confirmedAt: string;
    adminNote?: string;
  },
): { payment: PaymentRequestRecord; subscription: SubscriptionRecord } {
  assertAdminActor(input.admin);
  const adminNote = typeof input.adminNote === 'string' && input.adminNote.trim()
    ? input.adminNote.trim()
    : undefined;
  const payment = requirePayment(repository, input.paymentId);
  const subscription = requireSubscription(repository, payment.subscriptionId);

  const confirmedPayment = confirmPaymentRequest(payment, {
    adminId: input.admin.id,
    confirmedAt: input.confirmedAt,
    adminNote,
  });
  const approvalPendingSubscription: SubscriptionRecord = {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.paymentRequested,
    updatedAt: input.confirmedAt,
  };

  repository.savePayment(confirmedPayment);
  repository.saveSubscription(approvalPendingSubscription);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.confirm',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: confirmedPayment, subscription: approvalPendingSubscription },
  }));
  createUserNotification(repository, {
    userId: payment.userId,
    category: 'payment',
    title: '입금 확인이 완료되었습니다',
    body: adminNote ?? '입금 확인이 완료되었습니다. 관리자 구독 승인을 기다리는 중입니다.',
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.confirmedAt,
  });

  return { payment: confirmedPayment, subscription: approvalPendingSubscription };
}

export function approveSubscriptionActivationRequest(
  repository: ChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; approvedAt: string; adminNote?: string },
): SubscriptionRecord {
  assertAdminActor(input.admin);
  const adminNote = typeof input.adminNote === 'string' && input.adminNote.trim()
    ? input.adminNote.trim()
    : undefined;
  const subscription = requireSubscription(repository, input.subscriptionId);
  const plan = subscription.planId ? repository.getPlanById(subscription.planId) : null;
  if (!plan) {
    throw new Error(`Plan not found for subscription: ${subscription.id}`);
  }
  const payment = repository.listPayments().find((item) => item.subscriptionId === subscription.id);
  if (!payment || payment.status !== PAYMENT_STATUSES.confirmed) {
    throw new Error(`Confirmed payment required for subscription: ${subscription.id}`);
  }

  const activeSubscription = approveSubscription(subscription, {
    adminId: input.admin.id,
    approvedAt: input.approvedAt,
    durationDays: plan.durationDays,
  });

  repository.saveSubscription(activeSubscription);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.activate.approve',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { payment, subscription },
    afterJson: { subscription: activeSubscription, adminNote },
  }));
  createUserNotification(repository, {
    userId: subscription.userId,
    category: 'subscription',
    title: '구독이 활성화되었습니다',
    body: adminNote ?? '구독 승인이 완료되어 차트 서비스를 이용할 수 있습니다.',
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.approvedAt,
  });

  return activeSubscription;
}

export function rejectManualPaymentRequest(
  repository: ChartServiceRepository,
  input: { paymentId: string; admin: Actor; rejectedAt: string; adminNote: string },
): { payment: PaymentRequestRecord; subscription: SubscriptionRecord } {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const payment = requirePayment(repository, input.paymentId);
  const subscription = requireSubscription(repository, payment.subscriptionId);
  const rejectedPayment = rejectPaymentRequest(payment, {
    adminId: input.admin.id,
    rejectedAt: input.rejectedAt,
    adminNote,
  });
  const cancelledSubscription: SubscriptionRecord = {
    ...subscription,
    status: SUBSCRIPTION_STATUSES.cancelled,
    cancelledAt: input.rejectedAt,
    updatedAt: input.rejectedAt,
  };

  repository.savePayment(rejectedPayment);
  repository.saveSubscription(cancelledSubscription);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.reject_and_subscription.cancel',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: rejectedPayment, subscription: cancelledSubscription },
  }));
  createUserNotification(repository, {
    userId: payment.userId,
    category: 'payment',
    title: '결제 요청이 반려되었습니다',
    body: adminNote,
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.rejectedAt,
  });

  return { payment: rejectedPayment, subscription: cancelledSubscription };
}

export function refundManualPaymentAndSubscription(
  repository: ChartServiceRepository,
  input: {
    paymentId: string;
    admin: Actor;
    refundedAt: string;
    adminNote: string;
  },
): { payment: PaymentRequestRecord; subscription: SubscriptionRecord; reversedReferralCount: number } {
  const adminNote = requireAdminNote(input.adminNote);
  const payment = requirePayment(repository, input.paymentId);
  const subscription = requireSubscription(repository, payment.subscriptionId);
  const refundedPayment = refundPaymentRequest(payment, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
    adminNote,
  });
  const refundedSubscription = refundSubscription(subscription, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
  });
  const reversedLedgers = repository
    .listReferralLedgersByPaymentId(payment.id)
    .map((ledger) => reverseReferralLedger(ledger, input.refundedAt));

  repository.savePayment(refundedPayment);
  repository.saveSubscription(refundedSubscription);
  reversedLedgers.forEach((ledger) => repository.saveReferralLedger(ledger));
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.refund_and_subscription.refund',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: refundedPayment, subscription: refundedSubscription, reversedLedgers },
  }));
  createUserNotification(repository, {
    userId: payment.userId,
    category: 'payment',
    title: '환불 처리가 완료되었습니다',
    body: adminNote,
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.refundedAt,
  });

  return {
    payment: refundedPayment,
    subscription: refundedSubscription,
    reversedReferralCount: reversedLedgers.length,
  };
}

function createDepositSupportThreadDraft(input: {
  threadId: string;
  messageId: string;
  userId: string;
  paymentId: string;
  plan: SubscriptionPlan;
  amountUsd: number;
  method: PaymentRequestRecord['method'];
  depositorName: string | null;
  transactionId: string | null;
  createdAt: string;
}): { thread: SupportThreadRecord; message: SupportMessageRecord } {
  const thread: SupportThreadRecord = {
    id: input.threadId,
    authorUserId: input.userId,
    category: 'deposit',
    title: '입금확인 요청',
    visibility: 'private',
    status: 'waiting',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  const message: SupportMessageRecord = {
    id: input.messageId,
    threadId: input.threadId,
    authorUserId: input.userId,
    body: [
      '입금확인 요청입니다.',
      `플랜: ${input.plan.name}`,
      `결제 방식: ${input.method === 'usdt' ? 'USDT' : '무통장 입금'}`,
      `입금자명: ${input.depositorName || '미입력'}`,
      ...(input.transactionId ? [`TXID: ${input.transactionId}`] : []),
      `결제 금액: $${input.amountUsd}`,
      '관리자가 실제 입금 내역을 수동 확인한 뒤 구독 승인을 진행해주세요.',
    ].join('\n'),
    isAdminReply: false,
    createdAt: input.createdAt,
  };

  return { thread, message };
}

function calculatePlanAmountUsd(basePriceUsd: number, discountPercent: number): number {
  return Math.round(basePriceUsd * (1 - discountPercent / 100) * 100) / 100;
}

function normalizePaymentTransactionId(method: PaymentRequestRecord['method'], value: string | undefined): string | null {
  const transactionId = String(value ?? '').trim();
  if (method === 'usdt' && !transactionId) {
    throw new Error('USDT transaction id required');
  }
  if (transactionId.length > 160) {
    throw new Error('USDT transaction id too long');
  }
  return transactionId || null;
}

function normalizePaymentDepositorName(method: PaymentRequestRecord['method'], value: string | undefined): string | null {
  const depositorName = String(value ?? '').trim();
  if (method === 'bank_transfer' && !depositorName) {
    throw new Error('Bank transfer depositor name required');
  }
  return depositorName || null;
}

function requireUser(repository: ChartServiceRepository, userId: string) {
  const user = repository.getUserById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  return user;
}

function requirePayment(repository: ChartServiceRepository, paymentId: string): PaymentRequestRecord {
  const payment = repository.getPaymentById(paymentId);
  if (!payment) throw new Error(`Payment not found: ${paymentId}`);
  return payment;
}

function requireSubscription(repository: ChartServiceRepository, subscriptionId: string): SubscriptionRecord {
  const subscription = repository.getSubscriptionById(subscriptionId);
  if (!subscription) throw new Error(`Subscription not found: ${subscriptionId}`);
  return subscription;
}

function requireSubscriptionForUser(repository: ChartServiceRepository, userId: string): SubscriptionRecord {
  requireUser(repository, userId);
  const subscription = repository.getSubscriptionByUserId(userId);
  if (!subscription) throw new Error(`Subscription not found for user: ${userId}`);
  return subscription;
}

function requireAdminNote(adminNote: string): string {
  const normalizedNote = adminNote.trim();
  if (!normalizedNote) throw new Error('Admin note required');
  return normalizedNote;
}
