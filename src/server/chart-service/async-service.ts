import {
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
  TRANSACTION_VERIFICATION_STATUSES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
  approveSubscription,
  assertAdminActor,
  assertSuperAdminActor,
  cancelSubscription,
  canUseFullChart,
  canViewPaidSignals,
  confirmPaymentRequest,
  createAuditLogDraft,
  rejectPaymentRequest,
  refundPaymentRequest,
  refundSubscription,
  reverseReferralLedger,
  type AuditLogDraft,
  validatePasswordPolicy,
  validateProfileImageUpload,
  type Actor,
  type NotificationCategory,
  type NotificationRecord,
  type PaymentRequestRecord,
  type SubscriptionPlan,
  type SubscriptionRecord,
  type SupportCategory,
  type SupportMessageRecord,
  type SupportThreadRecord,
  type SupportVisibility,
  type UserAccountStatus,
  type UserRole,
} from '../../domain/chart-service/index.ts';
import { createSessionCookie, parseSessionCookieClaims } from './auth.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { AuthSessionRecord, PublicServiceUserRecord, ServiceUserRecord } from './repository.ts';
import { createPasswordHash, verifyPasswordHash } from './passwords.ts';
import { toDashboardUserSummary, type UserDashboardSummary } from './dashboard.ts';
import { redactAuditLogSensitiveFields, toPublicServiceUserRecord } from './user-serialization.ts';
import type { AdminDashboardSummary } from './admin-dashboard.ts';
import type { AdminAuditLogEntry, AdminAuditLogFilter } from './admin-audit.ts';
import type { AdminUserDetail, AdminUserDirectoryInput, AdminUserDirectoryItem } from './admin-users.ts';
import type {
  AdminPaymentQueueItem,
  AdminSubscriptionQueueItem,
  ChartAccessSnapshot,
} from './service.ts';
import {
  createProfilePaymentLink,
  createSupportThreadLink,
} from './notification-links.ts';
import {
  ensureAsyncRepositoryReferralCodes,
  createUniqueRandomReferralCode,
  normalizeReferralCode,
} from './referral-codes.ts';
import {
  createAsyncReferralLedgerForPayment,
  getAsyncUserReferralSummary,
} from './referral-program.ts';
import { notifyAsyncAdminsAboutSupportRequest } from './support-admin-notifications.ts';
import { getAsyncPaymentTransferSettingsForDisplay } from './payment-settings.ts';
import {
  createFailedTransactionVerificationResult,
  fetchTronScanTransaction,
  verifyTronUsdtTransactionPayload,
  type TronScanTransactionPayload,
} from './txid-verification.ts';

export const FREE_TRIAL_DURATION_DAYS = 7;

export type FreeTrialRequestResult = {
  status: 'started' | 'already_active';
  subscription: SubscriptionRecord | null;
  supportThread: SupportThreadRecord | null;
  endsAt: string | null;
};

export async function getActorFromAsyncRequest(
  repository: AsyncChartServiceRepository,
  request: { headers: Headers },
  nowIso: string,
): Promise<Actor> {
  const claims = parseSessionCookieClaims(request.headers.get('cookie'));
  if (!claims) throw new Error('Session required');

  const session = await repository.getSessionById(claims.sessionId);
  const userId = session?.userId ?? (claims.signed ? claims.userId : undefined);
  const expiresAt = session?.expiresAt ?? (claims.signed ? claims.expiresAt : undefined);

  if (!userId || !expiresAt) throw new Error('Session not found');
  if (new Date(expiresAt).getTime() <= new Date(nowIso).getTime()) {
    if (session) await repository.deleteSession(session.id);
    throw new Error('Session expired');
  }

  const user = await repository.getUserById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.accountStatus === USER_ACCOUNT_STATUSES.suspended) {
    if (session) await repository.deleteSession(session.id);
    throw new Error('Account suspended');
  }

  return { id: user.id, role: user.role };
}

export async function getAsyncChartAccessSnapshot(
  repository: AsyncChartServiceRepository,
  userId: string,
): Promise<ChartAccessSnapshot> {
  const user = await repository.getUserById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);

  const subscription = await repository.getSubscriptionByUserId(userId);
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

export async function requestAsyncFreeTrial(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; requestedAt: string },
): Promise<FreeTrialRequestResult> {
  const user = await repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const existingSubscription = await repository.getSubscriptionByUserId(user.id);
  const subscriptionStatus = existingSubscription?.status ?? SUBSCRIPTION_STATUSES.none;
  if (canUseFullChart({ role: user.role, subscriptionStatus })) {
    return {
      status: 'already_active',
      subscription: existingSubscription,
      supportThread: null,
      endsAt: existingSubscription?.endsAt ?? null,
    };
  }

  if (user.role !== USER_ROLES.member) {
    throw new Error('무료체험 신청은 일반회원 계정으로만 가능합니다.');
  }

  const endsAt = addUtcDays(input.requestedAt, FREE_TRIAL_DURATION_DAYS);
  const subscription: SubscriptionRecord = {
    id: existingSubscription?.id ?? await repository.nextId('sub'),
    userId: user.id,
    planId: null,
    status: SUBSCRIPTION_STATUSES.trialActive,
    startsAt: input.requestedAt,
    endsAt,
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: existingSubscription?.createdAt ?? input.requestedAt,
    updatedAt: input.requestedAt,
  };

  await repository.saveSubscription(subscription);
  await createAsyncUserNotification(repository, {
    userId: user.id,
    category: 'subscription',
    title: '무료체험이 시작되었습니다',
    body: `무료체험이 자동 접수되었습니다. ${FREE_TRIAL_DURATION_DAYS}일 동안 TC Chart와 핵심 시그널을 이용할 수 있습니다.`,
    linkUrl: '/chart',
    createdAt: input.requestedAt,
  });

  const supportResult = await createAsyncSupportThread(repository, {
    actor: input.actor,
    category: 'trial',
    title: '무료체험 신청',
    body: `무료체험이 자동 접수되었습니다. 종료 예정일: ${endsAt}`,
    visibility: 'private',
    createdAt: input.requestedAt,
  });

  return {
    status: 'started',
    subscription,
    supportThread: supportResult.thread,
    endsAt,
  };
}

