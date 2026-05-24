export type DatabaseColumn = {
  type: string;
  nullable?: boolean;
  default?: string;
  primaryKey?: boolean;
  references?: string;
  check?: string;
};

export type DatabaseTable = {
  name: string;
  columns: Record<string, DatabaseColumn>;
  indexes?: Array<{
    name: string;
    columns: string[];
  }>;
};

export function getChartServiceDatabaseTables(): DatabaseTable[] {
  return [
    {
      name: 'users',
      columns: {
        id: { type: 'text', primaryKey: true },
        email: { type: 'text' },
        name: { type: 'text' },
        password_hash: { type: 'text' },
        role: { type: 'text', check: "role in ('guest', 'member', 'trial', 'subscriber', 'salesperson', 'admin', 'super_admin')" },
        account_status: {
          type: 'text',
          default: "'active'",
          check: "account_status in ('active', 'suspended')",
        },
      },
      indexes: [
        { name: 'idx_users_email', columns: ['email'] },
        { name: 'idx_users_role', columns: ['role'] },
      ],
    },
    {
      name: 'auth_sessions',
      columns: {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'text', references: 'users.id' },
        created_at: { type: 'timestamptz' },
        expires_at: { type: 'timestamptz' },
      },
      indexes: [
        { name: 'idx_auth_sessions_user_id', columns: ['user_id'] },
        { name: 'idx_auth_sessions_expires_at', columns: ['expires_at'] },
      ],
    },
    {
      name: 'password_reset_tokens',
      columns: {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'text', references: 'users.id' },
        token_hash: { type: 'text' },
        created_at: { type: 'timestamptz' },
        expires_at: { type: 'timestamptz' },
        used_at: { type: 'timestamptz', nullable: true },
      },
      indexes: [
        { name: 'idx_password_reset_tokens_token_hash', columns: ['token_hash'] },
        { name: 'idx_password_reset_tokens_user_id', columns: ['user_id'] },
      ],
    },
    {
      name: 'subscription_plans',
      columns: {
        id: { type: 'text', primaryKey: true },
        name: { type: 'text' },
        duration_days: { type: 'integer' },
        base_price_usd: { type: 'numeric(12,2)' },
        discount_percent: { type: 'numeric(5,2)' },
        is_active: { type: 'boolean', default: 'true' },
      },
    },
    {
      name: 'subscriptions',
      columns: {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'text', references: 'users.id' },
        plan_id: { type: 'text', nullable: true, references: 'subscription_plans.id' },
        status: { type: 'text' },
        starts_at: { type: 'timestamptz', nullable: true },
        ends_at: { type: 'timestamptz', nullable: true },
        approved_by_admin_id: { type: 'text', nullable: true, references: 'users.id' },
        approved_at: { type: 'timestamptz', nullable: true },
        cancelled_at: { type: 'timestamptz', nullable: true },
        refunded_at: { type: 'timestamptz', nullable: true },
        created_at: { type: 'timestamptz' },
        updated_at: { type: 'timestamptz' },
      },
      indexes: [
        { name: 'idx_subscriptions_user_id', columns: ['user_id'] },
        { name: 'idx_subscriptions_status', columns: ['status'] },
      ],
    },
    {
      name: 'payment_requests',
      columns: {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'text', references: 'users.id' },
        plan_id: { type: 'text', references: 'subscription_plans.id' },
        subscription_id: { type: 'text', references: 'subscriptions.id' },
        method: { type: 'text' },
        amount_usd: { type: 'numeric(12,2)' },
        amount_krw: { type: 'integer', nullable: true },
        exchange_rate: { type: 'numeric(12,4)', nullable: true },
        referral_points_used: { type: 'numeric(12,2)', default: '0' },
        status: { type: 'text' },
        depositor_name: { type: 'text', nullable: true },
        admin_note: { type: 'text', nullable: true },
        confirmed_by_admin_id: { type: 'text', nullable: true, references: 'users.id' },
        confirmed_at: { type: 'timestamptz', nullable: true },
        created_at: { type: 'timestamptz' },
        updated_at: { type: 'timestamptz' },
      },
      indexes: [
        { name: 'idx_payment_requests_user_id', columns: ['user_id'] },
        { name: 'idx_payment_requests_status', columns: ['status'] },
        { name: 'idx_payment_requests_subscription_id', columns: ['subscription_id'] },
      ],
    },
    {
      name: 'referral_ledgers',
      columns: {
        id: { type: 'text', primaryKey: true },
        referrer_user_id: { type: 'text', references: 'users.id' },
        referred_user_id: { type: 'text', references: 'users.id' },
        payment_request_id: { type: 'text', references: 'payment_requests.id' },
        amount_usd: { type: 'numeric(12,2)' },
        percent: { type: 'numeric(5,2)' },
        points: { type: 'numeric(12,2)' },
        status: { type: 'text' },
        confirm_after: { type: 'timestamptz' },
        confirmed_at: { type: 'timestamptz', nullable: true },
        reversed_at: { type: 'timestamptz', nullable: true },
        created_at: { type: 'timestamptz' },
      },
      indexes: [
        { name: 'idx_referral_ledgers_payment_request_id', columns: ['payment_request_id'] },
      ],
    },
    {
      name: 'support_threads',
      columns: {
        id: { type: 'text', primaryKey: true },
        author_user_id: { type: 'text', references: 'users.id' },
        category: { type: 'text' },
        title: { type: 'text' },
        visibility: { type: 'text' },
        status: { type: 'text' },
        created_at: { type: 'timestamptz' },
        updated_at: { type: 'timestamptz' },
      },
      indexes: [
        { name: 'idx_support_threads_author_user_id', columns: ['author_user_id'] },
        { name: 'idx_support_threads_status', columns: ['status'] },
      ],
    },
    {
      name: 'support_messages',
      columns: {
        id: { type: 'text', primaryKey: true },
        thread_id: { type: 'text', references: 'support_threads.id' },
        author_user_id: { type: 'text', references: 'users.id' },
        body: { type: 'text' },
        is_admin_reply: { type: 'boolean', default: 'false' },
        created_at: { type: 'timestamptz' },
      },
      indexes: [
        { name: 'idx_support_messages_thread_id', columns: ['thread_id'] },
      ],
    },
    {
      name: 'notifications',
      columns: {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'text', references: 'users.id' },
        category: { type: 'text' },
        title: { type: 'text' },
        body: { type: 'text' },
        link_url: { type: 'text', nullable: true },
        read_at: { type: 'timestamptz', nullable: true },
        archived_at: { type: 'timestamptz', nullable: true },
        created_at: { type: 'timestamptz' },
      },
      indexes: [
        { name: 'idx_notifications_user_id_read_at', columns: ['user_id', 'read_at'] },
        { name: 'idx_notifications_user_id_archived_at', columns: ['user_id', 'archived_at'] },
      ],
    },
    {
      name: 'email_outbox',
      columns: {
        id: { type: 'text', primaryKey: true },
        recipient_email: { type: 'text' },
        template: { type: 'text' },
        subject: { type: 'text' },
        body: { type: 'text' },
        status: { type: 'text', check: "status in ('queued', 'sent', 'failed')" },
        created_at: { type: 'timestamptz' },
        sent_at: { type: 'timestamptz', nullable: true },
        last_error: { type: 'text', nullable: true },
      },
      indexes: [
        { name: 'idx_email_outbox_status_created_at', columns: ['status', 'created_at'] },
      ],
    },
    {
      name: 'audit_logs',
      columns: {
        id: { type: 'bigserial', primaryKey: true },
        actor_admin_id: { type: 'text', references: 'users.id' },
        action: { type: 'text' },
        target_type: { type: 'text' },
        target_id: { type: 'text' },
        before_json: { type: 'jsonb' },
        after_json: { type: 'jsonb' },
        created_at: { type: 'timestamptz', default: 'now()' },
      },
      indexes: [
        { name: 'idx_audit_logs_actor_admin_id', columns: ['actor_admin_id'] },
        { name: 'idx_audit_logs_target', columns: ['target_type', 'target_id'] },
      ],
    },
  ];
}

