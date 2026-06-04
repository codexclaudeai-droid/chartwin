import type {
  AuditLogDraft,
  NotificationRecord,
  PaymentRequestRecord,
  SubscriptionRecord,
  SupportThreadRecord,
  UserAccountStatus,
  UserRole,
} from '../../domain/chart-service/index.ts';
import {
  assertAdminActor,
  assertSuperAdminActor,
  createAuditLogDraft,
  USER_ACCOUNT_STATUSES,
} from '../../domain/chart-service/index.ts';
import type { Actor } from '../../domain/chart-service/index.ts';
import type {
  ChartServiceRepository,
  FreeTrialUsageRecord,
  FreeTrialUserAllowanceRecord,
  PublicServiceUserRecord,
  ServiceUserRecord,
} from './repository.ts';
import { getAdminAuditLogEntries, type AdminAuditLogEntry } from './admin-audit.ts';
import { getChartAccessSnapshot, type ChartAccessSnapshot } from './service.ts';
import { getUserReferralSummary, type UserReferralSummary } from './referral-program.ts';
import { ensureRepositoryReferralCodes } from './referral-codes.ts';
import { toPublicServiceUserRecord } from './user-serialization.ts';

export type AdminUserDirectoryItem = {
  user: PublicServiceUserRecord;
  referrer: PublicServiceUserRecord | null;
  subscription: SubscriptionRecord | null;
  access: ChartAccessSnapshot;
  latestPayment: PaymentRequestRecord | null;
  paymentCount: number;
  supportThreadCount: number;
  unreadNotificationCount: number;
};

export type AdminUserDirectoryInput = {
  query?: string;
  role?: UserRole | 'all';
  accountStatus?: UserAccountStatus | 'all';
};

export type AdminUserDetail = AdminUserDirectoryItem & {
  payments: PaymentRequestRecord[];
  supportThreads: SupportThreadRecord[];
  notifications: NotificationRecord[];
  auditEntries: AdminAuditLogEntry[];
  referrals: UserReferralSummary;
  freeTrial: {
    allowance: FreeTrialUserAllowanceRecord | null;
    usageRecords: FreeTrialUsageRecord[];
  };
};

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];

export function getAdminUserDirectory(
  repository: ChartServiceRepository,
  input: AdminUserDirectoryInput = {},
): AdminUserDirectoryItem[] {
  ensureRepositoryReferralCodes(repository);
  const query = input.query?.trim().toLowerCase() ?? '';
  const role = input.role && input.role !== 'all' ? input.role : null;
  const accountStatus = input.accountStatus && input.accountStatus !== 'all'
    ? input.accountStatus
    : null;

  return repository
    .listUsers()
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
    ))
    .map((user) => {
      const payments = repository
        .listPayments()
        .filter((payment) => payment.userId === user.id)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const notifications = repository.listNotificationsByUserId(user.id);

      return {
        user: toPublicServiceUserRecord(user),
        referrer: getUserReferrer(repository, user),
        subscription: repository.getSubscriptionByUserId(user.id),
        access: getChartAccessSnapshot(repository, user.id),
        latestPayment: payments[0] ?? null,
        paymentCount: payments.length,
        supportThreadCount: repository
          .listSupportThreads()
          .filter((thread) => thread.authorUserId === user.id)
          .length,
        unreadNotificationCount: notifications
          .filter(isVisibleNotification)
          .filter((notification) => !notification.readAt)
          .length,
      };
    });
}

export function getAdminUserDetail(
  repository: ChartServiceRepository,
  userId: string,
): AdminUserDetail {
  ensureRepositoryReferralCodes(repository);
  const user = repository.getUserById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);

  const payments = repository
    .listPayments()
    .filter((payment) => payment.userId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const supportThreads = repository
    .listSupportThreads()
    .filter((thread) => thread.authorUserId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const notifications = repository.listNotificationsByUserId(user.id);
  const subscription = repository.getSubscriptionByUserId(user.id);
  const auditEntries = getAdminAuditLogEntries(repository)
    .filter((entry) => isUserRelatedAuditLog(entry.log, {
      userId: user.id,
      paymentIds: new Set(payments.map((payment) => payment.id)),
      subscriptionIds: new Set(subscription ? [subscription.id] : []),
      supportThreadIds: new Set(supportThreads.map((thread) => thread.id)),
    }))
    .slice(0, 8);

  return {
    user: toPublicServiceUserRecord(user),
    referrer: getUserReferrer(repository, user),
    subscription,
    access: getChartAccessSnapshot(repository, user.id),
    latestPayment: payments[0] ?? null,
    paymentCount: payments.length,
    supportThreadCount: supportThreads.length,
    unreadNotificationCount: notifications
      .filter(isVisibleNotification)
      .filter((notification) => !notification.readAt)
      .length,
    payments,
    supportThreads,
    notifications,
    auditEntries,
    referrals: getUserReferralSummary(repository, user.id),
    freeTrial: {
      allowance: repository.getFreeTrialUserAllowanceByUserId(user.id),
      usageRecords: repository.listFreeTrialUsageRecordsByUserId(user.id),
    },
  };
}

function getUserReferrer(
  repository: ChartServiceRepository,
  user: ServiceUserRecord,
): PublicServiceUserRecord | null {
  const directReferrer = user.referredByUserId
    ? repository.getUserById(user.referredByUserId)
    : null;
  if (directReferrer) return toPublicServiceUserRecord(directReferrer);

  const referralLedger = repository
    .listPayments()
    .filter((payment) => payment.userId === user.id)
    .flatMap((payment) => repository.listReferralLedgersByPaymentId(payment.id))
    .find((ledger) => ledger.referredUserId === user.id);
  const ledgerReferrer = referralLedger
    ? repository.getUserById(referralLedger.referrerUserId)
    : null;

  return ledgerReferrer ? toPublicServiceUserRecord(ledgerReferrer) : null;
}

export function updateAdminUserRole(
  repository: ChartServiceRepository,
  input: { admin: Actor; userId: string; role: UserRole },
): AdminUserDetail {
  assertAdminActor(input.admin);
  const user = repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);

  if (requiresSuperAdmin(input.role) || requiresSuperAdmin(user.role)) {
    assertSuperAdminActor(input.admin);
  }

  const updatedUser = {
    ...user,
    role: input.role,
  };
  repository.saveUser(updatedUser);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.user.role.update',
    targetType: 'user',
    targetId: user.id,
    beforeJson: { user },
    afterJson: { user: updatedUser },
  }));

  return getAdminUserDetail(repository, user.id);
}