export async function getAsyncUserDashboardSummary(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor },
): Promise<UserDashboardSummary> {
  await ensureAsyncRepositoryReferralCodes(repository);
  const user = await repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const [supportThreads, payments, notifications, access, subscription, referrals] = await Promise.all([
    repository.listSupportThreads(),
    repository.listPayments(),
    repository.listNotificationsByUserId(input.actor.id),
    getAsyncChartAccessSnapshot(repository, input.actor.id),
    repository.getSubscriptionByUserId(input.actor.id),
    getAsyncUserReferralSummary(repository, input.actor.id),
  ]);
  const visibleSupportThreads = supportThreads.filter((thread) => (
    thread.visibility === 'public' ||
    thread.authorUserId === input.actor.id ||
    input.actor.role === USER_ROLES.admin ||
    input.actor.role === USER_ROLES.superAdmin
  ));
  const visibleNotifications = notifications.filter(isVisibleNotification);

  return {
    user: toDashboardUserSummary(user),
    access,
    subscription,
    payments: payments
      .filter((payment) => payment.userId === input.actor.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    notifications: {
      totalCount: visibleNotifications.length,
      unreadCount: visibleNotifications.filter((notification) => !notification.readAt).length,
    },
    support: {
      visibleThreadCount: visibleSupportThreads.length,
      waitingThreadCount: visibleSupportThreads.filter((thread) => thread.status === 'waiting').length,
    },
    referrals,
  };
}

export async function updateAsyncAuthenticatedUserProfile(
  repository: AsyncChartServiceRepository,
  input: {
    actor: Actor;
    name: string;
    phoneNumber?: string | null;
    currentPassword?: string;
    newPassword?: string;
  },
): Promise<ServiceUserRecord> {
  const user = await repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const name = input.name.trim();
  if (!name) throw new Error('Profile name required');
  if (name.length > 80) throw new Error('Profile name too long');
  const phoneNumber = Object.hasOwn(input, 'phoneNumber')
    ? normalizeProfilePhoneNumber(input.phoneNumber)
    : user.phoneNumber;
  const passwordHash = getUpdatedPasswordHash(user, {
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });

  const updatedUser = {
    ...user,
    name,
    phoneNumber,
    passwordHash,
  };
  await repository.saveUser(updatedUser);
  return updatedUser;
}

export async function updateAsyncAuthenticatedUserProfileImage(
  repository: AsyncChartServiceRepository,
  input: {
    actor: Actor;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
  },
): Promise<ServiceUserRecord> {
  const user = await repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const policy = validateProfileImageUpload(input);
  if (!policy.ok) throw new Error(`Profile image policy failed: ${policy.reason}`);
  assertProfileImageDataUrl(input.dataUrl, input.mimeType);

  const updatedUser = {
    ...user,
    profileImageDataUrl: input.dataUrl,
  };
  await repository.saveUser(updatedUser);
  return updatedUser;
}

export async function withdrawAsyncAuthenticatedUserAccount(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; withdrawnAt: string },
): Promise<{ user: ServiceUserRecord; deletedSessionCount: number }> {
  const user = await repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);
  if (isAdminRole(user.role)) {
    throw new Error('Admin accounts cannot withdraw from profile');
  }

  const updatedUser: ServiceUserRecord = {
    ...user,
    accountStatus: USER_ACCOUNT_STATUSES.suspended,
    phoneNumber: null,
    passwordHash: null,
  };
  const sessions = await repository.listSessionsByUserId(user.id);
  await repository.saveUser(updatedUser);
  await Promise.all(sessions.map((session) => repository.deleteSession(session.id)));

  return { user: updatedUser, deletedSessionCount: sessions.length };
}

export async function createAsyncSessionForUser(
  repository: AsyncChartServiceRepository,
  input: { userId: string; createdAt: string; ttlSeconds?: number },
): Promise<{ session: AuthSessionRecord; cookie: string }> {
  const user = await requireAsyncUser(repository, input.userId);
  if (user.accountStatus === USER_ACCOUNT_STATUSES.suspended) {
    throw new Error('Account suspended');
  }

  const ttlSeconds = input.ttlSeconds ?? 60 * 60 * 24 * 7;
  const expiresAt = new Date(new Date(input.createdAt).getTime() + ttlSeconds * 1000).toISOString();
  const session: AuthSessionRecord = {
    id: await repository.nextId('session'),
    userId: input.userId,
    createdAt: input.createdAt,
    expiresAt,
  };

  await repository.saveSession(session);
  return {
    session,
    cookie: createSessionCookie(session.id, ttlSeconds, {
      userId: session.userId,
      expiresAt: session.expiresAt,
    }),
  };
}

export async function authenticateAsyncUserWithPassword(
  repository: AsyncChartServiceRepository,
  input: { email: string; password: string; createdAt: string; ttlSeconds?: number },
) {
  const email = input.email.trim().toLowerCase();
  const user = await repository.getUserByEmail(email);
  if (!user || !verifyPasswordHash(input.password, user.passwordHash)) {
    throw new Error('Invalid email or password');
  }

  const { session, cookie } = await createAsyncSessionForUser(repository, {
    userId: user.id,
    createdAt: input.createdAt,
    ttlSeconds: input.ttlSeconds,
  });
  return { user, session, cookie };
}

export async function registerAsyncMockUserAccount(
  repository: AsyncChartServiceRepository,
  input: {
    email: string;
    name: string;
    password: string;
    createdAt: string;
    referralCode?: string | null;
    phoneNumber?: string | null;
  },
) {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new Error('Invalid email');
  }
  const policy = validatePasswordPolicy(input.password);
  if (!policy.ok) {
    throw new Error(`Password policy failed: ${policy.missing.join(', ')}`);
  }
  if (await repository.getUserByEmail(email)) {
    throw new Error('Email already registered');
  }
  const referredByUserId = await getAsyncReferrerUserIdByReferralCode(repository, input.referralCode);

  const user: ServiceUserRecord = {
    id: await repository.nextId('user'),
    email,
    name: input.name.trim() || email,
    role: USER_ROLES.member,
    accountStatus: USER_ACCOUNT_STATUSES.active,
    phoneNumber: normalizeProfilePhoneNumber(input.phoneNumber),
    profileImageDataUrl: null,
    referralCode: '',
    referredByUserId,
    createdAt: input.createdAt,
    passwordHash: createPasswordHash(input.password),
  };
  user.referralCode = createUniqueRandomReferralCode((await repository.listUsers()).map((item) => item.referralCode));
  await repository.saveUser(user);
  const { session, cookie } = await createAsyncSessionForUser(repository, {
    userId: user.id,
    createdAt: input.createdAt,
  });
  return { user, session, cookie };
}

async function getAsyncReferrerUserIdByReferralCode(
  repository: AsyncChartServiceRepository,
  referralCode: string | null | undefined,
): Promise<string | null> {
  const normalizedReferralCode = normalizeSignupReferralCode(referralCode);
  if (!normalizedReferralCode) return null;

  const referrer = (await repository.listUsers())
    .find((user) => normalizeSignupReferralCode(user.referralCode) === normalizedReferralCode);
  if (!referrer) throw new Error('Referral code not found');

  return referrer.id;
}

function normalizeSignupReferralCode(value: string | null | undefined): string {
  return normalizeReferralCode(value);
}

function normalizeProfilePhoneNumber(value: string | null | undefined): string | null {
  const phoneNumber = String(value ?? '').trim();
  if (!phoneNumber) return null;
  if (phoneNumber.length > 30) throw new Error('Contact phone number too long');
  if (!/^[0-9+\-().\s]{7,30}$/.test(phoneNumber)) {
    throw new Error('Contact phone number invalid');
  }
  return phoneNumber;
}

function assertProfileImageDataUrl(dataUrl: string, mimeType: string): void {
  const prefix = `data:${mimeType.toLowerCase()};base64,`;
  if (!dataUrl.toLowerCase().startsWith(prefix)) {
    throw new Error('Profile image data URL invalid');
  }
  const encoded = dataUrl.slice(prefix.length);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Profile image data URL invalid');
  }
}

