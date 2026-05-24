import { randomUUID } from 'node:crypto';
import type {
  AuditLogDraft,
  NotificationRecord,
  PaymentRequestRecord,
  ReferralLedgerRecord,
  SubscriptionPlan,
  SubscriptionRecord,
  SupportMessageRecord,
  SupportThreadRecord,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import {
  createPostgresDeleteStatement,
  createPostgresInsertStatement,
  createPostgresSelectStatement,
  createPostgresUpsertStatement,
  mapAuditLogDraftFromPostgresRow,
  mapAuditLogDraftToPostgresRow,
  mapAuthSessionFromPostgresRow,
  mapAuthSessionToPostgresRow,
  mapNotificationFromPostgresRow,
  mapNotificationToPostgresRow,
  mapPaymentFromPostgresRow,
  mapPaymentToPostgresRow,
  mapPlanFromPostgresRow,
  mapPlanToPostgresRow,
  mapReferralLedgerFromPostgresRow,
  mapReferralLedgerToPostgresRow,
  mapSubscriptionFromPostgresRow,
  mapSubscriptionToPostgresRow,
  mapSupportMessageFromPostgresRow,
  mapSupportMessageToPostgresRow,
  mapSupportThreadFromPostgresRow,
  mapSupportThreadToPostgresRow,
  mapUserFromPostgresRow,
  mapUserToPostgresRow,
  type PostgresRow,
  type PostgresStatement,
} from './postgres-mappers.ts';
import type { AuthSessionRecord, ServiceUserRecord } from './repository.ts';

export type PostgresQueryResult = {
  rows: PostgresRow[];
};

export type PostgresQueryExecutor = {
  query(statement: PostgresStatement): Promise<PostgresQueryResult>;
};

export type TransactionalPostgresQueryExecutor = PostgresQueryExecutor & {
  transaction<T>(operation: (executor: PostgresQueryExecutor) => Promise<T>): Promise<T>;
};

export function isTransactionalPostgresQueryExecutor(
  executor: PostgresQueryExecutor,
): executor is TransactionalPostgresQueryExecutor {
  return typeof (executor as Partial<TransactionalPostgresQueryExecutor>).transaction === 'function';
}

export function createPostgresAsyncChartServiceRepository(
  executor: PostgresQueryExecutor,
): AsyncChartServiceRepository {
  const queryRows = async (statement: PostgresStatement): Promise<PostgresRow[]> => (
    await executor.query(statement)
  ).rows;

  const selectMany = async <RecordType>(
    tableName: string,
    mapper: (row: PostgresRow) => RecordType,
    filters: PostgresRow = {},
    options: { orderBy?: string[]; direction?: 'asc' | 'desc' } = {},
  ): Promise<RecordType[]> => (
    await queryRows(createPostgresSelectStatement(tableName, filters, options))
  ).map(mapper);

  const selectOne = async <RecordType>(
    tableName: string,
    mapper: (row: PostgresRow) => RecordType,
    filters: PostgresRow,
    options: { orderBy?: string[]; direction?: 'asc' | 'desc' } = {},
  ): Promise<RecordType | null> => {
    const rows = await selectMany(tableName, mapper, filters, options);
    return rows[0] ?? null;
  };

  const execute = async (statement: PostgresStatement): Promise<void> => {
    await executor.query(statement);
  };

  return {
    async nextId(prefix: string): Promise<string> {
      return `${normalizeIdPrefix(prefix)}_${randomUUID()}`;
    },
    async listPlans(): Promise<SubscriptionPlan[]> {
      return selectMany('subscription_plans', mapPlanFromPostgresRow);
    },
    async getPlanById(id: string): Promise<SubscriptionPlan | null> {
      return selectOne('subscription_plans', mapPlanFromPostgresRow, { id });
    },
    async savePlan(plan: SubscriptionPlan): Promise<void> {
      await execute(createPostgresUpsertStatement('subscription_plans', mapPlanToPostgresRow(plan), ['id']));
    },
    async listUsers(): Promise<ServiceUserRecord[]> {
      return selectMany('users', mapUserFromPostgresRow);
    },
    async getUserById(id: string): Promise<ServiceUserRecord | null> {
      return selectOne('users', mapUserFromPostgresRow, { id });
    },
    async getUserByEmail(email: string): Promise<ServiceUserRecord | null> {
      const rows = await queryRows({
        sql: 'select * from users where lower(email) = lower($1)',
        values: [email],
      });
      return rows[0] ? mapUserFromPostgresRow(rows[0]) : null;
    },
    async saveUser(user: ServiceUserRecord): Promise<void> {
      await execute(createPostgresUpsertStatement('users', mapUserToPostgresRow(user), ['id']));
    },
    async getSessionById(id: string): Promise<AuthSessionRecord | null> {
      return selectOne('auth_sessions', mapAuthSessionFromPostgresRow, { id });
    },
    async saveSession(session: AuthSessionRecord): Promise<void> {
      await execute(createPostgresUpsertStatement('auth_sessions', mapAuthSessionToPostgresRow(session), ['id']));
    },
    async deleteSession(id: string): Promise<void> {
      await execute(createPostgresDeleteStatement('auth_sessions', { id }));
    },
    async getSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
      return selectOne('subscriptions', mapSubscriptionFromPostgresRow, { id });
    },
    async getSubscriptionByUserId(userId: string): Promise<SubscriptionRecord | null> {
      return selectOne('subscriptions', mapSubscriptionFromPostgresRow, { user_id: userId }, {
        orderBy: ['updated_at'],
        direction: 'desc',
      });
    },
    async listSubscriptions(): Promise<SubscriptionRecord[]> {
      return selectMany('subscriptions', mapSubscriptionFromPostgresRow);
    },
    async saveSubscription(subscription: SubscriptionRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'subscriptions',
        mapSubscriptionToPostgresRow(subscription),
        ['id'],
      ));
    },
    async getPaymentById(id: string): Promise<PaymentRequestRecord | null> {
      return selectOne('payment_requests', mapPaymentFromPostgresRow, { id });
    },
    async listPayments(): Promise<PaymentRequestRecord[]> {
      return selectMany('payment_requests', mapPaymentFromPostgresRow);
    },
    async savePayment(payment: PaymentRequestRecord): Promise<void> {
      await execute(createPostgresUpsertStatement('payment_requests', mapPaymentToPostgresRow(payment), ['id']));
    },
    async listReferralLedgersByPaymentId(paymentRequestId: string): Promise<ReferralLedgerRecord[]> {
      return selectMany('referral_ledgers', mapReferralLedgerFromPostgresRow, {
        payment_request_id: paymentRequestId,
      });
    },
    async saveReferralLedger(ledger: ReferralLedgerRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'referral_ledgers',
        mapReferralLedgerToPostgresRow(ledger),
        ['id'],
      ));
    },
    async getSupportThreadById(id: string): Promise<SupportThreadRecord | null> {
      return selectOne('support_threads', mapSupportThreadFromPostgresRow, { id });
    },
    async listSupportThreads(): Promise<SupportThreadRecord[]> {
      return selectMany('support_threads', mapSupportThreadFromPostgresRow);
    },
    async saveSupportThread(thread: SupportThreadRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'support_threads',
        mapSupportThreadToPostgresRow(thread),
        ['id'],
      ));
    },
    async listSupportMessagesByThreadId(threadId: string): Promise<SupportMessageRecord[]> {
      return selectMany('support_messages', mapSupportMessageFromPostgresRow, { thread_id: threadId });
    },
    async saveSupportMessage(message: SupportMessageRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'support_messages',
        mapSupportMessageToPostgresRow(message),
        ['id'],
      ));
    },
    async listNotificationsByUserId(userId: string): Promise<NotificationRecord[]> {
      return selectMany('notifications', mapNotificationFromPostgresRow, { user_id: userId });
    },
    async saveNotification(notification: NotificationRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'notifications',
        mapNotificationToPostgresRow(notification),
        ['id'],
      ));
    },
    async appendAuditLog(auditLog: AuditLogDraft): Promise<void> {
      await execute(createPostgresInsertStatement('audit_logs', mapAuditLogDraftToPostgresRow(auditLog)));
    },
    async listAuditLogs(): Promise<AuditLogDraft[]> {
      return selectMany('audit_logs', mapAuditLogDraftFromPostgresRow, {}, {
        orderBy: ['id'],
        direction: 'asc',
      });
    },
  };
}

function normalizeIdPrefix(prefix: string): string {
  const normalized = prefix.trim().replace(/[^a-z0-9_]/gi, '_');
  return normalized || 'id';
}
