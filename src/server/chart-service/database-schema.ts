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
        phone_number: { type: 'text', nullable: true },
        referral_code: { type: 'text' },
        referred_by_user_id: { type: 'text', nullable: true, references: 'users.id' },
        created_at: { type: 'timestamptz', default: 'now()' },
      },
      indexes: [
        { name: 'idx_users_email', columns: ['email'] },
        { name: 'idx_users_role', columns: ['role'] },
        { name: 'idx_users_referral_code', columns: ['referral_code'] },
        { name: 'idx_users_referred_by_user_id', columns: ['referred_by_user_id'] },
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
      name: 'payment_requests',
      columns: {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'text', references: 'users.id' },
        plan_id: { type: 'text', references: 'subscription_plans.id' },
        subscription_id: { type: 'text', references: 'subscriptions.id' },
        support_thread_id: { type: 'text', nullable: true, references: 'support_threads.id' },
        method: { type: 'text' },
        amount_usd: { type: 'numeric(12,2)' },
        amount_krw: { type: 'integer', nullable: true },
        exchange_rate: { type: 'numeric(12,4)', nullable: true },
        referral_points_used: { type: 'numeric(12,2)', default: '0' },
        status: { type: 'text' },
        depositor_name: { type: 'text', nullable: true },
        transaction_id: { type: 'text', nullable: true },
        transaction_verification_status: {
          type: 'text',
          default: "'unchecked'",
          check: "transaction_verification_status in ('unchecked', 'verified', 'mismatch', 'failed')",
        },
        transaction_verification_message: { type: 'text', nullable: true },
        transaction_verified_at: { type: 'timestamptz', nullable: true },
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
        { name: 'idx_payment_requests_support_thread_id', columns: ['support_thread_id'] },
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
      name: 'referral_program_settings',
      columns: {
        id: { type: 'text', primaryKey: true },
        reward_percent: {
          type: 'numeric(5,2)',
          default: '10',
          check: 'reward_percent >= 0 and reward_percent <= 100',
        },
        updated_by_admin_id: { type: 'text', nullable: true, references: 'users.id' },
        updated_at: { type: 'timestamptz', default: 'now()' },
      },
    },
    {
      name: 'sales_teams',
      columns: {
        id: { type: 'text', primaryKey: true },
        name: { type: 'text' },
        commission_percent: {
          type: 'numeric(5,2)',
          default: '30',
          check: 'commission_percent >= 0 and commission_percent <= 100',
        },
        salesperson_ids: { type: 'jsonb', default: "'[]'::jsonb" },
        created_at: { type: 'timestamptz', default: 'now()' },
        updated_at: { type: 'timestamptz', default: 'now()' },
        updated_by_admin_id: { type: 'text', nullable: true, references: 'users.id' },
      },
      indexes: [
        { name: 'idx_sales_teams_updated_by_admin_id', columns: ['updated_by_admin_id'] },
      ],
    },
    {
      name: 'payment_transfer_settings',
      columns: {
        id: { type: 'text', primaryKey: true },
        bank_name: { type: 'text' },
        bank_account_number: { type: 'text' },
        bank_account_holder: { type: 'text' },
        bank_logo_url: { type: 'text' },
        usdt_address: { type: 'text' },
        usdt_network: { type: 'text' },
        updated_by_admin_id: { type: 'text', nullable: true, references: 'users.id' },
        updated_at: { type: 'timestamptz', default: 'now()' },
      },
      indexes: [
        { name: 'idx_payment_transfer_settings_updated_by_admin_id', columns: ['updated_by_admin_id'] },
      ],
    },
    {
      name: 'web_info_settings',
      columns: {
        id: { type: 'text', primaryKey: true },
        terms_content: { type: 'text' },
        privacy_content: { type: 'text' },
        updated_by_admin_id: { type: 'text', nullable: true, references: 'users.id' },
        updated_at: { type: 'timestamptz', default: 'now()' },
      },
      indexes: [
        { name: 'idx_web_info_settings_updated_by_admin_id', columns: ['updated_by_admin_id'] },
      ],
    },
    {
      name: 'signup_agreements',
      columns: {
        id: { type: 'text', primaryKey: true },
        user_id: { type: 'text', references: 'users.id' },
        terms_accepted_at: { type: 'timestamptz' },
        privacy_accepted_at: { type: 'timestamptz' },
        terms_content: { type: 'text' },
        privacy_content: { type: 'text' },
        terms_settings_updated_at: { type: 'timestamptz' },
        privacy_settings_updated_at: { type: 'timestamptz' },
        ip_address: { type: 'text', nullable: true },
        user_agent: { type: 'text', nullable: true },
        created_at: { type: 'timestamptz', default: 'now()' },
      },
      indexes: [
        { name: 'idx_signup_agreements_user_id', columns: ['user_id'] },
        { name: 'idx_signup_agreements_created_at', columns: ['created_at'] },
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
    'alter table if exists payment_requests add column if not exists support_thread_id text;',
    'alter table if exists payment_requests add column if not exists transaction_id text;',
    "alter table if exists payment_requests add column if not exists transaction_verification_status text;",
    "alter table if exists payment_requests add column if not exists transaction_verification_message text;",
    'alter table if exists payment_requests add column if not exists transaction_verified_at timestamptz;',
    "update payment_requests set transaction_verification_status = 'unchecked' where transaction_verification_status is null or transaction_verification_status = '';",
    'create index if not exists idx_payment_requests_support_thread_id on payment_requests (support_thread_id);',
    'alter table if exists users add column if not exists phone_number text;',
    'alter table if exists users add column if not exists referral_code text;',
    'alter table if exists users add column if not exists referred_by_user_id text;',
    'alter table if exists users add column if not exists created_at timestamptz;',
    "update users set referral_code = upper(substr(md5(id), 1, 6)) where referral_code is null or referral_code = '' or referral_code !~ '^[A-Z0-9]{6}$';",
    'update users set created_at = now() where created_at is null;',
    'create index if not exists idx_users_referral_code on users (referral_code);',
    'create index if not exists idx_users_referred_by_user_id on users (referred_by_user_id);',
    'create table if not exists referral_program_settings (id text primary key, reward_percent numeric(5,2) not null default 10, updated_by_admin_id text, updated_at timestamptz not null default now());',
    'alter table if exists referral_program_settings add column if not exists reward_percent numeric(5,2);',
    'alter table if exists referral_program_settings add column if not exists updated_by_admin_id text;',
    'alter table if exists referral_program_settings add column if not exists updated_at timestamptz;',
    "insert into referral_program_settings (id, reward_percent, updated_at) values ('default', 10, now()) on conflict (id) do nothing;",
    "create table if not exists sales_teams (id text primary key, name text not null, commission_percent numeric(5,2) not null default 30, salesperson_ids jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by_admin_id text);",
    'alter table if exists sales_teams add column if not exists name text;',
    'alter table if exists sales_teams add column if not exists commission_percent numeric(5,2);',
    "alter table if exists sales_teams add column if not exists salesperson_ids jsonb;",
    'alter table if exists sales_teams add column if not exists created_at timestamptz;',
    'alter table if exists sales_teams add column if not exists updated_at timestamptz;',
    'alter table if exists sales_teams add column if not exists updated_by_admin_id text;',
    "update sales_teams set salesperson_ids = '[]'::jsonb where salesperson_ids is null;",
    'create index if not exists idx_sales_teams_updated_by_admin_id on sales_teams (updated_by_admin_id);',
    "create table if not exists payment_transfer_settings (id text primary key, bank_name text not null, bank_account_number text not null, bank_account_holder text not null, bank_logo_url text not null default '/bank-logos/generic-bank.svg', usdt_address text not null, usdt_network text not null, updated_by_admin_id text, updated_at timestamptz not null default now());",
    'alter table if exists payment_transfer_settings add column if not exists bank_name text;',
    'alter table if exists payment_transfer_settings add column if not exists bank_account_number text;',
    'alter table if exists payment_transfer_settings add column if not exists bank_account_holder text;',
    "alter table if exists payment_transfer_settings add column if not exists bank_logo_url text;",
    'alter table if exists payment_transfer_settings add column if not exists usdt_address text;',
    'alter table if exists payment_transfer_settings add column if not exists usdt_network text;',
    'alter table if exists payment_transfer_settings add column if not exists updated_by_admin_id text;',
    'alter table if exists payment_transfer_settings add column if not exists updated_at timestamptz;',
    "update payment_transfer_settings set bank_logo_url = '/bank-logos/generic-bank.svg' where bank_logo_url is null or bank_logo_url = '';",
    'create index if not exists idx_payment_transfer_settings_updated_by_admin_id on payment_transfer_settings (updated_by_admin_id);',
    "create table if not exists web_info_settings (id text primary key, terms_content text not null, privacy_content text not null, updated_by_admin_id text, updated_at timestamptz not null default now());",
    'alter table if exists web_info_settings add column if not exists terms_content text;',
    'alter table if exists web_info_settings add column if not exists privacy_content text;',
    'alter table if exists web_info_settings add column if not exists updated_by_admin_id text;',
    'alter table if exists web_info_settings add column if not exists updated_at timestamptz;',
    "insert into web_info_settings (id, terms_content, privacy_content, updated_at) values ('default', 'TC Chart 서비스 이용약관', 'TC Chart 개인정보보호정책', now()) on conflict (id) do nothing;",
    'create index if not exists idx_web_info_settings_updated_by_admin_id on web_info_settings (updated_by_admin_id);',
    'create table if not exists signup_agreements (id text primary key, user_id text not null, terms_accepted_at timestamptz not null, privacy_accepted_at timestamptz not null, terms_content text not null, privacy_content text not null, terms_settings_updated_at timestamptz not null, privacy_settings_updated_at timestamptz not null, ip_address text, user_agent text, created_at timestamptz not null default now());',
    'alter table if exists signup_agreements add column if not exists user_id text;',
    'alter table if exists signup_agreements add column if not exists terms_accepted_at timestamptz;',
    'alter table if exists signup_agreements add column if not exists privacy_accepted_at timestamptz;',
    'alter table if exists signup_agreements add column if not exists terms_content text;',
    'alter table if exists signup_agreements add column if not exists privacy_content text;',
    'alter table if exists signup_agreements add column if not exists terms_settings_updated_at timestamptz;',
    'alter table if exists signup_agreements add column if not exists privacy_settings_updated_at timestamptz;',
    'alter table if exists signup_agreements add column if not exists ip_address text;',
    'alter table if exists signup_agreements add column if not exists user_agent text;',
    'alter table if exists signup_agreements add column if not exists created_at timestamptz;',
    'create index if not exists idx_signup_agreements_user_id on signup_agreements (user_id);',
    'create index if not exists idx_signup_agreements_created_at on signup_agreements (created_at);',
  ];
}

function renderColumn(name: string, column: DatabaseColumn): string {
  const parts = [`  ${name}`, column.type];
  if (column.primaryKey) parts.push('primary key');
  if (!column.nullable && !column.primaryKey) parts.push('not null');
  if (column.default) parts.push(`default ${column.default}`);
  return parts.join(' ');
}