export function updateAdminUserAccountStatus(
  repository: ChartServiceRepository,
  input: { admin: Actor; userId: string; accountStatus: UserAccountStatus; reason: string },
): AdminUserDetail {
  assertAdminActor(input.admin);
  const user = repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);
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
  repository.saveUser(updatedUser);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: input.accountStatus === USER_ACCOUNT_STATUSES.suspended
      ? 'admin.user.account.suspend'
      : 'admin.user.account.activate',
    targetType: 'user',
    targetId: user.id,
    beforeJson: { user },
    afterJson: { user: updatedUser, reason: input.reason.trim() },
  }));

  return getAdminUserDetail(repository, user.id);
}

export function updateAdminUserEmail(
  repository: ChartServiceRepository,
  input: { admin: Actor; userId: string; email: string },
): AdminUserDetail {
  assertSuperAdminActor(input.admin);
  const user = repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);

  const email = normalizeAdminUserEmail(input.email);
  const existingUser = repository.getUserByEmail(email);
  if (existingUser && existingUser.id !== user.id) {
    throw new Error('Email already in use');
  }
  if (email === user.email) return getAdminUserDetail(repository, user.id);

  const updatedUser = {
    ...user,
    email,
  };
  repository.saveUser(updatedUser);
  repository.appendAuditLog(createAuditLogDraft({
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

  return getAdminUserDetail(repository, user.id);
}

export function updateAdminUserFreeTrialAllowance(
  repository: ChartServiceRepository,
  input: { admin: Actor; userId: string; remainingCount: number; note?: string; updatedAt: string },
): AdminUserDetail {
  assertAdminActor(input.admin);
  const user = repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);

  const before = repository.getFreeTrialUserAllowanceByUserId(user.id);
  const allowance = {
    userId: user.id,
    remainingCount: normalizeFreeTrialAllowanceCount(input.remainingCount),
    note: normalizeFreeTrialAllowanceNote(input.note),
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };
  repository.saveFreeTrialUserAllowance(allowance);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.user.free_trial_allowance.update',
    targetType: 'user',
    targetId: user.id,
    beforeJson: { allowance: before },
    afterJson: { allowance },
  }));

  return getAdminUserDetail(repository, user.id);
}

export function deleteAdminUserAccount(
  repository: ChartServiceRepository,
  input: { admin: Actor; userId: string; deletedAt: string },
): { user: ServiceUserRecord; deletedSessionCount: number; deletedEmailOutboxCount: number } {
  assertSuperAdminActor(input.admin);
  const user = repository.getUserById(input.userId);
  if (!user) throw new Error(`User not found: ${input.userId}`);
  if (user.id === input.admin.id) {
    throw new Error('Cannot delete your own account');
  }
  if (requiresSuperAdmin(user.role)) {
    throw new Error('Cannot delete an admin account');
  }

  const result = repository.purgeUnverifiedUserByEmail(user.email);
  if (!result) throw new Error('User delete failed');
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.user.delete',
    targetType: 'user',
    targetId: user.id,
    beforeJson: { user },
    afterJson: {
      deletedAt: input.deletedAt,
      hardDeleted: true,
      deletedSessionCount: result.deletedSessionCount,
      deletedEmailOutboxCount: result.deletedEmailOutboxCount,
    },
  }));

  return result;
}

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

function normalizeFreeTrialAllowanceCount(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Free trial allowance count must be a number');
  return Math.min(999, Math.max(0, Math.round(value)));
}

function normalizeFreeTrialAllowanceNote(value?: string): string | null {
  const note = value?.trim() ?? '';
  return note ? note.slice(0, 500) : null;
}

function isVisibleNotification(notification: NotificationRecord): boolean {
  return !notification.archivedAt;
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