export function renderChartServicePostgresSchema(): string {
  const statements = getChartServiceDatabaseTables().flatMap((table) => {
    const columnLines = Object.entries(table.columns).map(([name, column]) => renderColumn(name, column));
    const checks = Object.entries(table.columns)
      .filter(([, column]) => column.check)
      .map(([name, column]) => `  constraint chk_${table.name}_${name} check (${column.check})`);
    const foreignKeys = Object.entries(table.columns)
      .filter(([, column]) => column.references)
      .map(([name, column]) => {
        const [targetTable, targetColumn] = column.references!.split('.');
        return `  foreign key (${name}) references ${targetTable}(${targetColumn})`;
      });
    const tableSql = [
      `create table if not exists ${table.name} (`,
      [...columnLines, ...checks, ...foreignKeys].join(',\n'),
      ');',
    ].join('\n');
    const indexSql = (table.indexes ?? []).map((index) => (
      `create index if not exists ${index.name} on ${table.name} (${index.columns.join(', ')});`
    ));
    return [tableSql, ...indexSql];
  });

  return `${[...statements, ...getChartServiceSchemaUpgradeStatements()].join('\n\n')}\n`;
}

function getChartServiceSchemaUpgradeStatements(): string[] {
  return [
    'alter table if exists notifications add column if not exists archived_at timestamptz;',
  ];
}

function renderColumn(name: string, column: DatabaseColumn): string {
  const parts = [`  ${name}`, column.type];
  if (column.primaryKey) parts.push('primary key');
  if (!column.nullable && !column.primaryKey) parts.push('not null');
  if (column.default) parts.push(`default ${column.default}`);
  return parts.join(' ');
}