function getUpdatedPasswordHash(
  user: ServiceUserRecord,
  input: { currentPassword?: string; newPassword?: string },
): string | null {
  const newPassword = input.newPassword?.trim() ?? '';
  if (!newPassword) return user.passwordHash;

  if (!verifyPasswordHash(input.currentPassword ?? '', user.passwordHash)) {
    throw new Error('Current password is incorrect');
  }
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) {
    throw new Error(`Password policy failed: ${policy.missing.join(', ')}`);
  }
  return createPasswordHash(newPassword);
}

export async function createAsyncAuthenticatedManualPaymentRequest(
  repository: AsyncChartServiceRepository,
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
): Promise<{
  payment: PaymentRequestRecord;
  subscription: SubscriptionRecord;
  supportThread: SupportThreadRecord;
  supportMessage: SupportMessageRecord;
}> {
  const user = await requireAsyncUser(repository, input.actor.id);
  const plan = await repository.getPlanById(input.planId);
  if (!plan || !plan.isActive) {
    throw new Error(`Active plan not found: ${input.planId}`);
  }
  const subscriptionId = await repository.nextId('sub');
  const paymentId = await repository.nextId('pay');
  const supportThreadId = await repository.nextId('support');

  const subscription: SubscriptionRecord = {
    id: subscriptionId,
    userId: input.actor.id,
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
  const amountUsd = Math.round(plan.basePriceUsd * (1 - plan.discountPercent / 100) * 100) / 100;
  const transactionId = normalizePaymentTransactionId(input.method, input.transactionId);
  const depositorName = normalizePaymentDepositorName(input.method, input.depositorName);
  const { thread: supportThread, message: supportMessage } = createDepositSupportThreadDraft({
    threadId: supportThreadId,
    messageId: await repository.nextId('support_msg'),
    userId: input.actor.id,
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
    userId: input.actor.id,
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

  await repository.saveSubscription(subscription);
  await repository.saveSupportThread(supportThread);
  await repository.saveSupportMessage(supportMessage);
  await repository.savePayment(payment);
  const referralLedger = await createAsyncReferralLedgerForPayment(repository, {
    user,
    payment,
    createdAt: input.requestedAt,
  });
  if (referralLedger) await repository.saveReferralLedger(referralLedger);
  await notifyAsyncAdminsAboutSupportRequest(repository, {
    thread: supportThread,
    message: supportMessage,
    author: user,
    createdAt: input.requestedAt,
  });
  await createAsyncUserNotification(repository, {
    userId: payment.userId,
    category: 'payment',
    title: '입금확인 요청이 접수되었습니다',
    body: '관리자가 실제 입금 내역을 수동 확인한 뒤 구독 승인 단계로 진행합니다.',
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.requestedAt,
  });
  return { payment, subscription, supportThread, supportMessage };
}

export async function requestAsyncSubscriptionCancellation(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; requestedAt: string },
): Promise<SubscriptionRecord> {
  const subscription = await requireAsyncSubscriptionForUser(repository, input.actor.id);
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
  await repository.saveSubscription(requestedSubscription);
  return requestedSubscription;
}

export async function requestAsyncSubscriptionRefund(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; requestedAt: string },
): Promise<SubscriptionRecord> {
  const subscription = await requireAsyncSubscriptionForUser(repository, input.actor.id);
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
  await repository.saveSubscription(requestedSubscription);
  return requestedSubscription;
}

export async function listAsyncNotificationsForUser(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor },
): Promise<NotificationRecord[]> {
  return (await repository.listNotificationsByUserId(input.actor.id))
    .filter(isVisibleNotification)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAsyncNotificationSummaryForUser(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor },
): Promise<{ totalCount: number; unreadCount: number }> {
  const notifications = (await repository.listNotificationsByUserId(input.actor.id))
    .filter(isVisibleNotification);
  return {
    totalCount: notifications.length,
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
  };
}

export async function markAsyncNotificationReadForUser(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; notificationId: string; readAt: string },
): Promise<NotificationRecord> {
  const notification = (await repository.listNotificationsByUserId(input.actor.id))
    .filter(isVisibleNotification)
    .find((item) => item.id === input.notificationId);
  if (!notification) {
    throw new Error(`Notification not found: ${input.notificationId}`);
  }

  const readNotification = {
    ...notification,
    readAt: notification.readAt ?? input.readAt,
  };
  await repository.saveNotification(readNotification);
  return readNotification;
}

export async function archiveAsyncNotificationForUser(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; notificationId: string; archivedAt: string },
): Promise<NotificationRecord> {
  const notification = (await repository.listNotificationsByUserId(input.actor.id))
    .find((item) => item.id === input.notificationId);
  if (!notification) {
    throw new Error(`Notification not found: ${input.notificationId}`);
  }

  const archivedNotification = {
    ...notification,
    archivedAt: notification.archivedAt ?? input.archivedAt,
  };
  await repository.saveNotification(archivedNotification);
  return archivedNotification;
}

export async function markAllAsyncNotificationsReadForUser(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; readAt: string },
): Promise<{ updatedCount: number }> {
  const unreadNotifications = (await repository.listNotificationsByUserId(input.actor.id))
    .filter(isVisibleNotification)
    .filter((notification) => !notification.readAt);

  await Promise.all(unreadNotifications.map((notification) => repository.saveNotification({
    ...notification,
    readAt: input.readAt,
  })));
  return { updatedCount: unreadNotifications.length };
}

export async function createAsyncSupportThread(
  repository: AsyncChartServiceRepository,
  input: {
    actor: Actor;
    category: SupportCategory;
    title: string;
    body: string;
    visibility: SupportVisibility;
    createdAt: string;
  },
): Promise<{ thread: SupportThreadRecord; message: SupportMessageRecord }> {
  const author = await requireAsyncUser(repository, input.actor.id);
  if (input.category === 'trial' && input.actor.role !== USER_ROLES.member) {
    throw new Error('Trial request requires a member account');
  }
  if (!input.title.trim()) throw new Error('Support title required');
  if (!input.body.trim()) throw new Error('Support message required');

  const thread: SupportThreadRecord = {
    id: await repository.nextId('support'),
    authorUserId: input.actor.id,
    category: input.category,
    title: input.title.trim(),
    visibility: getAsyncSupportThreadVisibility(input.category, input.visibility),
    status: 'waiting',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  const message: SupportMessageRecord = {
    id: await repository.nextId('support_msg'),
    threadId: thread.id,
    authorUserId: input.actor.id,
    body: input.body.trim(),
    isAdminReply: false,
    createdAt: input.createdAt,
  };

  await repository.saveSupportThread(thread);
  await repository.saveSupportMessage(message);
  await notifyAsyncAdminsAboutSupportRequest(repository, {
    thread,
    message,
    author,
    createdAt: input.createdAt,
  });
  return { thread, message };
}

function getAsyncSupportThreadVisibility(
  category: SupportCategory,
  requestedVisibility: SupportVisibility,
): SupportVisibility {
  return category === 'deposit' ? 'private' : requestedVisibility;
}

export async function listAsyncVisibleSupportThreads(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor | null },
) {
  const threads = await repository.listSupportThreads();
  const visibleThreads = threads.filter((thread) => (
    thread.visibility === 'public' ||
    (input.actor && (
      input.actor.id === thread.authorUserId ||
      input.actor.role === USER_ROLES.admin ||
      input.actor.role === USER_ROLES.superAdmin
    ))
  ));
  const items = await Promise.all(visibleThreads.map(async (thread) => ({
    thread,
    author: toPublicActor(await repository.getUserById(thread.authorUserId)),
    messages: await repository.listSupportMessagesByThreadId(thread.id),
  })));

  return items.sort((a, b) => (
    new Date(b.thread.createdAt).getTime() - new Date(a.thread.createdAt).getTime() ||
    new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime()
  ));
}

