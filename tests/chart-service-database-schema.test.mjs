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
    'password_reset_tokens',
    'subscription_plans',
    'subscriptions',
    'support_threads',
    'support_messages',
    'payment_requests',
    'referral_ledgers',
    'referral_program_settings',
    'notifications',
    'email_outbox',
    'audit_logs',
  ]);
  assert.equal(tables.find((table) => table.name === 'users')?.columns.account_status.type, 'text');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.password_hash.type, 'text');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.phone_number.nullable, true);
  assert.equal(tables.find((table) => table.name === 'users')?.columns.referral_code.type, 'text');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.referred_by_user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.created_at.type, 'timestamptz');
  assert.equal(tables.find((table) => table.name === 'password_reset_tokens')?.columns.token_hash.type, 'text');
  assert.equal(tables.find((table) => table.name === 'password_reset_tokens')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'subscriptions')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.subscription_id.references, 'subscriptions.id');
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.support_thread_id.references, 'support_threads.id');
  assert.equal(tables.find((table) => table.name === 'referral_program_settings')?.columns.reward_percent.type, 'numeric(5,2)');
  assert.equal(tables.find((table) => table.name === 'referral_program_settings')?.columns.updated_by_admin_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'notifications')?.columns.archived_at.nullable, true);
  assert.equal(tables.find((table) => table.name === 'email_outbox')?.columns.recipient_email.type, 'text');
  assert.equal(tables.find((table) => table.name === 'audit_logs')?.columns.actor_admin_id.references, 'users.id');
});

test('postgres schema renderer emits tables, checks, foreign keys, and indexes', () => {
  const sql = renderChartServicePostgresSchema();

  assert.match(sql, /create table if not exists users/i);
  assert.match(sql, /password_hash text not null/i);
  assert.match(sql, /phone_number text/i);
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
  assert.match(sql, /reward_percent numeric\(5,2\) not null default 10/i);
  assert.match(sql, /alter table if exists referral_program_settings add column if not exists reward_percent numeric\(5,2\)/i);
  assert.match(sql, /create index if not exists idx_notifications_user_id_read_at/i);
  assert.match(sql, /archived_at timestamptz/i);
  assert.match(sql, /create index if not exists idx_notifications_user_id_archived_at/i);
  assert.match(sql, /alter table if exists notifications add column if not exists archived_at timestamptz/i);
  assert.match(sql, /alter table if exists payment_requests add column if not exists support_thread_id text/i);
  assert.match(sql, /alter table if exists users add column if not exists phone_number text/i);
  assert.match(sql, /alter table if exists users add column if not exists referral_code text/i);
  assert.match(sql, /alter table if exists users add column if not exists referred_by_user_id text/i);
  assert.match(sql, /alter table if exists users add column if not exists created_at timestamptz/i);
  assert.match(sql, /create table if not exists email_outbox/i);
  assert.match(sql, /create index if not exists idx_email_outbox_status_created_at/i);
});

test('database schema export harness is available for production migration prep', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/write-chart-service-schema.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:schema'], 'node scripts/write-chart-service-schema.mjs');
  assert.match(script, /renderChartServicePostgresSchema/);
  assert.match(script, /chart-service-schema\.sql/);
});
