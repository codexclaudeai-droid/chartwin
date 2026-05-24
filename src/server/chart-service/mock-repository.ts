import {
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
  type AuditLogDraft,
  type NotificationRecord,
  type PaymentRequestRecord,
  type ReferralLedgerRecord,
  type SubscriptionPlan,
  type SubscriptionRecord,
  type SupportMessageRecord,
  type SupportThreadRecord,
} from '../../domain/chart-service/index.ts';
import type {
  AuthSessionRecord,
  ChartServiceRepository,
  EmailOutboxRecord,
  EmailOutboxFilter,
  PasswordResetTokenRecord,
  ServiceUserRecord,
} from './repository.ts';
import { getDefaultChartServiceSubscriptionPlans } from './bootstrap.ts';
import { createPasswordHash } from './passwords.ts';

export type MockChartServiceState = {
  idSeq: number;
  users: ServiceUserRecord[];
  sessions: AuthSessionRecord[];
  passwordResetTokens: PasswordResetTokenRecord[];
  emailOutbox: EmailOutboxRecord[];
  plans: SubscriptionPlan[];
  subscriptions: SubscriptionRecord[];
  payments: PaymentRequestRecord[];
  referralLedgers: ReferralLedgerRecord[];
  supportThreads: SupportThreadRecord[];
  supportMessages: SupportMessageRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogDraft[];
};

export function createMockChartServiceState(): MockChartServiceState {
  return {
    idSeq: 100,
    users: [
      createMockUser({ id: 'user_member', email: 'member@example.com', name: 'Member', role: USER_ROLES.member }),
      createMockUser({ id: 'user_trial', email: 'trial@example.com', name: 'Trial', role: USER_ROLES.member }),
      createMockUser({ id: 'user_subscriber', email: 'subscriber@example.com', name: 'Subscriber', role: USER_ROLES.member }),
      createMockUser({ id: 'admin_1', email: 'admin@example.com', name: 'Admin', role: USER_ROLES.admin }),
      createMockUser({ id: 'super_1', email: 'super@example.com', name: 'Super Admin', role: USER_ROLES.superAdmin }),
    ],
    sessions: [],
    passwordResetTokens: [],
    emailOutbox: [],
    plans: getDefaultChartServiceSubscriptionPlans(),
    subscriptions: [
      createSubscriptionRecord({
        id: 'sub_pending',
        userId: 'user_member',
        planId: 'plan_monthly',
        status: SUBSCRIPTION_STATUSES.paymentPending,
      }),
      createSubscriptionRecord({
        id: 'sub_trial',
        userId: 'user_trial',
        planId: null,
        status: SUBSCRIPTION_STATUSES.trialActive,
        startsAt: '2026-05-23T00:00:00.000Z',
        endsAt: '2026-05-30T00:00:00.000Z',
      }),
      createSubscriptionRecord({
        id: 'sub_active',
        userId: 'user_subscriber',
        planId: 'plan_monthly',
        status: SUBSCRIPTION_STATUSES.active,
        startsAt: '2026-05-23T00:00:00.000Z',
        endsAt: '2026-06-22T00:00:00.000Z',
        approvedByAdminId: 'admin_1',
        approvedAt: '2026-05-23T00:00:00.000Z',
      }),
    ],
    payments: [
      createPaymentRecord({
        id: 'pay_pending',
        userId: 'user_member',
        subscriptionId: 'sub_pending',
        status: PAYMENT_STATUSES.pending,
      }),
      createPaymentRecord({
        id: 'pay_active',
        userId: 'user_subscriber',
        subscriptionId: 'sub_active',
        status: PAYMENT_STATUSES.confirmed,
        confirmedByAdminId: 'admin_1',
        confirmedAt: '2026-05-23T00:00:00.000Z',
      }),
    ],
    referralLedgers: [
      {
        id: 'ref_ledger_pending',
        referrerUserId: 'user_subscriber',
        referredUserId: 'user_member',
        paymentRequestId: 'pay_pending',
        amountUsd: 199,
        percent: 20,
        points: 39.8,
        status: 'pending',
        confirmAfter: '2026-05-30T00:00:00.000Z',
        confirmedAt: null,
        reversedAt: null,
        createdAt: '2026-05-23T00:00:00.000Z',
      },
    ],
    supportThreads: [
      {
        id: 'support_public_notice',
        authorUserId: 'admin_1',
        category: 'general',
        title: '서비스 준비 현황',
        visibility: 'public',
        status: 'answered',
        createdAt: '2026-05-23T00:00:00.000Z',
        updatedAt: '2026-05-23T00:00:00.000Z',
      },
    ],
    supportMessages: [
      {
        id: 'support_msg_public_notice',
        threadId: 'support_public_notice',
        authorUserId: 'admin_1',
        body: '구독, 결제, 관리자 승인 흐름을 순차적으로 연결하고 있습니다.',
        isAdminReply: true,
        createdAt: '2026-05-23T00:00:00.000Z',
      },
    ],
    notifications: [],
    auditLogs: [],
  };
}

function createMockUser(input: {
  id: string;
  email: string;
  name: string;
  role: ServiceUserRecord['role'];
  accountStatus?: ServiceUserRecord['accountStatus'];
}): ServiceUserRecord {
  return {
    id: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    accountStatus: input.accountStatus ?? USER_ACCOUNT_STATUSES.active,
    passwordHash: createPasswordHash('Demo1234!', { salt: `demo_${input.id}` }),
  };
}