export async function listAsyncAdminPaymentQueue(
  repository: AsyncChartServiceRepository,
): Promise<AdminPaymentQueueItem[]> {
  const payments = await repository.listPayments();
  const items = await Promise.all(payments.map(async (payment) => {
    const [user, plan, subscription] = await Promise.all([
      repository.getUserById(payment.userId),
      repository.getPlanById(payment.planId),
      repository.getSubscriptionById(payment.subscriptionId),
    ]);
    if (!user) return null;

    return {
      payment,
      user: toPublicServiceUserRecord(user),
      plan,
      subscription,
      supportThread: payment.supportThreadId ? await repository.getSupportThreadById(payment.supportThreadId) : null,
    };
  }));

  return items
    .filter((item): item is AdminPaymentQueueItem => item !== null)
    .sort((a, b) => new Date(b.payment.createdAt).getTime() - new Date(a.payment.createdAt).getTime());
}

export async function verifyAsyncPaymentTransactionId(
  repository: AsyncChartServiceRepository,
  input: {
    paymentId: string;
    admin: Actor;
    checkedAt: string;
    fetchTransaction?: (transactionId: string) => Promise<TronScanTransactionPayload>;
  },
): Promise<{ payment: PaymentRequestRecord }> {
  assertAdminActor(input.admin);
  const payment = await requireAsyncPayment(repository, input.paymentId);
  if (payment.method !== 'usdt') {
    throw new Error('Only USDT payments can be verified with TronScan');
  }
  if (!payment.transactionId) {
    throw new Error('USDT transaction id required');
  }

  const fetchTransaction = input.fetchTransaction ?? fetchTronScanTransaction;
  let result;
  try {
    const [settings, transactionPayload] = await Promise.all([
      getAsyncPaymentTransferSettingsForDisplay(repository),
      fetchTransaction(payment.transactionId),
    ]);
    result = verifyTronUsdtTransactionPayload({
      payment,
      expectedAddress: settings.usdtAddress,
      transactionPayload,
    });
  } catch (error) {
    result = createFailedTransactionVerificationResult(error);
  }

  const updatedPayment: PaymentRequestRecord = {
    ...payment,
    transactionVerificationStatus: result.status,
    transactionVerificationMessage: result.message,
    transactionVerifiedAt: input.checkedAt,
    updatedAt: input.checkedAt,
  };
  await repository.savePayment(updatedPayment);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.txid.verify',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment },
    afterJson: { payment: updatedPayment, verification: result },
  }));

  return { payment: updatedPayment };
}

export async function listAsyncAdminSubscriptionQueue(
  repository: AsyncChartServiceRepository,
): Promise<AdminSubscriptionQueueItem[]> {
  const [subscriptions, payments] = await Promise.all([
    repository.listSubscriptions(),
    repository.listPayments(),
  ]);
  const queueSubscriptions = subscriptions.filter((subscription) => (
    subscription.status === SUBSCRIPTION_STATUSES.cancelRequested ||
    subscription.status === SUBSCRIPTION_STATUSES.refundRequested ||
    subscription.status === SUBSCRIPTION_STATUSES.paymentPending ||
    subscription.status === SUBSCRIPTION_STATUSES.paymentRequested
  ));
  const items = await Promise.all(queueSubscriptions.map(async (subscription) => {
    const [user, plan] = await Promise.all([
      repository.getUserById(subscription.userId),
      subscription.planId ? repository.getPlanById(subscription.planId) : Promise.resolve(null),
    ]);
    if (!user) return null;

    return {
      subscription,
      user: toPublicServiceUserRecord(user),
      plan,
      payment: payments.find((payment) => payment.subscriptionId === subscription.id) ?? null,
    };
  }));

  return items
    .filter((item): item is AdminSubscriptionQueueItem => item !== null)
    .sort((a, b) => new Date(b.subscription.updatedAt).getTime() - new Date(a.subscription.updatedAt).getTime());
}

export async function getAsyncAdminDashboardSummary(
  repository: AsyncChartServiceRepository,
): Promise<AdminDashboardSummary> {
  const [
    users,
    payments,
    subscriptions,
    supportThreads,
    auditLogs,
    paymentQueue,
    subscriptionQueue,
  ] = await Promise.all([
    repository.listUsers(),
    repository.listPayments(),
    repository.listSubscriptions(),
    repository.listSupportThreads(),
    repository.listAuditLogs(),
    listAsyncAdminPaymentQueue(repository),
    listAsyncAdminSubscriptionQueue(repository),
  ]);

  return {
    users: {
      totalCount: users.length,
      activeCount: users.filter((user) => user.accountStatus === USER_ACCOUNT_STATUSES.active).length,
      suspendedCount: users.filter((user) => user.accountStatus === USER_ACCOUNT_STATUSES.suspended).length,
      adminCount: users.filter((user) => user.role === USER_ROLES.admin || user.role === USER_ROLES.superAdmin).length,
    },
    payments: {
      totalCount: payments.length,
      queueCount: paymentQueue.length,
      pendingCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.pending).length,
      confirmedCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.confirmed).length,
      refundedCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.refunded).length,
      rejectedCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.rejected).length,
    },
    subscriptions: {
      totalCount: subscriptions.length,
      queueCount: subscriptionQueue.length,
      activeCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.active).length,
      trialActiveCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.trialActive).length,
      paymentPendingCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.paymentPending).length,
      cancelRequestedCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.cancelRequested).length,
      refundRequestedCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.refundRequested).length,
    },
    support: {
      totalCount: supportThreads.length,
      waitingCount: supportThreads.filter((thread) => thread.status === 'waiting').length,
      answeredCount: supportThreads.filter((thread) => thread.status === 'answered').length,
      privateCount: supportThreads.filter((thread) => thread.visibility === 'private').length,
    },
    audit: {
      totalCount: auditLogs.length,
    },
  };
}

