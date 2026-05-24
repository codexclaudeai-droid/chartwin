import type {
  AuditLogDraft,
  NotificationRecord,
  PaymentRequestRecord,
  ReferralLedgerRecord,
  SubscriptionRecord,
  SubscriptionPlan,
  SupportMessageRecord,
  SupportThreadRecord,
} from '../../domain/chart-service/index.ts';
import type {
  AuthSessionRecord,
  EmailOutboxRecord,
  PasswordResetTokenRecord,
  ServiceUserRecord,
} from './repository.ts';

export type PostgresRow = Record<string, unknown>;

export type PostgresStatement = {
  sql: string;
  values: unknown[];
};

export function mapUserFromPostgresRow(row: PostgresRow): ServiceUserRecord {
  const id = readString(row.id);

  return {
    id,
    email: readString(row.email),
    name: readString(row.name),
    passwordHash: readNullableString(row.password_hash),
    role: readString(row.role) as ServiceUserRecord['role'],
    accountStatus: readString(row.account_status) as ServiceUserRecord['accountStatus'],
    phoneNumber: readNullableString(row.phone_number),
    referralCode: readNullableString(row.referral_code) ?? createReferralCodeForUserId(id),
    referredByUserId: readNullableString(row.referred_by_user_id),
    createdAt: readNullableIsoString(row.created_at) ?? '1970-01-01T00:00:00.000Z',
  };
}

export function mapUserToPostgresRow(record: ServiceUserRecord): PostgresRow {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    password_hash: record.passwordHash,
    role: record.role,
    account_status: record.accountStatus,
    phone_number: record.phoneNumber,
    referral_code: record.referralCode,
    referred_by_user_id: record.referredByUserId,
    created_at: record.createdAt,
  };
}

export function mapAuthSessionFromPostgresRow(row: PostgresRow): AuthSessionRecord {
  return {
    id: readString(row.id),
    userId: readString(row.user_id),
    createdAt: readIsoString(row.created_at),
    expiresAt: readIsoString(row.expires_at),
  };
}

export function mapPlanFromPostgresRow(row: PostgresRow): SubscriptionPlan {
  return {
    id: readString(row.id),
    name: readString(row.name),
    durationDays: readNumber(row.duration_days),
    basePriceUsd: readNumber(row.base_price_usd),
    discountPercent: readNumber(row.discount_percent),
    isActive: readBoolean(row.is_active),
  };
}

export function mapPlanToPostgresRow(record: SubscriptionPlan): PostgresRow {
  return {
    id: record.id,
    name: record.name,
    duration_days: record.durationDays,
    base_price_usd: record.basePriceUsd,
    discount_percent: record.discountPercent,
    is_active: record.isActive,
  };
}

export function mapAuthSessionToPostgresRow(record: AuthSessionRecord): PostgresRow {
  return {
    id: record.id,
    user_id: record.userId,
    created_at: record.createdAt,
    expires_at: record.expiresAt,
  };
}

export function mapPasswordResetTokenFromPostgresRow(row: PostgresRow): PasswordResetTokenRecord {
  return {
    id: readString(row.id),
    userId: readString(row.user_id),
    tokenHash: readString(row.token_hash),
    createdAt: readIsoString(row.created_at),
    expiresAt: readIsoString(row.expires_at),
    usedAt: readNullableIsoString(row.used_at),
  };
}

export function mapPasswordResetTokenToPostgresRow(record: PasswordResetTokenRecord): PostgresRow {
  return {
    id: record.id,
    user_id: record.userId,
    token_hash: record.tokenHash,
    created_at: record.createdAt,
    expires_at: record.expiresAt,
    used_at: record.usedAt,
  };
}

export function mapEmailOutboxFromPostgresRow(row: PostgresRow): EmailOutboxRecord {
  return {
    id: readString(row.id),
    recipientEmail: readString(row.recipient_email),
    template: readString(row.template),
    subject: readString(row.subject),
    body: readString(row.body),
    status: readString(row.status) as EmailOutboxRecord['status'],
    createdAt: readIsoString(row.created_at),
    sentAt: readNullableIsoString(row.sent_at),
    lastError: readNullableString(row.last_error),
  };
}

export function mapEmailOutboxToPostgresRow(record: EmailOutboxRecord): PostgresRow {
  return {
    id: record.id,
    recipient_email: record.recipientEmail,
    template: record.template,
    subject: record.subject,
    body: record.body,
    status: record.status,
    created_at: record.createdAt,
    sent_at: record.sentAt,
    last_error: record.lastError,
  };
}

export function mapSubscriptionFromPostgresRow(row: PostgresRow): SubscriptionRecord {
  return {
    id: readString(row.id),
    userId: readString(row.user_id),
    planId: readNullableString(row.plan_id),
    status: readString(row.status) as SubscriptionRecord['status'],
    startsAt: readNullableIsoString(row.starts_at),
    endsAt: readNullableIsoString(row.ends_at),
    approvedByAdminId: readNullableString(row.approved_by_admin_id),
    approvedAt: readNullableIsoString(row.approved_at),
    cancelledAt: readNullableIsoString(row.cancelled_at),
    refundedAt: readNullableIsoString(row.refunded_at),
    createdAt: readIsoString(row.created_at),
    updatedAt: readIsoString(row.updated_at),
  };
}

