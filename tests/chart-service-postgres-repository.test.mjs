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

test('postgres async repository purges user dependencies before deleting the user', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql === 'select * from users where email = $1') {
        return {
          rows: [{
            id: 'user_unverified',
            email: 'verified@example.com',
            name: 'Verified Member',
            role: 'member',
            account_status: 'active',
            password_hash: 'hash',
            referral_code: 'UNVER1',
            email_verified_at: '2026-06-01T00:00:00.000Z',
          }],
        };
      }
      if (statement.sql === 'select * from auth_sessions where user_id = $1') {
        return {
          rows: [{
            id: 'session_1',
            user_id: 'user_unverified',
            created_at: '2026-06-01T00:00:00.000Z',
            expires_at: '2026-06-02T00:00:00.000Z',
          }],
        };
      }
      if (statement.sql === 'select * from email_outbox') {
        return {
          rows: [{
            id: 'email_1',
            sender_email: 'verify@tradingcore.co',
            recipient_email: 'verified@example.com',
            template: 'email_verification',
            subject: 'Verify',
            body: 'body',
            status: 'queued',
            created_at: '2026-06-01T00:00:00.000Z',
            sent_at: null,
            last_error: null,
          }],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  const result = await repository.purgeUnverifiedUserByEmail('VERIFIED@example.com');

  assert.equal(result?.user.id, 'user_unverified');
  assert.equal(result?.deletedSessionCount, 1);
  assert.equal(result?.deletedEmailOutboxCount, 1);
  assert.ok(calls.some((call) => call.sql === 'delete from email_verification_tokens where user_id = $1'));
  assert.ok(calls.some((call) => call.sql === 'delete from email_outbox where recipient_email = $1'));
  const referralDeleteCalls = calls.filter((call) => call.sql.includes('delete from referral_ledgers'));
  assert.equal(referralDeleteCalls.length, 1);
  assert.match(referralDeleteCalls[0].sql, /payment_request_id in \(select id from payment_requests where user_id = \$1\)/);
  assert.deepEqual(referralDeleteCalls[0].values, ['user_unverified']);
  assert.equal(calls.at(-1)?.sql, 'delete from users where id = $1');
  assert.deepEqual(calls.at(-1)?.values, ['user_unverified']);
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

test('postgres async repository saves social auth accounts without provider conflict upsert', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  await repository.saveSocialAuthAccount({
    id: 'social_auth_1',
    provider: 'google',
    providerUserId: 'google-123',
    userId: 'user_1',
    email: 'member@example.com',
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
  });

  assert.match(calls[0].sql, /^with updated as \( update social_auth_accounts/i);
  assert.match(calls[0].sql, /where provider = \$1 and provider_user_id = \$2/i);
  assert.match(calls[0].sql, /where not exists \(select 1 from updated\)/i);
  assert.doesNotMatch(calls[0].sql, /on conflict/i);
  assert.deepEqual(calls[0].values, [
    'google',
    'google-123',
    'user_1',
    'member@example.com',
    '2026-06-14T00:00:00.000Z',
    '2026-06-14T00:00:00.000Z',
    'social_auth_1',
  ]);
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
            bank_account_holder: 'TradingCore',
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
    bankAccountHolder: 'TradingCore',
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
    'TradingCore',
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
            plan_services_json: {
              plan_monthly: ['월간 차트 접근'],
            },
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
    planServices: {
      plan_monthly: ['월간 차트 접근'],
    },
    updatedByAdminId: 'admin_1',
    updatedAt: '2026-05-25T05:00:00.000Z',
  });

  assert.equal(settings?.termsContent, 'Terms content');
  assert.deepEqual(settings?.planServices.plan_monthly, ['월간 차트 접근']);
  assert.equal(calls[0].sql, 'select * from web_info_settings where id = $1');
  assert.deepEqual(calls[0].values, ['default']);
  assert.match(calls[1].sql, /^insert into web_info_settings /);
  assert.match(calls[1].sql, /on conflict \(id\) do update/);
  assert.deepEqual(calls[1].values.slice(0, 5), [
    'default',
    'Terms content',
    'Privacy content',
    { plan_monthly: ['월간 차트 접근'] },
    'admin_1',
  ]);
});

test('postgres async repository persists signup agreement evidence with upsert SQL', async () => {
  const { createPostgresAsyncChartServiceRepository } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql === 'select * from signup_agreements where user_id = $1 order by created_at desc') {
        return {
          rows: [{
            id: 'signup_agreement_1',
            user_id: 'user_1',
            terms_accepted_at: '2026-05-25T08:10:00.000Z',
            privacy_accepted_at: '2026-05-25T08:10:00.000Z',
            terms_content: 'Terms snapshot',
            privacy_content: 'Privacy snapshot',
            terms_settings_updated_at: '2026-05-25T08:00:00.000Z',
            privacy_settings_updated_at: '2026-05-25T08:00:00.000Z',
            ip_address: '203.0.113.10',
            user_agent: 'signup-test-agent',
            created_at: '2026-05-25T08:10:00.000Z',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);

  const agreements = await repository.listSignupAgreementsByUserId('user_1');
  await repository.saveSignupAgreement({
    id: 'signup_agreement_1',
    userId: 'user_1',
    termsAcceptedAt: '2026-05-25T08:10:00.000Z',
    privacyAcceptedAt: '2026-05-25T08:10:00.000Z',
    termsContent: 'Terms snapshot',
    privacyContent: 'Privacy snapshot',
    termsSettingsUpdatedAt: '2026-05-25T08:00:00.000Z',
    privacySettingsUpdatedAt: '2026-05-25T08:00:00.000Z',
    ipAddress: '203.0.113.10',
    userAgent: 'signup-test-agent',
    createdAt: '2026-05-25T08:10:00.000Z',
  });

  assert.equal(agreements[0].termsContent, 'Terms snapshot');
  assert.equal(calls[0].sql, 'select * from signup_agreements where user_id = $1 order by created_at desc');
  assert.deepEqual(calls[0].values, ['user_1']);
  assert.match(calls[1].sql, /^insert into signup_agreements /);
  assert.match(calls[1].sql, /on conflict \(id\) do update/);
  assert.deepEqual(calls[1].values.slice(0, 4), [
    'signup_agreement_1',
    'user_1',
    '2026-05-25T08:10:00.000Z',
    '2026-05-25T08:10:00.000Z',
  ]);
});