export async function getAsyncAdminAuditLogEntries(
  repository: AsyncChartServiceRepository,
  filter: AdminAuditLogFilter = {},
): Promise<AdminAuditLogEntry[]> {
  const actionQuery = filter.action?.trim().toLowerCase() ?? '';
  const targetType = filter.targetType?.trim().toLowerCase() ?? '';
  const targetId = filter.targetId?.trim().toLowerCase() ?? '';
  const auditLogs = await repository.listAuditLogs();
  const entries = await Promise.all(auditLogs.map(async (log, index) => ({
    sequence: index + 1,
    log: redactAuditLogSensitiveFields(log),
    actor: toPublicActor(await repository.getUserById(log.actorAdminId)),
  })));

  return entries
    .filter((entry) => !actionQuery || entry.log.action.toLowerCase().includes(actionQuery))
    .filter((entry) => !targetType || entry.log.targetType.toLowerCase() === targetType)
    .filter((entry) => !targetId || entry.log.targetId.toLowerCase() === targetId)
    .reverse();
}

export async function getAsyncAdminUserDirectory(
  repository: AsyncChartServiceRepository,
  input: AdminUserDirectoryInput = {},
): Promise<AdminUserDirectoryItem[]> {
  await ensureAsyncRepositoryReferralCodes(repository);
  const query = input.query?.trim().toLowerCase() ?? '';
  const role = input.role && input.role !== 'all' ? input.role : null;
  const accountStatus = input.accountStatus && input.accountStatus !== 'all'
    ? input.accountStatus
    : null;
  const users = await repository.listUsers();
  const filteredUsers = users
    .filter((user) => !role || user.role === role)
    .filter((user) => !accountStatus || user.accountStatus === accountStatus)
    .filter((user) => (
      !query ||
      user.email.toLowerCase().includes(query) ||
      user.name.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    ))
    .sort((a, b) => (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      a.email.localeCompare(b.email)
    ));

  return Promise.all(filteredUsers.map(async (user) => {
    const [payments, supportThreads, notifications, subscription, access] = await Promise.all([
      repository.listPayments(),
      repository.listSupportThreads(),
      repository.listNotificationsByUserId(user.id),
      repository.getSubscriptionByUserId(user.id),
      getAsyncChartAccessSnapshot(repository, user.id),
    ]);
    const userPayments = payments
      .filter((payment) => payment.userId === user.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return {
      user: toPublicServiceUserRecord(user),
      referrer: await getAsyncUserReferrer(repository, user, userPayments),
      subscription,
      access,
      latestPayment: userPayments[0] ?? null,
      paymentCount: userPayments.length,
      supportThreadCount: supportThreads
        .filter((thread) => thread.authorUserId === user.id)
        .length,
      unreadNotificationCount: notifications
        .filter(isVisibleNotification)
        .filter((notification) => !notification.readAt)
        .length,
    };
  }));
}

export async function getAsyncAdminUserDetail(
  repository: AsyncChartServiceRepository,
  userId: string,
): Promise<AdminUserDetail> {
  await ensureAsyncRepositoryReferralCodes(repository);
  const user = await requireAsyncUser(repository, userId);
  const [payments, supportThreads, notifications, subscription, auditEntries, referrals] = await Promise.all([
    repository.listPayments(),
    repository.listSupportThreads(),
    repository.listNotificationsByUserId(user.id),
    repository.getSubscriptionByUserId(user.id),
    getAsyncAdminAuditLogEntries(repository),
    getAsyncUserReferralSummary(repository, user.id),
  ]);
  const userPayments = payments
    .filter((payment) => payment.userId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const userSupportThreads = supportThreads
    .filter((thread) => thread.authorUserId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const relatedAuditEntries = auditEntries
    .filter((entry) => isUserRelatedAuditLog(entry.log, {
      userId: user.id,
      paymentIds: new Set(userPayments.map((payment) => payment.id)),
      subscriptionIds: new Set(subscription ? [subscription.id] : []),
      supportThreadIds: new Set(userSupportThreads.map((thread) => thread.id)),
    }))
    .slice(0, 8);

  return {
    user: toPublicServiceUserRecord(user),
    referrer: await getAsyncUserReferrer(repository, user, userPayments),
    subscription,
    access: await getAsyncChartAccessSnapshot(repository, user.id),
    latestPayment: userPayments[0] ?? null,
    paymentCount: userPayments.length,
    supportThreadCount: userSupportThreads.length,
    unreadNotificationCount: notifications
      .filter(isVisibleNotification)
      .filter((notification) => !notification.readAt)
      .length,
    payments: userPayments,
    supportThreads: userSupportThreads,
    notifications,
    auditEntries: relatedAuditEntries,
    referrals,
  };
}

export async function updateAsyncAdminUserRole(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; userId: string; role: UserRole },
): Promise<AdminUserDetail> {
  assertAdminActor(input.admin);
  const user = await requireAsyncUser(repository, input.userId);

  if (requiresSuperAdmin(input.role) || requiresSuperAdmin(user.role)) {
    assertSuperAdminActor(input.admin);
  }

  const updatedUser = {
    ...user,
    role: input.role,
  };
  await repository.saveUser(updatedUser);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.user.role.update',
    targetType: 'user',
    targetId: user.id,
    beforeJson: { user },
    afterJson: { user: updatedUser },
  }));

  return getAsyncAdminUserDetail(repository, user.id);
}

export async function updateAsyncAdminUserAccountStatus(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; userId: string; accountStatus: UserAccountStatus; reason: string },
): Promise<AdminUserDetail> {
  assertAdminActor(input.admin);
  const user = await requireAsyncUser(repository, input.userId);
  if (user.id === input.admin.id && input.accountStatus === USER_ACCOUNT_STATUSES.suspended) {
    throw new Error('Cannot suspend your own account');
  }
  if (requiresSuperAdmin(user.role)) {
    assertSuperAdminActor(input.admin);
  }

  const updatedUser = {
    ...user,
    accountStatus: input.accountStatus,
  };
  await repository.saveUser(updatedUser);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: input.accountStatus === USER_ACCOUNT_STATUSES.suspended
      ? 'admin.user.account.suspend'
      : 'admin.user.account.activate',
    targetType: 'user',
    targetId: user.id,
    beforeJson: { user },
    afterJson: { user: updatedUser, reason: input.reason.trim() },
  }));

  return getAsyncAdminUserDetail(repository, user.id);
}

export async function updateAsyncAdminUserEmail(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; userId: string; email: string },
): Promise<AdminUserDetail> {
  assertSuperAdminActor(input.admin);
  const user = await requireAsyncUser(repository, input.userId);

  const email = normalizeAdminUserEmail(input.email);
  const existingUser = await repository.getUserByEmail(email);
  if (existingUser && existingUser.id !== user.id) {
    throw new Error('Email already in use');
  }
  if (email === user.email) return getAsyncAdminUserDetail(repository, user.id);

  const updatedUser = {
    ...user,
    email,
  };
  await repository.saveUser(updatedUser);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.user.email.update',
    targetType: 'user',
    targetId: user.id,
    beforeJson: { user },
    afterJson: {
      user: updatedUser,
      previousEmail: user.email,
      nextEmail: email,
    },
  }));

  return getAsyncAdminUserDetail(repository, user.id);
}

