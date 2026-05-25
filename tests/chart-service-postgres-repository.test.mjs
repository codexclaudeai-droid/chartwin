import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockChartServiceRepository } from '../src/server/chart-service/index.ts';

test('postgres async repository exposes the full repository contract', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const executor = { query: async () => ({ rows: [] }) };
  const repository = createPostgresAsyncChartServiceRepository(executor);
  const expectedMethods = Object.keys(createMockChartServiceRepository());

  for (const methodName of expectedMethods) {
    assert.equal(typeof repository[methodName], 'function', `${methodName} should be implemented`);
  }
});

test('postgres async repository uses parameterized statements for user reads and writes', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql === 'select * from users where id = $1') {
        return {
          rows: [{
            id: 'user_1',
            email: 'member@example.com',
            name: 'Member',
            role: 'member',
            account_status: 'active',
            password_hash: 'hash',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  const user = await repository.getUserById('user_1');
  await repository.saveUser({
    id: 'user_1',
    email: 'member@example.com',
    name: 'Member',
    role: 'member',
    accountStatus: 'active',
    passwordHash: 'hash',
  });
  await repository.deleteSession('session_1');

  assert.equal(user?.email, 'member@example.com');
  assert.deepEqual(calls[0].values, ['user_1']);
  assert.match(calls[1].sql, /^insert into users /);
  assert.match(calls[1].sql, /on conflict \(id\) do update/);
  assert.equal(calls[1].values.includes('member@example.com'), true);
  assert.equal(calls[2].sql, 'delete from auth_sessions where id = $1');
  assert.deepEqual(calls[2].values, ['session_1']);
});

test('postgres async repository appends audit logs with insert-only SQL', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  await repository.appendAuditLog({
    actorAdminId: 'admin_1',
    action: 'payment.confirm',
    targetType: 'payment',
    targetId: 'pay_1',
    beforeJson: { status: 'pending' },
    afterJson: { status: 'confirmed' },
  });

  assert.match(calls[0].sql, /^insert into audit_logs /);
  assert.doesNotMatch(calls[0].sql, /on conflict/i);
  assert.deepEqual(calls[0].values.slice(0, 4), ['admin_1', 'payment.confirm', 'payment', 'pay_1']);
});

test('postgres async repository persists sales team records with upsert SQL', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql === 'select * from sales_teams order by created_at asc') {
        return {
          rows: [{
            id: 'sales_team_1',
            name: 'Alpha Team',
            commission_percent: '30',
            salesperson_ids: ['user_sales_1'],
            created_at: '2026-05-25T00:00:00.000Z',
            updated_at: '2026-05-25T00:00:00.000Z',
            updated_by_admin_id: 'admin_1',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  const teams = await repository.listSalesTeams();
  await repository.saveSalesTeam({
    id: 'sales_team_1',
    name: 'Alpha Team',
    commissionPercent: 30,
    salespersonIds: ['user_sales_1'],
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:00.000Z',
    updatedByAdminId: 'admin_1',
  });

  assert.equal(teams[0].name, 'Alpha Team');
  assert.equal(calls[0].sql, 'select * from sales_teams order by created_at asc');
  assert.match(calls[1].sql, /^insert into sales_teams /);
  assert.match(calls[1].sql, /on conflict \(id\) do update/);
  assert.deepEqual(calls[1].values.slice(0, 4), ['sales_team_1', 'Alpha Team', 30, ['user_sales_1']]);
});

test('postgres async repository persists payment transfer settings with upsert SQL', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql === 'select * from payment_transfer_settings where id = $1') {
        return {
          rows: [{
            id: 'default',
            bank_name: 'KB국민은행',
            bank_account_number: '123-456-7890',
            bank_account_holder: 'TC Chart',
            bank_logo_url: '/bank-logos/kb.svg',
            usdt_address: 'TXYZ123456789',
            usdt_network: 'TRC20',
            updated_by_admin_id: 'admin_1',
            updated_at: '2026-05-25T02:00:00.000Z',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  const settings = await repository.getPaymentTransferSettings();
  await repository.savePaymentTransferSettings({
    id: 'default',
    bankName: 'KB국민은행',
    bankAccountNumber: '123-456-7890',
    bankAccountHolder: 'TC Chart',
    bankLogoUrl: '/bank-logos/kb.svg',
    usdtAddress: 'TXYZ123456789',
    usdtNetwork: 'TRC20',
    updatedByAdminId: 'admin_1',
    updatedAt: '2026-05-25T02:00:00.000Z',
  });

  assert.equal(settings?.usdtNetwork, 'TRC20');
  assert.equal(calls[0].sql, 'select * from payment_transfer_settings where id = $1');
  assert.deepEqual(calls[0].values, ['default']);
  assert.match(calls[1].sql, /^insert into payment_transfer_settings /);
  assert.match(calls[1].sql, /on conflict \(id\) do update/);
  assert.deepEqual(calls[1].values.slice(0, 6), [
    'default',
    'KB국민은행',
    '123-456-7890',
    'TC Chart',
    '/bank-logos/kb.svg',
    'TXYZ123456789',
  ]);
});

test('postgres async repository persists web info settings with upsert SQL', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql === 'select * from web_info_settings where id = $1') {
        return {
          rows: [{
            id: 'default',
            terms_content: 'Terms content',
            privacy_content: 'Privacy content',
            updated_by_admin_id: 'admin_1',
            updated_at: '2026-05-25T05:00:00.000Z',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  const settings = await repository.getWebInfoSettings();
  await repository.saveWebInfoSettings({
    id: 'default',
    termsContent: 'Terms content',
    privacyContent: 'Privacy content',
    updatedByAdminId: 'admin_1',
    updatedAt: '2026-05-25T05:00:00.000Z',
  });

  assert.equal(settings?.termsContent, 'Terms content');
  assert.equal(calls[0].sql, 'select * from web_info_settings where id = $1');
  assert.deepEqual(calls[0].values, ['default']);
  assert.match(calls[1].sql, /^insert into web_info_settings /);
  assert.match(calls[1].sql, /on conflict \(id\) do update/);
  assert.deepEqual(calls[1].values.slice(0, 4), [
    'default',
    'Terms content',
    'Privacy content',
    'admin_1',
  ]);
});
