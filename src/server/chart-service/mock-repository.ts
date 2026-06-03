import {
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
  TRANSACTION_VERIFICATION_STATUSES,
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
  ChartUserSettingsRecord,
  ChartServiceRepository,
  EmailOutboxRecord,
  EmailOutboxFilter,
  EmailVerificationTokenRecord,
  FreeTrialPolicySettingsRecord,
  FreeTrialUsageRecord,
  FreeTrialUserAllowanceRecord,
  PasswordResetTokenRecord,
  PaymentTransferSettingsRecord,
  NoticePopupRecord,
  PurgedUnverifiedUserAccountRecord,
  PublicBoardPostRecord,
  ReferralProgramSettingsRecord,
  SalesTeamRecord,
  ServiceUserRecord,
  SignupAgreementRecord,
  SignalAdminSettingsRecord,
  SocialAuthAccountRecord,
  SocialAuthProvider,
  WebInfoSettingsRecord,
} from './repository.ts';
import { getDefaultChartServiceSubscriptionPlans } from './bootstrap.ts';
import { createPasswordHash } from './passwords.ts';
import { getDefaultPublicBoardPosts } from './public-board.ts';
import { createStableFallbackReferralCode } from './referral-codes.ts';

export type MockChartServiceState = {
  idSeq: number;
  users: ServiceUserRecord[];
  socialAuthAccounts: SocialAuthAccountRecord[];
  sessions: AuthSessionRecord[];
  passwordResetTokens: PasswordResetTokenRecord[];
  emailVerificationTokens: EmailVerificationTokenRecord[];
  emailOutbox: EmailOutboxRecord[];
  plans: SubscriptionPlan[];
  subscriptions: SubscriptionRecord[];
  payments: PaymentRequestRecord[];
  referralProgramSettings: ReferralProgramSettingsRecord | null;
  salesTeams: SalesTeamRecord[];
  freeTrialPolicySettings: FreeTrialPolicySettingsRecord | null;
  freeTrialUserAllowances: FreeTrialUserAllowanceRecord[];
  freeTrialUsageRecords: FreeTrialUsageRecord[];
  paymentTransferSettings: PaymentTransferSettingsRecord | null;
  webInfoSettings: WebInfoSettingsRecord | null;
  chartUserSettings: ChartUserSettingsRecord[];
  signalAdminSettings: SignalAdminSettingsRecord[];
  signupAgreements: SignupAgreementRecord[];
  publicBoardPosts: PublicBoardPostRecord[];
  noticePopups: NoticePopupRecord[];
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
      createMockUser({
        id: 'user_member',
        email: 'member@example.com',
        name: 'Member',
        role: USER_ROLES.member,
        phoneNumber: '010-1000-2000',
        referredByUserId: 'user_subscriber',
      }),
      createMockUser({ id: 'user_trial', email: 'trial@example.com', name: 'Trial', role: USER_ROLES.member }),
      createMockUser({ id: 'user_subscriber', email: 'subscriber@example.com', name: 'Subscriber', role: USER_ROLES.member }),
      createMockUser({ id: 'admin_1', email: 'admin@example.com', name: 'Admin', role: USER_ROLES.admin }),
      createMockUser({ id: 'super_1', email: 'super@example.com', name: 'Super Admin', role: USER_ROLES.superAdmin }),
    ],
    socialAuthAccounts: [],
    sessions: [],
    passwordResetTokens: [],
    emailVerificationTokens: [],
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
    referralProgramSettings: null,
    salesTeams: [],
    freeTrialPolicySettings: null,
    freeTrialUserAllowances: [],
    freeTrialUsageRecords: [],
    paymentTransferSettings: null,
    webInfoSettings: null,
    chartUserSettings: [],
    signalAdminSettings: [],
    signupAgreements: [],
    publicBoardPosts: getDefaultPublicBoardPosts(),
    noticePopups: [],
    referralLedgers: [
      {
        id: 'ref_ledger_pending',
        referrerUserId: 'user_subscriber',
        referredUserId: 'user_member',
        paymentRequestId: 'pay_pending',
        amountUsd: 199,
        percent: 10,
        points: 19.9,
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
  phoneNumber?: string | null;
  profileImageDataUrl?: string | null;
  referralCode?: string;
  referredByUserId?: string | null;
  createdAt?: string;
}): ServiceUserRecord {
  return {
    id: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    accountStatus: input.accountStatus ?? USER_ACCOUNT_STATUSES.active,
    phoneNumber: input.phoneNumber ?? null,
    profileImageDataUrl: input.profileImageDataUrl ?? null,
    referralCode: input.referralCode ?? createStableFallbackReferralCode(input.id),
    referredByUserId: input.referredByUserId ?? null,
    createdAt: input.createdAt ?? '2026-05-23T00:00:00.000Z',
    passwordHash: createPasswordHash('Demo1234!', { salt: `demo_${input.id}` }),
    emailVerifiedAt: input.createdAt ?? '2026-05-23T00:00:00.000Z',
  };
}