export function createMockChartServiceRepository(
  state: MockChartServiceState = createMockChartServiceState(),
): ChartServiceRepository {
  state.passwordResetTokens ??= [];
  state.emailOutbox ??= [];

  return {
    nextId(prefix: string): string {
      state.idSeq += 1;
      return `${prefix}_${state.idSeq}`;
    },
    listPlans: () => state.plans.map((plan) => ({ ...plan })),
    getPlanById: (id) => cloneOrNull(state.plans.find((plan) => plan.id === id)),
    savePlan(plan) {
      upsertById(state.plans, plan);
    },
    listUsers: () => state.users.map((user) => ({ ...user })),
    getUserById: (id) => cloneOrNull(state.users.find((user) => user.id === id)),
    getUserByEmail: (email) => cloneOrNull(state.users.find((user) => user.email.toLowerCase() === email.toLowerCase())),
    saveUser(user) {
      upsertById(state.users, user);
    },
    getSessionById: (id) => cloneOrNull(state.sessions.find((session) => session.id === id)),
    listSessionsByUserId(userId) {
      return state.sessions
        .filter((session) => session.userId === userId)
        .map((session) => ({ ...session }));
    },
    saveSession(session) {
      upsertById(state.sessions, session);
    },
    deleteSession(id) {
      state.sessions = state.sessions.filter((session) => session.id !== id);
    },
    getPasswordResetTokenByTokenHash(tokenHash) {
      return cloneOrNull(state.passwordResetTokens.find((token) => token.tokenHash === tokenHash));
    },
    savePasswordResetToken(token) {
      upsertById(state.passwordResetTokens, token);
    },
    listEmailOutboxRecords(filter: EmailOutboxFilter = {}) {
      return state.emailOutbox
        .filter((record) => !filter.status || record.status === filter.status)
        .map((record) => ({ ...record }));
    },
    saveEmailOutboxRecord(record) {
      upsertById(state.emailOutbox, record);
    },
    getSubscriptionById: (id) => cloneOrNull(state.subscriptions.find((subscription) => subscription.id === id)),
    getSubscriptionByUserId: (userId) => cloneOrNull(state.subscriptions.find((subscription) => subscription.userId === userId)),
    listSubscriptions: () => state.subscriptions.map((subscription) => ({ ...subscription })),
    saveSubscription(subscription) {
      upsertById(state.subscriptions, subscription);
    },
    getPaymentById: (id) => cloneOrNull(state.payments.find((payment) => payment.id === id)),
    listPayments: () => state.payments.map((payment) => ({ ...payment })),
    savePayment(payment) {
      upsertById(state.payments, payment);
    },
    listReferralLedgersByPaymentId(paymentRequestId) {
      return state.referralLedgers
        .filter((ledger) => ledger.paymentRequestId === paymentRequestId)
        .map((ledger) => ({ ...ledger }));
    },
    saveReferralLedger(ledger) {
      upsertById(state.referralLedgers, ledger);
    },
    getSupportThreadById: (id) => cloneOrNull(state.supportThreads.find((thread) => thread.id === id)),
    listSupportThreads: () => state.supportThreads.map((thread) => ({ ...thread })),
    saveSupportThread(thread) {
      upsertById(state.supportThreads, thread);
    },
    listSupportMessagesByThreadId(threadId) {
      return state.supportMessages
        .filter((message) => message.threadId === threadId)
        .map((message) => ({ ...message }));
    },
    saveSupportMessage(message) {
      upsertById(state.supportMessages, message);
    },
    listNotificationsByUserId(userId) {
      return state.notifications
        .filter((notification) => notification.userId === userId)
        .map((notification) => ({ ...notification }));
    },
    saveNotification(notification) {
      upsertById(state.notifications, notification);
    },
    appendAuditLog(auditLog) {
      state.auditLogs.push(structuredClone(auditLog));
    },
    listAuditLogs: () => state.auditLogs.map((auditLog) => structuredClone(auditLog)),
  };
}

function createSubscriptionRecord(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  return {
    id: 'sub_1',
    userId: 'user_1',
    planId: null,
    status: SUBSCRIPTION_STATUSES.none,
    startsAt: null,
    endsAt: null,
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
    ...overrides,
  };
}

function createPaymentRecord(overrides: Partial<PaymentRequestRecord>): PaymentRequestRecord {
  return {
    id: 'pay_1',
    userId: 'user_1',
    planId: 'plan_monthly',
    subscriptionId: 'sub_1',
    method: 'bank_transfer',
    amountUsd: 199,
    amountKrw: null,
    exchangeRate: null,
    referralPointsUsed: 0,
    status: PAYMENT_STATUSES.pending,
    depositorName: 'Member',
    adminNote: null,
    confirmedByAdminId: null,
    confirmedAt: null,
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
    ...overrides,
  };
}

function cloneOrNull<T>(value: T | undefined): T | null {
  return value ? structuredClone(value) : null;
}

function upsertById<T extends { id: string }>(rows: T[], row: T): void {
  const index = rows.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    rows[index] = structuredClone(row);
  } else {
    rows.push(structuredClone(row));
  }
}
