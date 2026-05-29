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
  mapEmailOutboxFromPostgresRow,
  mapEmailOutboxToPostgresRow,
  mapNotificationFromPostgresRow,
  mapNotificationToPostgresRow,
  mapPasswordResetTokenFromPostgresRow,
  mapPasswordResetTokenToPostgresRow,
  mapPaymentFromPostgresRow,
  mapPaymentToPostgresRow,
  mapPaymentTransferSettingsFromPostgresRow,
  mapPaymentTransferSettingsToPostgresRow,
  mapPlanFromPostgresRow,
  mapPlanToPostgresRow,
  mapPublicBoardPostFromPostgresRow,
  mapPublicBoardPostToPostgresRow,
  mapReferralProgramSettingsFromPostgresRow,
  mapReferralProgramSettingsToPostgresRow,
  mapReferralLedgerFromPostgresRow,
  mapReferralLedgerToPostgresRow,
  mapSalesTeamFromPostgresRow,
  mapSalesTeamToPostgresRow,
  mapSignupAgreementFromPostgresRow,
  mapSignupAgreementToPostgresRow,
  mapSubscriptionFromPostgresRow,
  mapSubscriptionToPostgresRow,
  mapSupportMessageFromPostgresRow,
  mapSupportMessageToPostgresRow,
  mapSupportThreadFromPostgresRow,
  mapSupportThreadToPostgresRow,
  mapUserFromPostgresRow,
  mapUserToPostgresRow,
  mapWebInfoSettingsFromPostgresRow,
  mapWebInfoSettingsToPostgresRow,
  type PostgresRow,
  type PostgresStatement,
} from './postgres-mappers.ts';
import type {
  AuthSessionRecord,
  EmailOutboxFilter,
  EmailOutboxRecord,
  PasswordResetTokenRecord,
  PaymentTransferSettingsRecord,
  PublicBoardPostRecord,
  ReferralProgramSettingsRecord,
  SalesTeamRecord,
  ServiceUserRecord,
  SignupAgreementRecord,
  WebInfoSettingsRecord,
} from './repository.ts';

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
    async listSessionsByUserId(userId: string): Promise<AuthSessionRecord[]> {
      return selectMany('auth_sessions', mapAuthSessionFromPostgresRow, { user_id: userId });
    },
    async saveSession(session: AuthSessionRecord): Promise<void> {
      await execute(createPostgresUpsertStatement('auth_sessions', mapAuthSessionToPostgresRow(session), ['id']));
    },
    async deleteSession(id: string): Promise<void> {
      await execute(createPostgresDeleteStatement('auth_sessions', { id }));
    },
    async getPasswordResetTokenByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
      return selectOne('password_reset_tokens', mapPasswordResetTokenFromPostgresRow, { token_hash: tokenHash });
    },
    async savePasswordResetToken(token: PasswordResetTokenRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'password_reset_tokens',
        mapPasswordResetTokenToPostgresRow(token),
        ['id'],
      ));
    },
    async listEmailOutboxRecords(filter: EmailOutboxFilter = {}): Promise<EmailOutboxRecord[]> {
      return selectMany(
        'email_outbox',
        mapEmailOutboxFromPostgresRow,
        filter.status ? { status: filter.status } : {},
        { orderBy: ['created_at'], direction: 'asc' },
      );
    },
    async saveEmailOutboxRecord(record: EmailOutboxRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'email_outbox',
        mapEmailOutboxToPostgresRow(record),
        ['id'],
      ));
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
    async getReferralProgramSettings(): Promise<ReferralProgramSettingsRecord | null> {
      return selectOne('referral_program_settings', mapReferralProgramSettingsFromPostgresRow, { id: 'default' });
    },
    async saveReferralProgramSettings(settings: ReferralProgramSettingsRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'referral_program_settings',
        mapReferralProgramSettingsToPostgresRow(settings),
        ['id'],
      ));
    },
    async listSalesTeams(): Promise<SalesTeamRecord[]> {
      return selectMany('sales_teams', mapSalesTeamFromPostgresRow, {}, {
        orderBy: ['created_at'],
        direction: 'asc',
      });
    },
    async saveSalesTeam(team: SalesTeamRecord): Promise<void> {
      await execute(createPostgresUpsertStatement('sales_teams', mapSalesTeamToPostgresRow(team), ['id']));
    },
    async getPaymentTransferSettings(): Promise<PaymentTransferSettingsRecord | null> {
      return selectOne('payment_transfer_settings', mapPaymentTransferSettingsFromPostgresRow, { id: 'default' });
    },
    async savePaymentTransferSettings(settings: PaymentTransferSettingsRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'payment_transfer_settings',
        mapPaymentTransferSettingsToPostgresRow(settings),
        ['id'],
      ));
    },
    async getWebInfoSettings(): Promise<WebInfoSettingsRecord | null> {
      return selectOne('web_info_settings', mapWebInfoSettingsFromPostgresRow, { id: 'default' });
    },
    async saveWebInfoSettings(settings: WebInfoSettingsRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'web_info_settings',
        mapWebInfoSettingsToPostgresRow(settings),
        ['id'],
      ));
    },
    async listSignupAgreementsByUserId(userId: string): Promise<SignupAgreementRecord[]> {
      return selectMany('signup_agreements', mapSignupAgreementFromPostgresRow, { user_id: userId }, {
        orderBy: ['created_at'],
        direction: 'desc',
      });
    },
    async saveSignupAgreement(agreement: SignupAgreementRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'signup_agreements',
        mapSignupAgreementToPostgresRow(agreement),
        ['id'],
      ));
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
    async listPublicBoardPosts(): Promise<PublicBoardPostRecord[]> {
      return selectMany('public_board_posts', mapPublicBoardPostFromPostgresRow, {}, {
        orderBy: ['sort_order', 'updated_at'],
        direction: 'asc',
      });
    },
    async savePublicBoardPost(post: PublicBoardPostRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'public_board_posts',
        mapPublicBoardPostToPostgresRow(post),
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
    async deleteSupportThread(id: string): Promise<void> {
      await execute(createPostgresDeleteStatement('support_threads', { id }));
    },
    async getSupportMessageById(id: string): Promise<SupportMessageRecord | null> {
      return selectOne('support_messages', mapSupportMessageFromPostgresRow, { id });
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
    async deleteSupportMessage(id: string): Promise<void> {
      await execute(createPostgresDeleteStatement('support_messages', { id }));
    },
    async deleteSupportMessagesByThreadId(threadId: string): Promise<void> {
      await execute(createPostgresDeleteStatement('support_messages', { thread_id: threadId }));
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