export async function confirmAsyncManualPaymentRequest(
  repository: AsyncChartServiceRepository,
  input: { paymentId: string; admin: Actor; confirmedAt: string; adminNote?: string },
): Promise<{ payment: PaymentRequestRecord; subscription: SubscriptionRecord }> {
  assertAdminActor(input.admin);
  const adminNote = typeof input.adminNote === 'string' && input.adminNote.trim()
    ? input.adminNote.trim()
    : undefined;
  const payment = await requireAsyncPayment(repository, input.paymentId);
  const subscription = await requireAsyncSubscription(repository, payment.subscriptionId);

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

  await repository.savePayment(confirmedPayment);
  await repository.saveSubscription(approvalPendingSubscription);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.confirm',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: confirmedPayment, subscription: approvalPendingSubscription },
  }));
  await createAsyncUserNotification(repository, {
    userId: payment.userId,
    category: 'payment',
    title: '입금 확인이 완료되었습니다',
    body: adminNote ?? '입금 확인이 완료되었습니다. 관리자 구독 승인을 기다리는 중입니다.',
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.confirmedAt,
  });

  return { payment: confirmedPayment, subscription: approvalPendingSubscription };
}

export async function approveAsyncSubscriptionActivationRequest(
  repository: AsyncChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; approvedAt: string; adminNote?: string },
): Promise<SubscriptionRecord> {
  assertAdminActor(input.admin);
  const adminNote = typeof input.adminNote === 'string' && input.adminNote.trim()
    ? input.adminNote.trim()
    : undefined;
  const subscription = await requireAsyncSubscription(repository, input.subscriptionId);
  const plan = subscription.planId ? await repository.getPlanById(subscription.planId) : null;
  if (!plan) throw new Error(`Plan not found for subscription: ${subscription.id}`);
  const payment = (await repository.listPayments()).find((item) => item.subscriptionId === subscription.id);
  if (!payment || payment.status !== PAYMENT_STATUSES.confirmed) {
    throw new Error(`Confirmed payment required for subscription: ${subscription.id}`);
  }

  const activeSubscription = approveSubscription(subscription, {
    adminId: input.admin.id,
    approvedAt: input.approvedAt,
    durationDays: plan.durationDays,
  });

  await repository.saveSubscription(activeSubscription);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.activate.approve',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { payment, subscription },
    afterJson: { subscription: activeSubscription, adminNote },
  }));
  await createAsyncUserNotification(repository, {
    userId: subscription.userId,
    category: 'subscription',
    title: '구독이 활성화되었습니다',
    body: adminNote ?? '구독 승인이 완료되어 차트 서비스를 이용할 수 있습니다.',
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.approvedAt,
  });

  return activeSubscription;
}

export async function rejectAsyncManualPaymentRequest(
  repository: AsyncChartServiceRepository,
  input: { paymentId: string; admin: Actor; rejectedAt: string; adminNote: string },
): Promise<{ payment: PaymentRequestRecord; subscription: SubscriptionRecord }> {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const payment = await requireAsyncPayment(repository, input.paymentId);
  const subscription = await requireAsyncSubscription(repository, payment.subscriptionId);
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

  await repository.savePayment(rejectedPayment);
  await repository.saveSubscription(cancelledSubscription);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.reject_and_subscription.cancel',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: rejectedPayment, subscription: cancelledSubscription },
  }));
  await createAsyncUserNotification(repository, {
    userId: payment.userId,
    category: 'payment',
    title: '결제 요청이 반려되었습니다',
    body: adminNote,
    linkUrl: createProfilePaymentLink(payment.id),
    createdAt: input.rejectedAt,
  });

  return { payment: rejectedPayment, subscription: cancelledSubscription };
}

export async function refundAsyncManualPaymentAndSubscription(
  repository: AsyncChartServiceRepository,
  input: { paymentId: string; admin: Actor; refundedAt: string; adminNote: string },
): Promise<{ payment: PaymentRequestRecord; subscription: SubscriptionRecord; reversedReferralCount: number }> {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const payment = await requireAsyncPayment(repository, input.paymentId);
  const subscription = await requireAsyncSubscription(repository, payment.subscriptionId);
  const refundedPayment = refundPaymentRequest(payment, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
    adminNote,
  });
  const refundedSubscription = refundSubscription(subscription, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
  });
  const reversedLedgers = (await repository.listReferralLedgersByPaymentId(payment.id))
    .map((ledger) => reverseReferralLedger(ledger, input.refundedAt));

  await repository.savePayment(refundedPayment);
  await repository.saveSubscription(refundedSubscription);
  await Promise.all(reversedLedgers.map((ledger) => repository.saveReferralLedger(ledger)));
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'payment.refund_and_subscription.refund',
    targetType: 'payment_request',
    targetId: payment.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: refundedPayment, subscription: refundedSubscription, reversedLedgers },
  }));
  await createAsyncUserNotification(repository, {
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

export async function approveAsyncSubscriptionCancelRequest(
  repository: AsyncChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; cancelledAt: string; adminNote: string },
): Promise<SubscriptionRecord> {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const subscription = await requireAsyncSubscription(repository, input.subscriptionId);
  const cancelledSubscription = cancelSubscription(subscription, {
    adminId: input.admin.id,
    cancelledAt: input.cancelledAt,
  });

  await repository.saveSubscription(cancelledSubscription);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.cancel.approve',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { subscription },
    afterJson: { subscription: cancelledSubscription, adminNote },
  }));
  await createAsyncUserNotification(repository, {
    userId: subscription.userId,
    category: 'subscription',
    title: '구독 취소가 승인되었습니다',
    body: adminNote,
    linkUrl: '/pricing',
    createdAt: input.cancelledAt,
  });
  return cancelledSubscription;
}

export async function approveAsyncSubscriptionRefundRequest(
  repository: AsyncChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; refundedAt: string; adminNote: string },
): Promise<{ payment: PaymentRequestRecord; subscription: SubscriptionRecord; reversedReferralCount: number }> {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const subscription = await requireAsyncSubscription(repository, input.subscriptionId);
  const payment = (await repository.listPayments()).find((item) => item.subscriptionId === subscription.id);
  if (!payment) throw new Error(`Payment not found for subscription: ${subscription.id}`);

  const refundedPayment = refundPaymentRequest(payment, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
    adminNote,
  });
  const refundedSubscription = refundSubscription(subscription, {
    adminId: input.admin.id,
    refundedAt: input.refundedAt,
  });
  const reversedLedgers = (await repository.listReferralLedgersByPaymentId(payment.id))
    .map((ledger) => reverseReferralLedger(ledger, input.refundedAt));

  await repository.savePayment(refundedPayment);
  await repository.saveSubscription(refundedSubscription);
  await Promise.all(reversedLedgers.map((ledger) => repository.saveReferralLedger(ledger)));
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.refund.approve',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { payment, subscription },
    afterJson: { payment: refundedPayment, subscription: refundedSubscription, reversedLedgers },
  }));
  await createAsyncUserNotification(repository, {
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

export async function rejectAsyncSubscriptionRequest(
  repository: AsyncChartServiceRepository,
  input: { subscriptionId: string; admin: Actor; rejectedAt: string; adminNote: string },
): Promise<SubscriptionRecord> {
  assertAdminActor(input.admin);
  const adminNote = requireAdminNote(input.adminNote);
  const subscription = await requireAsyncSubscription(repository, input.subscriptionId);
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
  await repository.saveSubscription(activeSubscription);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'subscription.request.reject',
    targetType: 'subscription',
    targetId: subscription.id,
    beforeJson: { subscription },
    afterJson: { subscription: activeSubscription, adminNote },
  }));
  await createAsyncUserNotification(repository, {
    userId: subscription.userId,
    category: 'subscription',
    title: '구독 요청이 반려되었습니다',
    body: adminNote,
    linkUrl: '/pricing',
    createdAt: input.rejectedAt,
  });

  return activeSubscription;
}

