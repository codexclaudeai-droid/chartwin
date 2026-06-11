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
  mapChartUserSettingsFromPostgresRow,
  mapChartUserSettingsToPostgresRow,
  mapEmailOutboxFromPostgresRow,
  mapEmailOutboxToPostgresRow,
  mapEmailVerificationTokenFromPostgresRow,
  mapEmailVerificationTokenToPostgresRow,
  mapFreeTrialPolicySettingsFromPostgresRow,
  mapFreeTrialPolicySettingsToPostgresRow,
  mapFreeTrialUsageRecordFromPostgresRow,
  mapFreeTrialUsageRecordToPostgresRow,
  mapFreeTrialUserAllowanceFromPostgresRow,
  mapFreeTrialUserAllowanceToPostgresRow,
  mapNotificationFromPostgresRow,
  mapNotificationToPostgresRow,
  mapPasswordResetTokenFromPostgresRow,
  mapPasswordResetTokenToPostgresRow,
  mapPaymentFromPostgresRow,
  mapPaymentToPostgresRow,
  mapPaymentTransferSettingsFromPostgresRow,
  mapPaymentTransferSettingsToPostgresRow,
  mapNoticePopupFromPostgresRow,
  mapNoticePopupToPostgresRow,
  mapPlanFromPostgresRow,
  mapPlanToPostgresRow,
  mapPushSubscriptionFromPostgresRow,
  mapPushSubscriptionToPostgresRow,
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
  mapSignalAdminSettingsFromPostgresRow,
  mapSignalAdminSettingsToPostgresRow,
  mapSocialAuthAccountFromPostgresRow,
  mapSocialAuthAccountToPostgresRow,
  mapSubscriptionFromPostgresRow,
  mapSubscriptionToPostgresRow,
  mapSupportMessageFromPostgresRow,
  mapSupportMessageToPostgresRow,
  mapSupportThreadFromPostgresRow,
  mapSupportThreadToPostgresRow,
  mapTelegramBotProfileFromPostgresRow,
  mapTelegramBotProfileToPostgresRow,
  mapTelegramDeliveryLogFromPostgresRow,
  mapTelegramDeliveryLogToPostgresRow,
  mapUserFromPostgresRow,
  mapUserToPostgresRow,
  mapWebInfoSettingsFromPostgresRow,
  mapWebInfoSettingsToPostgresRow,
  type PostgresRow,
  type PostgresStatement,
} from './postgres-mappers.ts';
import type {
  AuthSessionRecord,
  ChartUserSettingsRecord,
  EmailOutboxFilter,
  EmailOutboxRecord,
  EmailVerificationTokenRecord,
  FreeTrialPolicySettingsRecord,
  FreeTrialUsageRecord,
  FreeTrialUserAllowanceRecord,
  PasswordResetTokenRecord,
  PaymentTransferSettingsRecord,
  NoticePopupRecord,
  PurgedUnverifiedUserAccountRecord,
  PublicBoardPostRecord,
  PushSubscriptionRecord,
  ReferralProgramSettingsRecord,
  SalesTeamRecord,
  ServiceUserRecord,
  SignupAgreementRecord,
  SignalAdminSettingsRecord,
  SocialAuthAccountRecord,
  SocialAuthProvider,
  TelegramBotProfileRecord,
  TelegramDeliveryLogRecord,
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
  let telegramAlertTablesReady = false;
  const ensureTelegramAlertTables = async (): Promise<void> => {
    if (telegramAlertTablesReady) return;
    for (const sql of TELEGRAM_ALERT_TABLE_STATEMENTS) {
      await executor.query({ sql, values: [] });
    }
    telegramAlertTablesReady = true;
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
    async purgeUnverifiedUserByEmail(email: string): Promise<PurgedUnverifiedUserAccountRecord | null> {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await selectOne('users', mapUserFromPostgresRow, { email: normalizedEmail });
      if (!user) return null;

      const sessions = await selectMany('auth_sessions', mapAuthSessionFromPostgresRow, { user_id: user.id });
      const emailOutbox = (await selectMany('email_outbox', mapEmailOutboxFromPostgresRow))
        .filter((record) => record.recipientEmail.toLowerCase() === normalizedEmail);
      const supportThreads = await selectMany('support_threads', mapSupportThreadFromPostgresRow, {
        author_user_id: user.id,
      });

      await execute(createPostgresDeleteStatement('auth_sessions', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('social_auth_accounts', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('password_reset_tokens', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('email_verification_tokens', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('push_subscriptions', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('email_outbox', { recipient_email: normalizedEmail }));
      await execute(createPostgresDeleteStatement('signup_agreements', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('chart_user_settings', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('notifications', { user_id: user.id }));
      await execute({
        sql: [
          'delete from referral_ledgers',
          'where referrer_user_id = $1',
          'or referred_user_id = $1',
          'or payment_request_id in (select id from payment_requests where user_id = $1)',
        ].join(' '),
        values: [user.id],
      });
      await execute(createPostgresDeleteStatement('payment_requests', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('free_trial_usage_records', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('free_trial_user_allowances', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('subscriptions', { user_id: user.id }));
      await execute(createPostgresDeleteStatement('support_messages', { author_user_id: user.id }));
      for (const thread of supportThreads) {
        await execute(createPostgresDeleteStatement('support_messages', { thread_id: thread.id }));
      }
      await execute(createPostgresDeleteStatement('support_threads', { author_user_id: user.id }));
      await execute(createPostgresDeleteStatement('users', { id: user.id }));

      return {
        user,
        deletedSessionCount: sessions.length,
        deletedEmailOutboxCount: emailOutbox.length,
      };
    },
    async getSocialAuthAccount(
      provider: SocialAuthProvider,
      providerUserId: string,
    ): Promise<SocialAuthAccountRecord | null> {
      return selectOne('social_auth_accounts', mapSocialAuthAccountFromPostgresRow, {
        provider,
        provider_user_id: providerUserId,
      });
    },
    async listSocialAuthAccountsByUserId(userId: string): Promise<SocialAuthAccountRecord[]> {
      return selectMany('social_auth_accounts', mapSocialAuthAccountFromPostgresRow, { user_id: userId });
    },
    async saveSocialAuthAccount(account: SocialAuthAccountRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'social_auth_accounts',
        mapSocialAuthAccountToPostgresRow(account),
        ['provider', 'provider_user_id'],
      ));
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
    async listPushSubscriptionsByUserId(userId: string): Promise<PushSubscriptionRecord[]> {
      return selectMany('push_subscriptions', mapPushSubscriptionFromPostgresRow, { user_id: userId });
    },
    async savePushSubscription(subscription: PushSubscriptionRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'push_subscriptions',
        mapPushSubscriptionToPostgresRow(subscription),
        ['endpoint'],
      ));
    },
    async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
      await execute(createPostgresDeleteStatement('push_subscriptions', {
        user_id: userId,
        endpoint,
      }));
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
    async getEmailVerificationTokenByTokenHash(tokenHash: string): Promise<EmailVerificationTokenRecord | null> {
      return selectOne('email_verification_tokens', mapEmailVerificationTokenFromPostgresRow, { token_hash: tokenHash });
    },
    async saveEmailVerificationToken(token: EmailVerificationTokenRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'email_verification_tokens',
        mapEmailVerificationTokenToPostgresRow(token),
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
    async getFreeTrialPolicySettings(): Promise<FreeTrialPolicySettingsRecord | null> {
      return selectOne('free_trial_policy_settings', mapFreeTrialPolicySettingsFromPostgresRow, { id: 'default' });
    },
    async saveFreeTrialPolicySettings(settings: FreeTrialPolicySettingsRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'free_trial_policy_settings',
        mapFreeTrialPolicySettingsToPostgresRow(settings),
        ['id'],
      ));
    },
    async getFreeTrialUserAllowanceByUserId(userId: string): Promise<FreeTrialUserAllowanceRecord | null> {
      return selectOne('free_trial_user_allowances', mapFreeTrialUserAllowanceFromPostgresRow, { user_id: userId });
    },
    async saveFreeTrialUserAllowance(allowance: FreeTrialUserAllowanceRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'free_trial_user_allowances',
        mapFreeTrialUserAllowanceToPostgresRow(allowance),
        ['user_id'],
      ));
    },
    async listFreeTrialUsageRecordsByUserId(userId: string): Promise<FreeTrialUsageRecord[]> {
      return selectMany('free_trial_usage_records', mapFreeTrialUsageRecordFromPostgresRow, { user_id: userId }, {
        orderBy: ['created_at'],
        direction: 'desc',
      });
    },
    async saveFreeTrialUsageRecord(record: FreeTrialUsageRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'free_trial_usage_records',
        mapFreeTrialUsageRecordToPostgresRow(record),
        ['id'],
      ));
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
    async getChartUserSettings(userId: string): Promise<ChartUserSettingsRecord | null> {
      return selectOne('chart_user_settings', mapChartUserSettingsFromPostgresRow, { user_id: userId });
    },
    async saveChartUserSettings(settings: ChartUserSettingsRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'chart_user_settings',
        mapChartUserSettingsToPostgresRow(settings),
        ['user_id'],
      ));
    },
    async getSignalAdminSettings(id: string): Promise<SignalAdminSettingsRecord | null> {
      return selectOne('signal_admin_settings', mapSignalAdminSettingsFromPostgresRow, { id });
    },
    async saveSignalAdminSettings(settings: SignalAdminSettingsRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'signal_admin_settings',
        mapSignalAdminSettingsToPostgresRow(settings),
        ['id'],
      ));
    },
    async listTelegramBotProfiles(): Promise<TelegramBotProfileRecord[]> {
      await ensureTelegramAlertTables();
      return selectMany('telegram_bot_profiles', mapTelegramBotProfileFromPostgresRow, {}, {
        orderBy: ['created_at'],
        direction: 'asc',
      });
    },
    async getTelegramBotProfileById(id: string): Promise<TelegramBotProfileRecord | null> {
      await ensureTelegramAlertTables();
      return selectOne('telegram_bot_profiles', mapTelegramBotProfileFromPostgresRow, { id });
    },
    async saveTelegramBotProfile(profile: TelegramBotProfileRecord): Promise<void> {
      await ensureTelegramAlertTables();
      await execute(createPostgresUpsertStatement(
        'telegram_bot_profiles',
        mapTelegramBotProfileToPostgresRow(profile),
        ['id'],
      ));
    },
    async deleteTelegramBotProfile(id: string): Promise<void> {
      await ensureTelegramAlertTables();
      await execute(createPostgresDeleteStatement('telegram_bot_profiles', { id }));
    },
    async listTelegramDeliveryLogs(limit = 50): Promise<TelegramDeliveryLogRecord[]> {
      await ensureTelegramAlertTables();
      const logs = await selectMany('telegram_delivery_logs', mapTelegramDeliveryLogFromPostgresRow, {}, {
        orderBy: ['created_at'],
        direction: 'desc',
      });
      return logs.slice(0, Math.max(0, Math.floor(limit)));
    },
    async saveTelegramDeliveryLog(log: TelegramDeliveryLogRecord): Promise<void> {
      await ensureTelegramAlertTables();
      await execute(createPostgresUpsertStatement(
        'telegram_delivery_logs',
        mapTelegramDeliveryLogToPostgresRow(log),
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
    async listNoticePopups(): Promise<NoticePopupRecord[]> {
      return selectMany('notice_popups', mapNoticePopupFromPostgresRow, {}, {
        orderBy: ['sort_order', 'updated_at'],
        direction: 'asc',
      });
    },
    async saveNoticePopup(popup: NoticePopupRecord): Promise<void> {
      await execute(createPostgresUpsertStatement(
        'notice_popups',
        mapNoticePopupToPostgresRow(popup),
        ['id'],
      ));
    },
    async deleteNoticePopup(id: string): Promise<void> {
      await execute(createPostgresDeleteStatement('notice_popups', { id }));
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

const TELEGRAM_ALERT_TABLE_STATEMENTS = [
  `create table if not exists telegram_bot_profiles (
    id text primary key,
    name text,
    bot_token text,
    chat_id text,
    is_enabled boolean default true,
    event_types_json jsonb default '[]'::jsonb,
    strategy_ids_json jsonb default '[]'::jsonb,
    symbol_ids_json jsonb default '[]'::jsonb,
    timeframe_ids_json jsonb default '[]'::jsonb,
    last_tested_at timestamptz,
    last_test_status text,
    last_test_error text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    check (last_test_status is null or last_test_status in ('success', 'failed'))
  )`,
  'create index if not exists idx_telegram_bot_profiles_is_enabled on telegram_bot_profiles (is_enabled)',
  'create index if not exists idx_telegram_bot_profiles_updated_at on telegram_bot_profiles (updated_at)',
  `create table if not exists telegram_delivery_logs (
    id text primary key,
    profile_id text,
    event_type text,
    strategy_id text,
    symbol_id text,
    message text,
    status text,
    telegram_message_id text,
    error_message text,
    created_at timestamptz default now(),
    foreign key (profile_id) references telegram_bot_profiles(id),
    check (event_type in ('buy', 'sell', 'stop_loss', 'take_profit')),
    check (status in ('sent', 'failed'))
  )`,
  'create index if not exists idx_telegram_delivery_logs_profile_id on telegram_delivery_logs (profile_id)',
  'create index if not exists idx_telegram_delivery_logs_created_at on telegram_delivery_logs (created_at)',
  'create index if not exists idx_telegram_delivery_logs_symbol_id on telegram_delivery_logs (symbol_id)',
] as const;

function normalizeIdPrefix(prefix: string): string {
  const normalized = prefix.trim().replace(/[^a-z0-9_]/gi, '_');
  return normalized || 'id';
}