export function createMockChartServiceRepository(
  state: MockChartServiceState = createMockChartServiceState(),
): ChartServiceRepository {
  state.passwordResetTokens ??= [];
  state.socialAuthAccounts ??= [];
  state.emailVerificationTokens ??= [];
  state.emailOutbox ??= [];
  state.referralProgramSettings ??= null;
  state.salesTeams ??= [];
  state.freeTrialPolicySettings ??= null;
  state.freeTrialUserAllowances ??= [];
  state.freeTrialUsageRecords ??= [];
  state.paymentTransferSettings ??= null;
  state.webInfoSettings ??= null;
  state.chartUserSettings ??= [];
  state.signalAdminSettings ??= [];
  state.signupAgreements ??= [];
  state.publicBoardPosts ??= getDefaultPublicBoardPosts();
  state.noticePopups ??= [];

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
    purgeUnverifiedUserByEmail(email): PurgedUnverifiedUserAccountRecord | null {
      const normalizedEmail = email.trim().toLowerCase();
      const user = state.users.find((item) => item.email.toLowerCase() === normalizedEmail);
      if (!user) return null;
      const deletedSessionCount = state.sessions.filter((session) => session.userId === user.id).length;
      const deletedEmailOutboxCount = state.emailOutbox.filter((record) => (
        record.recipientEmail.toLowerCase() === normalizedEmail
      )).length;
      const supportThreadIds = new Set(state.supportThreads
        .filter((thread) => thread.authorUserId === user.id)
        .map((thread) => thread.id));
      const paymentIds = new Set(state.payments
        .filter((payment) => payment.userId === user.id)
        .map((payment) => payment.id));

      state.sessions = state.sessions.filter((session) => session.userId !== user.id);
      state.socialAuthAccounts = state.socialAuthAccounts.filter((account) => account.userId !== user.id);
      state.passwordResetTokens = state.passwordResetTokens.filter((token) => token.userId !== user.id);
      state.emailVerificationTokens = state.emailVerificationTokens.filter((token) => token.userId !== user.id);
      state.emailOutbox = state.emailOutbox.filter((record) => record.recipientEmail.toLowerCase() !== normalizedEmail);
      state.signupAgreements = state.signupAgreements.filter((agreement) => agreement.userId !== user.id);
      state.chartUserSettings = state.chartUserSettings.filter((settings) => settings.userId !== user.id);
      state.notifications = state.notifications.filter((notification) => notification.userId !== user.id);
      state.referralLedgers = state.referralLedgers.filter((ledger) => (
        ledger.referrerUserId !== user.id &&
        ledger.referredUserId !== user.id &&
        !paymentIds.has(ledger.paymentRequestId)
      ));
      state.payments = state.payments.filter((payment) => payment.userId !== user.id);
      state.freeTrialUsageRecords = state.freeTrialUsageRecords.filter((record) => record.userId !== user.id);
      state.freeTrialUserAllowances = state.freeTrialUserAllowances.filter((allowance) => allowance.userId !== user.id);
      state.subscriptions = state.subscriptions.filter((subscription) => subscription.userId !== user.id);
      state.supportMessages = state.supportMessages.filter((message) => (
        message.authorUserId !== user.id && !supportThreadIds.has(message.threadId)
      ));
      state.supportThreads = state.supportThreads.filter((thread) => thread.authorUserId !== user.id);
      state.users = state.users.filter((item) => item.id !== user.id);

      return {
        user: { ...user },
        deletedSessionCount,
        deletedEmailOutboxCount,
      };
    },
    getSocialAuthAccount(provider: SocialAuthProvider, providerUserId: string) {
      return cloneOrNull(state.socialAuthAccounts.find((account) => (
        account.provider === provider && account.providerUserId === providerUserId
      )));
    },
    listSocialAuthAccountsByUserId(userId: string) {
      return state.socialAuthAccounts
        .filter((account) => account.userId === userId)
        .map((account) => ({ ...account }));
    },
    saveSocialAuthAccount(account: SocialAuthAccountRecord) {
      upsertByCompositeKey(state.socialAuthAccounts, account, ['provider', 'providerUserId']);
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
    getEmailVerificationTokenByTokenHash(tokenHash) {
      return cloneOrNull(state.emailVerificationTokens.find((token) => token.tokenHash === tokenHash));
    },
    saveEmailVerificationToken(token) {
      upsertById(state.emailVerificationTokens, token);
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
    getSubscriptionByUserId: (userId) => cloneOrNull(state.subscriptions
      .filter((subscription) => subscription.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]),
    listSubscriptions: () => state.subscriptions.map((subscription) => ({ ...subscription })),
    saveSubscription(subscription) {
      upsertById(state.subscriptions, subscription);
    },
    getPaymentById: (id) => cloneOrNull(state.payments.find((payment) => payment.id === id)),
    listPayments: () => state.payments.map((payment) => ({ ...payment })),
    savePayment(payment) {
      upsertById(state.payments, payment);
    },
    getReferralProgramSettings() {
      return cloneOrNull(state.referralProgramSettings);
    },
    saveReferralProgramSettings(settings) {
      state.referralProgramSettings = { ...settings };
    },
    listSalesTeams() {
      return state.salesTeams.map((team) => structuredClone(team));
    },
    saveSalesTeam(team) {
      upsertById(state.salesTeams, team);
    },
    getFreeTrialPolicySettings() {
      return cloneOrNull(state.freeTrialPolicySettings);
    },
    saveFreeTrialPolicySettings(settings) {
      state.freeTrialPolicySettings = structuredClone(settings);
    },
    getFreeTrialUserAllowanceByUserId(userId) {
      return cloneOrNull(state.freeTrialUserAllowances.find((allowance) => allowance.userId === userId));
    },
    saveFreeTrialUserAllowance(allowance) {
      upsertByKey(state.freeTrialUserAllowances, allowance, 'userId');
    },
    listFreeTrialUsageRecordsByUserId(userId) {
      return state.freeTrialUsageRecords
        .filter((record) => record.userId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((record) => structuredClone(record));
    },
    saveFreeTrialUsageRecord(record) {
      upsertById(state.freeTrialUsageRecords, record);
    },
    getPaymentTransferSettings() {
      return cloneOrNull(state.paymentTransferSettings);
    },
    savePaymentTransferSettings(settings) {
      state.paymentTransferSettings = { ...settings };
    },
    getWebInfoSettings() {
      return cloneOrNull(state.webInfoSettings);
    },
    saveWebInfoSettings(settings) {
      state.webInfoSettings = { ...settings };
    },
    getChartUserSettings(userId) {
      return cloneOrNull(state.chartUserSettings.find((settings) => settings.userId === userId));
    },
    saveChartUserSettings(settings) {
      const index = state.chartUserSettings.findIndex((item) => item.userId === settings.userId);
      if (index >= 0) {
        state.chartUserSettings[index] = structuredClone(settings);
      } else {
        state.chartUserSettings.push(structuredClone(settings));
      }
    },
    getSignalAdminSettings(id) {
      return cloneOrNull(state.signalAdminSettings.find((settings) => settings.id === id));
    },
    saveSignalAdminSettings(settings) {
      upsertById(state.signalAdminSettings, settings);
    },
    listSignupAgreementsByUserId(userId) {
      return state.signupAgreements
        .filter((agreement) => agreement.userId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((agreement) => ({ ...agreement }));
    },
    saveSignupAgreement(agreement) {
      upsertById(state.signupAgreements, agreement);
    },
    listReferralLedgersByPaymentId(paymentRequestId) {
      return state.referralLedgers
        .filter((ledger) => ledger.paymentRequestId === paymentRequestId)
        .map((ledger) => ({ ...ledger }));
    },
    saveReferralLedger(ledger) {
      upsertById(state.referralLedgers, ledger);
    },
    listPublicBoardPosts: () => state.publicBoardPosts.map((post) => structuredClone(post)),
    savePublicBoardPost(post) {
      upsertById(state.publicBoardPosts, post);
    },
    listNoticePopups: () => state.noticePopups.map((popup) => structuredClone(popup)),
    saveNoticePopup(popup) {
      upsertById(state.noticePopups, popup);
    },
    deleteNoticePopup(id) {
      state.noticePopups = state.noticePopups.filter((popup) => popup.id !== id);
    },
    getSupportThreadById: (id) => cloneOrNull(state.supportThreads.find((thread) => thread.id === id)),
    listSupportThreads: () => state.supportThreads.map((thread) => ({ ...thread })),
    saveSupportThread(thread) {
      upsertById(state.supportThreads, thread);
    },
    deleteSupportThread(id) {
      state.supportThreads = state.supportThreads.filter((thread) => thread.id !== id);
    },
    getSupportMessageById: (id) => cloneOrNull(state.supportMessages.find((message) => message.id === id)),
    listSupportMessagesByThreadId(threadId) {
      return state.supportMessages
        .filter((message) => message.threadId === threadId)
        .map((message) => ({ ...message }));
    },
    saveSupportMessage(message) {
      upsertById(state.supportMessages, message);
    },
    deleteSupportMessage(id) {
      state.supportMessages = state.supportMessages.filter((message) => message.id !== id);
    },
    deleteSupportMessagesByThreadId(threadId) {
      state.supportMessages = state.supportMessages.filter((message) => message.threadId !== threadId);
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
    supportThreadId: null,
    method: 'bank_transfer',
    amountUsd: 199,
    amountKrw: null,
    exchangeRate: null,
    referralPointsUsed: 0,
    status: PAYMENT_STATUSES.pending,
    depositorName: 'Member',
    transactionId: null,
    transactionVerificationStatus: TRANSACTION_VERIFICATION_STATUSES.unchecked,
    transactionVerificationMessage: null,
    transactionVerifiedAt: null,
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

function upsertByKey<T extends Record<string, unknown>, K extends keyof T>(rows: T[], row: T, key: K): void {
  const index = rows.findIndex((item) => item[key] === row[key]);
  if (index >= 0) {
    rows[index] = structuredClone(row);
  } else {
    rows.push(structuredClone(row));
  }
}

function upsertByCompositeKey<T extends Record<string, unknown>, K extends keyof T>(
  rows: T[],
  row: T,
  keys: K[],
): void {
  const index = rows.findIndex((item) => keys.every((key) => item[key] === row[key]));
  if (index >= 0) {
    rows[index] = structuredClone(row);
  } else {
    rows.push(structuredClone(row));
  }
}
