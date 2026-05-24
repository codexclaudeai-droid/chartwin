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
    'payment_requests',
    'referral_ledgers',
    'support_threads',
    'support_messages',
    'notifications',
    'audit_logs',
  ]);
  assert.equal(tables.find((table) => table.name === 'users')?.columns.account_status.type, 'text');
  assert.equal(tables.find((table) => table.name === 'users')?.columns.password_hash.type, 'text');
  assert.equal(tables.find((table) => table.name === 'password_reset_tokens')?.columns.token_hash.type, 'text');
  assert.equal(tables.find((table) => table.name === 'password_reset_tokens')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'subscriptions')?.columns.user_id.references, 'users.id');
  assert.equal(tables.find((table) => table.name === 'payment_requests')?.columns.subscription_id.references, 'subscriptions.id');
  assert.equal(tables.find((table) => table.name === 'audit_logs')?.columns.actor_admin_id.references, 'users.id');
});

test('postgres schema renderer emits tables, checks, foreign keys, and indexes', () => {
  const sql = renderChartServicePostgresSchema();

  assert.match(sql, /create table if not exists users/i);
  assert.match(sql, /password_hash text not null/i);
  assert.match(sql, /create table if not exists password_reset_tokens/i);
  assert.match(sql, /token_hash text not null/i);
  assert.match(sql, /account_status text not null default 'active'/i);
  assert.match(sql, /check \(account_status in \('active', 'suspended'\)\)/i);
  assert.match(sql, /foreign key \(user_id\) references users\(id\)/i);
  assert.match(sql, /create index if not exists idx_payment_requests_user_id/i);
  assert.match(sql, /create index if not exists idx_notifications_user_id_read_at/i);
});

test('database schema export harness is available for production migration prep', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/write-chart-service-schema.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:schema'], 'node scripts/write-chart-service-schema.mjs');
  assert.match(script, /renderChartServicePostgresSchema/);
  assert.match(script, /chart-service-schema\.sql/);
});
