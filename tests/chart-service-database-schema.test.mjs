import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  getChartServiceDatabaseTables,
  renderChartServicePostgresSchema,
} from '../src/server/chart-service/index.ts';

test('chart service database schema covers repository-backed core tables', () => {
  const tables = getChartServiceDatabaseTables();
  const tableNames = tables.map((table) => table.name);

  assert.deepEqual(tableNames, [
    'users',
    'auth_sessions',
    'push_subscriptions',
    'social_auth_accounts',
    'password_reset_tokens',
    'email_verification_tokens',
    'subscription_plans',
    'subscriptions',
    'public_board_posts',
    'notice_popups',
    'support_threads',
    'support_messages',
    'payment_requests',
    'referral_ledgers',
    'referral_program_settings',
    'sales_teams',
    'free_trial_policy_settings',
    'free_trial_user_allowances',
    'free_trial_usage_records',
    'payment_transfer_settings',
    'web_info_settings',
    'chart_user_settings',
    'signal_admin_settings',
    'telegram_bot_profiles',
    'telegram_delivery_logs',
    'telegram_signal_watch_states',
    'signal_events',
    'signup_agreements',
    'market_candles',
    'notifications',
    'email_outbox',
    'audit_logs',
  ]);
  assert.equal(tables.find((table) => table.name === 'users')?.columns.account_status.type, 'text');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.password_hash.type, 'text');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.password_hash.nullable, true);
  assert.equal(tables.find((table) => table.name === 'users')?.columns.phone_number.nullable, true);
  assert.equal(tables.find((table) => table.name === 'users')?.columns.profile_image_data_url.nullable, true);
  assert.equal(tables.find((table) => table.name === 'users')?.columns.referral_code.type, 'text');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.referred_by_user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.created_at.type, 'timestamptz');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.email_verified_at.nullable, true);
  assert.equal(tables.find((table) => table.name === 'social_auth_accounts')?.columns.provider.type, 'text');
  assert.equal(tables.find((table) => table.name === 'social_auth_accounts')?.columns.provider_user_id.type, 'text');
  assert.equal(tables.find((table) => table.name === 'social_auth_accounts')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'social_auth_accounts')?.indexes?.find((index) => index.name === 'idx_social_auth_accounts_provider_user')?.unique, true);
  assert.equal(tables.find((table) => table.name === 'password_reset_tokens')?.columns.token_hash.type, 'text');
  assert.equal(tables.find((table) => table.name === 'password_reset_tokens')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'email_verification_tokens')?.columns.token_hash.type, 'text');
  assert.equal(tables.find((table) => table.name === 'email_verification_tokens')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'subscriptions')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.subscription_id.references, 'subscriptions.id');
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.support_thread_id.references, 'support_threads.id');
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.transaction_id.nullable, true);
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.transaction_verification_status.type, 'text');
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.transaction_verification_message.nullable, true);
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.transaction_verified_at.nullable, true);
  assert.equal(tables.find((table) => table.name === 'public_board_posts')?.columns.category.type, 'text');
  assert.equal(tables.find((table) => table.name === 'public_board_posts')?.columns.is_published.default, 'true');
  assert.equal(tables.find((table) => table.name === 'public_board_posts')?.columns.updated_by_admin_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'referral_program_settings')?.columns.reward_percent.type, 'numeric(5,2)');
  assert.equal(tables.find((table) => table.name === 'referral_program_settings')?.columns.subscriber_cashback_percent.default, '3');
  assert.equal(tables.find((table) => table.name === 'referral_program_settings')?.columns.salesperson_reward_percent.default, '30');
  assert.equal(tables.find((table) => table.name === 'referral_program_settings')?.columns.sales_team_reward_percent.default, '50');
  assert.equal(tables.find((table) => table.name === 'referral_program_settings')?.columns.updated_by_admin_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'sales_teams')?.columns.commission_percent.type, 'numeric(5,2)');
  assert.equal(tables.find((table) => table.name === 'sales_teams')?.columns.salesperson_ids.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'sales_teams')?.columns.updated_by_admin_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'free_trial_policy_settings')?.columns.base_duration_days.default, '7');
  assert.equal(tables.find((table) => table.name === 'free_trial_policy_settings')?.columns.event_allow_reapply.default, 'false');
  assert.equal(tables.find((table) => table.name === 'free_trial_user_allowances')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'free_trial_user_allowances')?.columns.remaining_count.default, '0');
  assert.equal(tables.find((table) => table.name === 'free_trial_usage_records')?.columns.policy_snapshot_json.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'free_trial_usage_records')?.columns.subscription_id.references, 'subscriptions.id');
  assert.equal(tables.find((table) => table.name === 'payment_transfer_settings')?.columns.bank_account_number.type, 'text');
  assert.equal(tables.find((table) => table.name === 'payment_transfer_settings')?.columns.bank_account_holder.type, 'text');
  assert.equal(tables.find((table) => table.name === 'payment_transfer_settings')?.columns.bank_logo_url.type, 'text');
  assert.equal(tables.find((table) => table.name === 'payment_transfer_settings')?.columns.usdt_address.type, 'text');
  assert.equal(tables.find((table) => table.name === 'payment_transfer_settings')?.columns.usdt_network.type, 'text');
  assert.equal(tables.find((table) => table.name === 'payment_transfer_settings')?.columns.updated_by_admin_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'web_info_settings')?.columns.terms_content.type, 'text');
  assert.equal(tables.find((table) => table.name === 'web_info_settings')?.columns.privacy_content.type, 'text');
  assert.equal(tables.find((table) => table.name === 'web_info_settings')?.columns.plan_services_json.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'web_info_settings')?.columns.updated_by_admin_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'signal_admin_settings')?.columns.hidden_strategy_ids_json.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'signal_admin_settings')?.columns.global_signal_policy_json.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'signal_admin_settings')?.columns.symbol_signal_policies_json.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'signal_admin_settings')?.columns.strategy_param_profiles_json.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'signal_admin_settings')?.columns.selected_strategy_id.type, 'text');
  assert.equal(tables.find((table) => table.name === 'telegram_bot_profiles')?.columns.bot_token.type, 'text');
  assert.equal(tables.find((table) => table.name === 'telegram_bot_profiles')?.columns.chat_id.type, 'text');
  assert.equal(tables.find((table) => table.name === 'telegram_delivery_logs')?.columns.profile_id.references, 'telegram_bot_profiles.id');
  assert.equal(tables.find((table) => table.name === 'telegram_delivery_logs')?.columns.event_type.type, 'text');
  assert.equal(tables.find((table) => table.name === 'signal_events')?.columns.source.type, 'text');
  assert.equal(tables.find((table) => table.name === 'signal_events')?.columns.take_profit_prices_json.type, 'jsonb');
  assert.equal(tables.find((table) => table.name === 'signal_events')?.indexes?.some((index) => index.name === 'idx_signal_events_symbol_time'), true);
  assert.equal(tables.find((table) => table.name === 'signup_agreements')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'signup_agreements')?.columns.terms_content.type, 'text');
  assert.equal(tables.find((table) => table.name === 'signup_agreements')?.columns.privacy_content.type, 'text');
  assert.equal(tables.find((table) => table.name === 'signup_agreements')?.columns.ip_address.nullable, true);
  assert.equal(tables.find((table) => table.name === 'signup_agreements')?.columns.user_agent.nullable, true);
  assert.equal(tables.find((table) => table.name === 'market_candles')?.columns.market.type, 'text');
  assert.equal(tables.find((table) => table.name === 'market_candles')?.columns.symbol.type, 'text');
  assert.equal(tables.find((table) => table.name === 'market_candles')?.columns.timeframe.type, 'text');
  assert.equal(tables.find((table) => table.name === 'market_candles')?.columns.time.type, 'timestamptz');
  assert.equal(tables.find((table) => table.name === 'market_candles')?.columns.open.type, 'numeric');
  assert.equal(tables.find((table) => table.name === 'market_candles')?.indexes?.some((index) => index.name === 'idx_market_candles_symbol_time'), true);
  assert.equal(tables.find((table) => table.name === 'notifications')?.columns.archived_at.nullable, true);
  assert.equal(tables.find((table) => table.name === 'email_outbox')?.columns.sender_email.type, 'text');
  assert.equal(tables.find((table) => table.name === 'email_outbox')?.columns.recipient_email.type, 'text');
  assert.equal(tables.find((table) => table.name === 'audit_logs')?.columns.actor_admin_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'audit_logs')?.columns.before_json.nullable, true);
  assert.equal(tables.find((table) => table.name === 'audit_logs')?.columns.after_json.nullable, true);
});