export function mapSubscriptionToPostgresRow(record: SubscriptionRecord): PostgresRow {
  return {
    id: record.id,
    user_id: record.userId,
    plan_id: record.planId,
    status: record.status,
    starts_at: record.startsAt,
    ends_at: record.endsAt,
    approved_by_admin_id: record.approvedByAdminId,
    approved_at: record.approvedAt,
    cancelled_at: record.cancelledAt,
    refunded_at: record.refundedAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapPaymentFromPostgresRow(row: PostgresRow): PaymentRequestRecord {
  return {
    id: readString(row.id),
    userId: readString(row.user_id),
    planId: readString(row.plan_id),
    subscriptionId: readString(row.subscription_id),
    supportThreadId: readNullableString(row.support_thread_id),
    method: readString(row.method) as PaymentRequestRecord['method'],
    amountUsd: readNumber(row.amount_usd),
    amountKrw: readNullableNumber(row.amount_krw),
    exchangeRate: readNullableNumber(row.exchange_rate),
    referralPointsUsed: readNumber(row.referral_points_used),
    status: readString(row.status) as PaymentRequestRecord['status'],
    depositorName: readNullableString(row.depositor_name),
    adminNote: readNullableString(row.admin_note),
    confirmedByAdminId: readNullableString(row.confirmed_by_admin_id),
    confirmedAt: readNullableIsoString(row.confirmed_at),
    createdAt: readIsoString(row.created_at),
    updatedAt: readIsoString(row.updated_at),
  };
}

export function mapPaymentToPostgresRow(record: PaymentRequestRecord): PostgresRow {
  return {
    id: record.id,
    user_id: record.userId,
    plan_id: record.planId,
    subscription_id: record.subscriptionId,
    support_thread_id: record.supportThreadId,
    method: record.method,
    amount_usd: record.amountUsd,
    amount_krw: record.amountKrw,
    exchange_rate: record.exchangeRate,
    referral_points_used: record.referralPointsUsed,
    status: record.status,
    depositor_name: record.depositorName,
    admin_note: record.adminNote,
    confirmed_by_admin_id: record.confirmedByAdminId,
    confirmed_at: record.confirmedAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapReferralLedgerFromPostgresRow(row: PostgresRow): ReferralLedgerRecord {
  return {
    id: readString(row.id),
    referrerUserId: readString(row.referrer_user_id),
    referredUserId: readString(row.referred_user_id),
    paymentRequestId: readString(row.payment_request_id),
    amountUsd: readNumber(row.amount_usd),
    percent: readNumber(row.percent),
    points: readNumber(row.points),
    status: readString(row.status) as ReferralLedgerRecord['status'],
    confirmAfter: readIsoString(row.confirm_after),
    confirmedAt: readNullableIsoString(row.confirmed_at),
    reversedAt: readNullableIsoString(row.reversed_at),
    createdAt: readIsoString(row.created_at),
  };
}

export function mapReferralLedgerToPostgresRow(record: ReferralLedgerRecord): PostgresRow {
  return {
    id: record.id,
    referrer_user_id: record.referrerUserId,
    referred_user_id: record.referredUserId,
    payment_request_id: record.paymentRequestId,
    amount_usd: record.amountUsd,
    percent: record.percent,
    points: record.points,
    status: record.status,
    confirm_after: record.confirmAfter,
    confirmed_at: record.confirmedAt,
    reversed_at: record.reversedAt,
    created_at: record.createdAt,
  };
}

export function mapSupportThreadFromPostgresRow(row: PostgresRow): SupportThreadRecord {
  return {
    id: readString(row.id),
    authorUserId: readString(row.author_user_id),
    category: readString(row.category) as SupportThreadRecord['category'],
    title: readString(row.title),
    visibility: readString(row.visibility) as SupportThreadRecord['visibility'],
    status: readString(row.status) as SupportThreadRecord['status'],
    createdAt: readIsoString(row.created_at),
    updatedAt: readIsoString(row.updated_at),
  };
}

export function mapSupportThreadToPostgresRow(record: SupportThreadRecord): PostgresRow {
  return {
    id: record.id,
    author_user_id: record.authorUserId,
    category: record.category,
    title: record.title,
    visibility: record.visibility,
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapSupportMessageFromPostgresRow(row: PostgresRow): SupportMessageRecord {
  return {
    id: readString(row.id),
    threadId: readString(row.thread_id),
    authorUserId: readString(row.author_user_id),
    body: readString(row.body),
    isAdminReply: readBoolean(row.is_admin_reply),
    createdAt: readIsoString(row.created_at),
  };
}

export function mapSupportMessageToPostgresRow(record: SupportMessageRecord): PostgresRow {
  return {
    id: record.id,
    thread_id: record.threadId,
    author_user_id: record.authorUserId,
    body: record.body,
    is_admin_reply: record.isAdminReply,
    created_at: record.createdAt,
  };
}

export function mapNotificationFromPostgresRow(row: PostgresRow): NotificationRecord {
  return {
    id: readString(row.id),
    userId: readString(row.user_id),
    category: readString(row.category) as NotificationRecord['category'],
    title: readString(row.title),
    body: readString(row.body),
    linkUrl: readNullableString(row.link_url),
    readAt: readNullableIsoString(row.read_at),
    archivedAt: readNullableIsoString(row.archived_at),
    createdAt: readIsoString(row.created_at),
  };
}

export function mapNotificationToPostgresRow(record: NotificationRecord): PostgresRow {
  return {
    id: record.id,
    user_id: record.userId,
    category: record.category,
    title: record.title,
    body: record.body,
    link_url: record.linkUrl,
    read_at: record.readAt,
    archived_at: record.archivedAt,
    created_at: record.createdAt,
  };
}

export function mapAuditLogDraftToPostgresRow(record: AuditLogDraft): PostgresRow {
  return {
    actor_admin_id: record.actorAdminId,
    action: record.action,
    target_type: record.targetType,
    target_id: record.targetId,
    before_json: record.beforeJson,
    after_json: record.afterJson,
  };
}

export function mapAuditLogDraftFromPostgresRow(row: PostgresRow): AuditLogDraft {
  return {
    actorAdminId: readString(row.actor_admin_id),
    action: readString(row.action),
    targetType: readString(row.target_type),
    targetId: readString(row.target_id),
    beforeJson: row.before_json ?? null,
    afterJson: row.after_json ?? null,
  };
}

export function createPostgresInsertStatement(
  tableName: string,
  row: PostgresRow,
): PostgresStatement {
  assertSafeIdentifier(tableName);

  const columns = Object.keys(row);
  columns.forEach(assertSafeIdentifier);
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  return {
    sql: `insert into ${tableName} (${columns.join(', ')}) values (${placeholders.join(', ')})`,
    values: columns.map((column) => row[column]),
  };
}

export function createPostgresUpsertStatement(
  tableName: string,
  row: PostgresRow,
  conflictColumns: string[],
): PostgresStatement {
  assertSafeIdentifier(tableName);
  conflictColumns.forEach(assertSafeIdentifier);

  const columns = Object.keys(row);
  columns.forEach(assertSafeIdentifier);
  const values = columns.map((column) => row[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const updateSet = updateColumns.length > 0
    ? updateColumns.map((column) => `${column} = excluded.${column}`).join(', ')
    : columns.map((column) => `${column} = excluded.${column}`).join(', ');

  return {
    sql: [
      `insert into ${tableName} (${columns.join(', ')})`,
      `values (${placeholders.join(', ')})`,
      `on conflict (${conflictColumns.join(', ')}) do update set ${updateSet}`,
    ].join(' '),
    values,
  };
}

export function createPostgresSelectStatement(
  tableName: string,
  filters: PostgresRow = {},
  options: { orderBy?: string[]; direction?: 'asc' | 'desc' } = {},
): PostgresStatement {
  assertSafeIdentifier(tableName);
  const filterColumns = Object.keys(filters);
  filterColumns.forEach(assertSafeIdentifier);
  const orderColumns = options.orderBy ?? [];
  orderColumns.forEach(assertSafeIdentifier);

  const whereSql = filterColumns.length > 0
    ? ` where ${filterColumns.map((column, index) => `${column} = $${index + 1}`).join(' and ')}`
    : '';
  const orderSql = orderColumns.length > 0
    ? ` order by ${orderColumns.join(', ')} ${options.direction ?? 'asc'}`
    : '';

  return {
    sql: `select * from ${tableName}${whereSql}${orderSql}`,
    values: filterColumns.map((column) => filters[column]),
  };
}

export function createPostgresDeleteStatement(
  tableName: string,
  filters: PostgresRow,
): PostgresStatement {
  assertSafeIdentifier(tableName);
  const filterColumns = Object.keys(filters);
  filterColumns.forEach(assertSafeIdentifier);
  if (filterColumns.length === 0) {
    throw new Error('Refusing to create unfiltered postgres delete statement');
  }

  return {
    sql: `delete from ${tableName} where ${filterColumns.map((column, index) => `${column} = $${index + 1}`).join(' and ')}`,
    values: filterColumns.map((column) => filters[column]),
  };
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new Error('Expected non-null string-compatible postgres value');
}

function readNullableString(value: unknown): string | null {
  return value == null ? null : readString(value);
}

function readIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return readString(value);
}

function readNullableIsoString(value: unknown): string | null {
  return value == null ? null : readIsoString(value);
}

function readNumber(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error('Expected numeric postgres value');
  }
  return numberValue;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 't') return true;
  if (value === 'false' || value === 'f') return false;
  throw new Error('Expected boolean postgres value');
}

function readNullableNumber(value: unknown): number | null {
  return value == null ? null : readNumber(value);
}

function assertSafeIdentifier(identifier: string): void {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe postgres identifier: ${identifier}`);
  }
}

function createReferralCodeForUserId(userId: string): string {
  return `TC-${userId.replace(/[^a-z0-9]/gi, '').toUpperCase()}`;
}