export async function replyAsyncToSupportThreadAsAdmin(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; threadId: string; body: string; createdAt: string },
): Promise<{ thread: SupportThreadRecord; message: SupportMessageRecord }> {
  assertAdminActor(input.admin);
  const thread = await repository.getSupportThreadById(input.threadId);
  if (!thread) throw new Error(`Support thread not found: ${input.threadId}`);
  if (!input.body.trim()) throw new Error('Support reply required');

  const answeredThread: SupportThreadRecord = {
    ...thread,
    status: 'answered',
    updatedAt: input.createdAt,
  };
  const message: SupportMessageRecord = {
    id: await repository.nextId('support_msg'),
    threadId: thread.id,
    authorUserId: input.admin.id,
    body: input.body.trim(),
    isAdminReply: true,
    createdAt: input.createdAt,
  };

  await repository.saveSupportThread(answeredThread);
  await repository.saveSupportMessage(message);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'support.reply.created',
    targetType: 'support_thread',
    targetId: thread.id,
    beforeJson: { thread },
    afterJson: { thread: answeredThread, message },
  }));
  await createAsyncUserNotification(repository, {
    userId: thread.authorUserId,
    category: 'support_reply',
    title: '고객센터 답변이 등록되었습니다',
    body: input.body.trim(),
    linkUrl: createSupportThreadLink(thread.id),
    createdAt: input.createdAt,
  });

  return { thread: answeredThread, message };
}

export async function updateAsyncSupportThread(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; threadId: string; title: string; body: string; updatedAt: string },
): Promise<{ thread: SupportThreadRecord; message: SupportMessageRecord }> {
  const thread = await requireAsyncSupportThread(repository, input.threadId);
  assertCanManageAsyncSupportThread(input.actor, thread, 'update');
  if (!input.title.trim()) throw new Error('Support title required');
  if (!input.body.trim()) throw new Error('Support message required');

  const message = await requireAsyncEditableSupportThreadMessage(repository, thread);
  const updatedThread: SupportThreadRecord = {
    ...thread,
    title: input.title.trim(),
    updatedAt: input.updatedAt,
  };
  const updatedMessage: SupportMessageRecord = {
    ...message,
    body: input.body.trim(),
  };

  await repository.saveSupportThread(updatedThread);
  await repository.saveSupportMessage(updatedMessage);
  if (isAdminRole(input.actor.role)) {
    await repository.appendAuditLog(createAuditLogDraft({
      actor: input.actor,
      action: 'support.thread.updated',
      targetType: 'support_thread',
      targetId: thread.id,
      beforeJson: { thread, message },
      afterJson: { thread: updatedThread, message: updatedMessage },
    }));
  }

  return { thread: updatedThread, message: updatedMessage };
}

export async function deleteAsyncSupportThread(
  repository: AsyncChartServiceRepository,
  input: { actor: Actor; threadId: string; deletedAt: string },
): Promise<{ thread: SupportThreadRecord; messages: SupportMessageRecord[]; detachedPaymentIds: string[] }> {
  const thread = await requireAsyncSupportThread(repository, input.threadId);
  assertCanManageAsyncSupportThread(input.actor, thread, 'delete');
  const messages = await repository.listSupportMessagesByThreadId(thread.id);
  const detachedPaymentIds = await detachAsyncPaymentsFromSupportThread(repository, thread.id, input.deletedAt);

  if (isAdminRole(input.actor.role)) {
    await repository.appendAuditLog(createAuditLogDraft({
      actor: input.actor,
      action: 'support.thread.deleted',
      targetType: 'support_thread',
      targetId: thread.id,
      beforeJson: { thread, messages, detachedPaymentIds },
      afterJson: {
        thread: null,
        deletedAt: input.deletedAt,
        detachedPaymentIds,
      },
    }));
  }

  await deleteAsyncSupportMessagesByThreadId(repository, thread.id, messages);
  await repository.deleteSupportThread(thread.id);
  return { thread, messages, detachedPaymentIds };
}

export async function updateAsyncSupportMessageAsAdmin(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; messageId: string; threadId?: string; body: string; updatedAt: string },
): Promise<{ thread: SupportThreadRecord; message: SupportMessageRecord }> {
  assertAdminActor(input.admin);
  const message = await requireAsyncSupportMessage(repository, input.messageId, input.threadId);
  if (!message.isAdminReply) throw new Error('Only admin replies can be updated');
  if (!input.body.trim()) throw new Error('Support reply required');
  const thread = await requireAsyncSupportThread(repository, message.threadId);
  const updatedThread: SupportThreadRecord = {
    ...thread,
    updatedAt: input.updatedAt,
  };
  const updatedMessage: SupportMessageRecord = {
    ...message,
    body: input.body.trim(),
  };

  await repository.saveSupportThread(updatedThread);
  await repository.saveSupportMessage(updatedMessage);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'support.reply.updated',
    targetType: 'support_thread',
    targetId: thread.id,
    beforeJson: { thread, message },
    afterJson: { thread: updatedThread, message: updatedMessage },
  }));

  return { thread: updatedThread, message: updatedMessage };
}

export async function deleteAsyncSupportMessageAsAdmin(
  repository: AsyncChartServiceRepository,
  input: { admin: Actor; messageId: string; threadId?: string; deletedAt: string },
): Promise<{ thread: SupportThreadRecord; message: SupportMessageRecord }> {
  assertAdminActor(input.admin);
  const message = await requireAsyncSupportMessage(repository, input.messageId, input.threadId);
  if (!message.isAdminReply) throw new Error('Only admin replies can be deleted');
  const thread = await requireAsyncSupportThread(repository, message.threadId);
  const remainingMessages = (await repository.listSupportMessagesByThreadId(thread.id))
    .filter((item) => item.id !== message.id);
  const updatedThread: SupportThreadRecord = {
    ...thread,
    status: remainingMessages.some((item) => item.isAdminReply) ? 'answered' : 'waiting',
    updatedAt: input.deletedAt,
  };

  await deleteAsyncSupportMessage(repository, message);
  await repository.saveSupportThread(updatedThread);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'support.reply.deleted',
    targetType: 'support_thread',
    targetId: thread.id,
    beforeJson: { thread, message },
    afterJson: { thread: updatedThread },
  }));

  return { thread: updatedThread, message };
}

function toPublicActor(user: ServiceUserRecord | null) {
  return user ? toPublicServiceUserRecord(user) : null;
}