test('postgres schema renderer emits tables, checks, foreign keys, and indexes', () => {
  const sql = renderChartServicePostgresSchema();

  assert.match(sql, /create table if not exists users/i);
  assert.match(sql, /password_hash text/i);
  assert.doesNotMatch(sql, /password_hash text not null/i);
  assert.match(sql, /phone_number text/i);
  assert.match(sql, /profile_image_data_url text/i);
  assert.match(sql, /referral_code text not null/i);
  assert.match(sql, /referred_by_user_id text/i);
  assert.match(sql, /created_at timestamptz not null/i);
  assert.match(sql, /create table if not exists password_reset_tokens/i);
  assert.match(sql, /token_hash text not null/i);
  assert.match(sql, /account_status text not null default 'active'/i);
  assert.match(sql, /check \(account_status in \('active', 'suspended'\)\)/i);
  assert.match(sql, /foreign key \(user_id\) references users\(id\)/i);
  assert.match(sql, /create index if not exists idx_payment_requests_user_id/i);
  assert.match(sql, /create index if not exists idx_payment_requests_support_thread_id/i);
  assert.match(sql, /create table if not exists referral_program_settings/i);
  assert.match(sql, /subscriber_cashback_percent numeric\(5,2\) not null default 3/i);
  assert.match(sql, /reward_percent numeric\(5,2\) not null default 10/i);
  assert.match(sql, /salesperson_reward_percent numeric\(5,2\) not null default 30/i);
  assert.match(sql, /alter table if exists referral_program_settings add column if not exists reward_percent numeric\(5,2\)/i);
  assert.match(sql, /alter table if exists referral_program_settings add column if not exists subscriber_cashback_percent numeric\(5,2\)/i);
  assert.match(sql, /alter table if exists referral_program_settings add column if not exists salesperson_reward_percent numeric\(5,2\)/i);
  assert.match(sql, /alter table if exists referral_program_settings add column if not exists sales_team_reward_percent numeric\(5,2\)/i);
  assert.match(sql, /create table if not exists sales_teams/i);
  assert.match(sql, /commission_percent numeric\(5,2\) not null default 30/i);
  assert.match(sql, /salesperson_ids jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /alter table if exists sales_teams add column if not exists salesperson_ids jsonb/i);
  assert.match(sql, /create table if not exists free_trial_policy_settings/i);
  assert.match(sql, /base_duration_days integer not null default 7/i);
  assert.match(sql, /event_allow_reapply boolean not null default false/i);
  assert.match(sql, /create table if not exists free_trial_user_allowances/i);
  assert.match(sql, /remaining_count integer not null default 0/i);
  assert.match(sql, /create table if not exists free_trial_usage_records/i);
  assert.match(sql, /policy_snapshot_json jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /create index if not exists idx_free_trial_usage_records_user_id/i);
  assert.match(sql, /create table if not exists payment_transfer_settings/i);
  assert.match(sql, /bank_account_number text not null/i);
  assert.match(sql, /bank_account_holder text not null/i);
  assert.match(sql, /bank_logo_url text not null/i);
  assert.match(sql, /usdt_address text not null/i);
  assert.match(sql, /usdt_network text not null/i);
  assert.match(sql, /alter table if exists payment_transfer_settings add column if not exists bank_account_number text/i);
  assert.match(sql, /alter table if exists payment_transfer_settings add column if not exists bank_logo_url text/i);
  assert.match(sql, /create table if not exists public_board_posts/i);
  assert.match(sql, /category text not null/i);
  assert.match(sql, /is_published boolean not null default true/i);
  assert.match(sql, /create index if not exists idx_public_board_posts_category/i);
  assert.match(sql, /insert into public_board_posts/i);
  assert.doesNotMatch(sql, /updated_by_admin_id\).*'admin_1'/i);
  assert.match(sql, /create table if not exists web_info_settings/i);
  assert.match(sql, /terms_content text not null/i);
  assert.match(sql, /privacy_content text not null/i);
  assert.match(sql, /plan_services_json jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /alter table if exists web_info_settings add column if not exists terms_content text/i);
  assert.match(sql, /alter table if exists web_info_settings add column if not exists plan_services_json jsonb/i);
  assert.match(sql, /create table if not exists signal_admin_settings/i);
  assert.match(sql, /hidden_strategy_ids_json jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /global_signal_policy_json jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /symbol_signal_policies_json jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /strategy_param_profiles_json jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /selected_strategy_id text not null default 'strategy_js_grid_martingale'/i);
  assert.match(sql, /create table if not exists telegram_bot_profiles/i);
  assert.match(sql, /bot_token text not null/i);
  assert.match(sql, /chat_id text not null/i);
  assert.match(sql, /create table if not exists telegram_delivery_logs/i);
  assert.match(sql, /foreign key \(profile_id\) references telegram_bot_profiles\(id\)/i);
  assert.match(sql, /create table if not exists signal_events/i);
  assert.match(sql, /take_profit_prices_json jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /create index if not exists idx_signal_events_symbol_time/i);
  assert.match(sql, /create table if not exists signup_agreements/i);
  assert.match(sql, /terms_accepted_at timestamptz not null/i);
  assert.match(sql, /privacy_accepted_at timestamptz not null/i);
  assert.match(sql, /terms_settings_updated_at timestamptz not null/i);
  assert.match(sql, /privacy_settings_updated_at timestamptz not null/i);
  assert.match(sql, /create index if not exists idx_signup_agreements_user_id/i);
  assert.match(sql, /alter table if exists signup_agreements add column if not exists ip_address text/i);
  assert.match(sql, /create table if not exists market_candles/i);
  assert.match(sql, /primary key \(market, symbol, timeframe, time\)/i);
  assert.match(sql, /alter table if exists market_candles enable row level security/i);
  assert.match(sql, /create index if not exists idx_market_candles_symbol_time/i);
  assert.match(sql, /create index if not exists idx_market_candles_timeframe_time/i);
  assert.match(sql, /create index if not exists idx_notifications_user_id_read_at/i);
  assert.match(sql, /archived_at timestamptz/i);
  assert.match(sql, /create index if not exists idx_notifications_user_id_archived_at/i);
  assert.match(sql, /alter table if exists notifications add column if not exists archived_at timestamptz/i);
  assert.match(sql, /alter table if exists payment_requests add column if not exists support_thread_id text/i);
  assert.match(sql, /alter table if exists payment_requests add column if not exists transaction_id text/i);
  assert.match(sql, /alter table if exists payment_requests add column if not exists transaction_verification_status text/i);
  assert.match(sql, /alter table if exists payment_requests add column if not exists transaction_verification_message text/i);
  assert.match(sql, /alter table if exists payment_requests add column if not exists transaction_verified_at timestamptz/i);
  assert.match(sql, /alter table if exists users add column if not exists phone_number text/i);
  assert.match(sql, /alter table if exists users add column if not exists profile_image_data_url text/i);
  assert.match(sql, /alter table if exists users add column if not exists referral_code text/i);
  assert.match(sql, /update users set referral_code = upper\(substr\(md5\(id\), 1, 6\)\)/i);
  assert.match(sql, /referral_code !~ '\^\[A-Z0-9\]\{6\}\$'/i);
  assert.match(sql, /alter table if exists users add column if not exists referred_by_user_id text/i);
  assert.match(sql, /alter table if exists users add column if not exists created_at timestamptz/i);
  assert.doesNotMatch(sql, /create index if not exists idx_social_auth_accounts_provider_user on social_auth_accounts/i);
  assert.match(sql, /create unique index if not exists idx_social_auth_accounts_provider_user on social_auth_accounts \(provider, provider_user_id\)/i);
  assert.match(sql, /delete from social_auth_accounts victim/i);
  assert.match(sql, /drop index if exists idx_social_auth_accounts_provider_user/i);
  assert.match(sql, /create table if not exists email_outbox/i);
  assert.match(sql, /create index if not exists idx_email_outbox_status_created_at/i);
  assert.match(sql, /create index if not exists idx_referral_ledgers_referrer_user_id/i);
  assert.match(sql, /create index if not exists idx_referral_ledgers_referred_user_id/i);
  assert.match(sql, /create index if not exists idx_support_messages_author_user_id/i);
  assert.match(sql, /before_json jsonb/i);
  assert.match(sql, /after_json jsonb/i);
  assert.doesNotMatch(sql, /before_json jsonb not null/i);
  assert.doesNotMatch(sql, /after_json jsonb not null/i);
  assert.match(sql, /alter table if exists audit_logs alter column before_json drop not null/i);
  assert.match(sql, /alter table if exists audit_logs alter column after_json drop not null/i);
  assert.match(sql, /alter table if exists users alter column password_hash drop not null/i);
  assert.doesNotMatch(sql, /update users set email_verified_at = created_at/i);
});

test('database schema export harness is available for production migration prep', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/write-chart-service-schema.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:schema'], 'node scripts/write-chart-service-schema.mjs');
  assert.match(script, /renderChartServicePostgresSchema/);
  assert.match(script, /chart-service-schema\.sql/);
});