function addUtcDays(isoDate: string, days: number): string {
  const next = new Date(isoDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

async function createAsyncUserNotification(
  repository: AsyncChartServiceRepository,
  input: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    linkUrl?: string | null;
    createdAt: string;
  },
) {
  const user = await repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);

  const notification = {
    id: await repository.nextId('notification'),
    userId: input.userId,
    category: input.category,
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl ?? null,
    readAt: null,
    archivedAt: null,
    createdAt: input.createdAt,
  };
  await repository.saveNotification(notification);
  return notification;
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

async function requireAsyncUser(repository: AsyncChartServiceRepository, userId: string): Promise<ServiceUserRecord> {
  const user = await repository.getUserById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  return user;
}

async function requireAsyncSupportThread(
  repository: AsyncChartServiceRepository,
  threadId: string,
): Promise<SupportThreadRecord> {
  const thread = await repository.getSupportThreadById(threadId);
  if (!thread) throw new Error(`Support thread not found: ${threadId}`);
  return thread;
}

async function requireAsyncSupportMessage(
  repository: AsyncChartServiceRepository,
  messageId: string,
  threadId?: string,
): Promise<SupportMessageRecord> {
  const message = typeof repository.getSupportMessageById === 'function'
    ? await repository.getSupportMessageById(messageId)
    : null;
  if (message) return message;
  if (threadId) {
    const threadMessages = await repository.listSupportMessagesByThreadId(threadId);
    const threadMessage = threadMessages.find((item) => item.id === messageId) ?? null;
    if (threadMessage) return threadMessage;
  }
  throw new Error(`Support message not found: ${messageId}`);
}

async function deleteAsyncSupportMessage(
  repository: AsyncChartServiceRepository,
  message: SupportMessageRecord,
): Promise<void> {
  if (typeof repository.deleteSupportMessage === 'function') {
    await repository.deleteSupportMessage(message.id);
    return;
  }

  const threadMessages = await repository.listSupportMessagesByThreadId(message.threadId);
  await deleteAsyncSupportMessagesByThreadId(repository, message.threadId, threadMessages);
  await Promise.all(
    threadMessages
      .filter((item) => item.id !== message.id)
      .map((item) => repository.saveSupportMessage(item)),
  );
}

async function deleteAsyncSupportMessagesByThreadId(
  repository: AsyncChartServiceRepository,
  threadId: string,
  knownMessages?: SupportMessageRecord[],
): Promise<void> {
  if (typeof repository.deleteSupportMessagesByThreadId === 'function') {
    await repository.deleteSupportMessagesByThreadId(threadId);
    return;
  }

  if (typeof repository.deleteSupportMessage === 'function') {
    const messages = knownMessages ?? await repository.listSupportMessagesByThreadId(threadId);
    await Promise.all(messages.map((message) => repository.deleteSupportMessage(message.id)));
    return;
  }

  throw new Error(
    'Support message delete repository capability missing: deleteSupportMessagesByThreadId or deleteSupportMessage',
  );
}

async function requireAsyncEditableSupportThreadMessage(
  repository: AsyncChartServiceRepository,
  thread: SupportThreadRecord,
): Promise<SupportMessageRecord> {
  const messages = await repository.listSupportMessagesByThreadId(thread.id);
  const message = messages.find((item) => item.authorUserId === thread.authorUserId)
    ?? messages.find((item) => !item.isAdminReply);
  if (!message) throw new Error(`Support editable message not found: ${thread.id}`);
  return message;
}

function assertCanManageAsyncSupportThread(
  actor: Actor,
  thread: SupportThreadRecord,
  operation: 'update' | 'delete',
): void {
  if (actor.id === thread.authorUserId || isAdminRole(actor.role)) return;
  throw new Error(`Support thread ${operation} not allowed`);
}

function isAdminRole(role: UserRole): boolean {
  return role === USER_ROLES.admin || role === USER_ROLES.superAdmin;
}

async function detachAsyncPaymentsFromSupportThread(
  repository: AsyncChartServiceRepository,
  threadId: string,
  updatedAt: string,
): Promise<string[]> {
  const linkedPayments = (await repository.listPayments()).filter((payment) => payment.supportThreadId === threadId);
  await Promise.all(linkedPayments.map((payment) => repository.savePayment({
    ...payment,
    supportThreadId: null,
    updatedAt,
  })));
  return linkedPayments.map((payment) => payment.id);
}

async function requireAsyncPayment(
  repository: AsyncChartServiceRepository,
  paymentId: string,
): Promise<PaymentRequestRecord> {
  const payment = await repository.getPaymentById(paymentId);
  if (!payment) throw new Error(`Payment not found: ${paymentId}`);
  return payment;
}

async function requireAsyncSubscription(
  repository: AsyncChartServiceRepository,
  subscriptionId: string,
): Promise<SubscriptionRecord> {
  const subscription = await repository.getSubscriptionById(subscriptionId);
  if (!subscription) throw new Error(`Subscription not found: ${subscriptionId}`);
  return subscription;
}

async function requireAsyncSubscriptionForUser(
  repository: AsyncChartServiceRepository,
  userId: string,
): Promise<SubscriptionRecord> {
  await requireAsyncUser(repository, userId);
  const subscription = await repository.getSubscriptionByUserId(userId);
  if (!subscription) throw new Error(`Subscription not found for user: ${userId}`);
  return subscription;
}

function requireAdminNote(adminNote: string): string {
  const normalizedNote = adminNote.trim();
  if (!normalizedNote) throw new Error('Admin note required');
  return normalizedNote;
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

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];

function requiresSuperAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

function normalizeAdminUserEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Valid email required');
  }
  return email;
}

function isVisibleNotification(notification: NotificationRecord): boolean {
  return !notification.archivedAt;
}

async function getAsyncUserReferrer(
  repository: AsyncChartServiceRepository,
  user: ServiceUserRecord,
  userPayments: PaymentRequestRecord[],
): Promise<PublicServiceUserRecord | null> {
  const directReferrer = user.referredByUserId
    ? await repository.getUserById(user.referredByUserId)
    : null;
  if (directReferrer) return toPublicServiceUserRecord(directReferrer);

  for (const payment of userPayments) {
    const ledgers = await repository.listReferralLedgersByPaymentId(payment.id);
    const referralLedger = ledgers.find((ledger) => ledger.referredUserId === user.id);
    if (!referralLedger) continue;

    const ledgerReferrer = await repository.getUserById(referralLedger.referrerUserId);
    if (ledgerReferrer) return toPublicServiceUserRecord(ledgerReferrer);
  }

  return null;
}

function isUserRelatedAuditLog(
  log: AuditLogDraft,
  targets: {
    userId: string;
    paymentIds: Set<string>;
    subscriptionIds: Set<string>;
    supportThreadIds: Set<string>;
  },
): boolean {
  if (log.targetType === 'user') return log.targetId === targets.userId;
  if (log.targetType === 'payment_request') return targets.paymentIds.has(log.targetId);
  if (log.targetType === 'subscription') return targets.subscriptionIds.has(log.targetId);
  if (log.targetType === 'support_thread') return targets.supportThreadIds.has(log.targetId);
  return false;
}
