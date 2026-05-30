import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('bootstrap default plans expose the public pricing tiers', async () => {
  const { getDefaultChartServiceSubscriptionPlans } = await import('../src/server/chart-service/index.ts');

  const plans = getDefaultChartServiceSubscriptionPlans();

  assert.deepEqual(plans.map((plan) => plan.id), ['plan_monthly', 'plan_half_year', 'plan_yearly']);
  assert.deepEqual(plans.map((plan) => plan.durationDays), [30, 180, 365]);
  assert.deepEqual(plans.map((plan) => plan.isActive), [true, true, true]);
});

test('bootstrap creates missing default plans without overwriting existing plan settings', async () => {
  const {
    bootstrapAsyncChartServiceRepository,
    createAsyncChartServiceRepository,
    createMockChartServiceRepository,
    createMockChartServiceState,
  } = await import('../src/server/chart-service/index.ts');
  const state = createMockChartServiceState();
  state.plans = [{
    id: 'plan_monthly',
    name: 'Custom Monthly',
    durationDays: 31,
    basePriceUsd: 249,
    discountPercent: 5,
    isActive: true,
  }];
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(state));

  const result = await bootstrapAsyncChartServiceRepository(repository);
  const monthlyPlan = await repository.getPlanById('plan_monthly');
  const plans = await repository.listPlans();

  assert.equal(result.createdPlanCount, 2);
  assert.equal(result.skippedPlanCount, 1);
  assert.equal(monthlyPlan?.name, 'Custom Monthly');
  assert.deepEqual(plans.map((plan) => plan.id).sort(), ['plan_half_year', 'plan_monthly', 'plan_yearly']);
});

test('bootstrap creates an initial super admin from env-like credentials once', async () => {
  const {
    bootstrapAsyncChartServiceRepository,
    createAsyncChartServiceRepository,
    createMockChartServiceRepository,
    createMockChartServiceState,
    verifyPasswordHash,
  } = await import('../src/server/chart-service/index.ts');
  const state = createMockChartServiceState();
  state.users = [];
  state.plans = [];
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(state));

  const firstResult = await bootstrapAsyncChartServiceRepository(repository, {
    initialAdmin: {
      email: 'Owner@Example.com ',
      password: 'Owner1234!',
      name: ' Service Owner ',
    },
  });
  const secondResult = await bootstrapAsyncChartServiceRepository(repository, {
    initialAdmin: {
      email: 'owner@example.com',
      password: 'Owner1234!',
      name: 'Service Owner',
    },
  });
  const user = await repository.getUserByEmail('owner@example.com');

  assert.equal(firstResult.createdAdmin, true);
  assert.equal(secondResult.createdAdmin, false);
  assert.equal(secondResult.skippedAdmin, true);
  assert.equal(secondResult.updatedAdmin, false);
  assert.equal(user?.email, 'owner@example.com');
  assert.equal(user?.name, 'Service Owner');
  assert.equal(user?.role, 'super_admin');
  assert.equal(user?.accountStatus, 'active');
  assert.equal(user?.passwordHash?.includes('Owner1234!'), false);
  assert.equal(verifyPasswordHash('Owner1234!', user?.passwordHash), true);
  assert.equal((await repository.listUsers()).length, 1);
});

test('bootstrap refreshes legacy initial admin password hashes for worker compatibility', async () => {
  const {
    bootstrapAsyncChartServiceRepository,
    createAsyncChartServiceRepository,
    createMockChartServiceRepository,
    createMockChartServiceState,
    createPasswordHash,
    getPasswordHashIterations,
    verifyPasswordHash,
  } = await import('../src/server/chart-service/index.ts');
  const state = createMockChartServiceState();
  state.users = [{
    id: 'admin_legacy',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'admin',
    accountStatus: 'active',
    phoneNumber: null,
    referralCode: 'LEGACY',
    referredByUserId: null,
    createdAt: '2026-05-23T00:00:00.000Z',
    passwordHash: createPasswordHash('Owner1234!', { salt: 'legacy_salt', iterations: 210_000 }),
  }];
  state.plans = [];
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(state));

  const result = await bootstrapAsyncChartServiceRepository(repository, {
    initialAdmin: {
      email: 'owner@example.com',
      password: 'Owner1234!',
      name: 'Owner',
    },
  });
  const user = await repository.getUserByEmail('owner@example.com');

  assert.equal(result.createdAdmin, false);
  assert.equal(result.updatedAdmin, true);
  assert.equal(result.skippedAdmin, false);
  assert.equal(user?.role, 'super_admin');
  assert.equal(getPasswordHashIterations(user?.passwordHash), 100_000);
  assert.equal(verifyPasswordHash('Owner1234!', user?.passwordHash), true);
});

test('bootstrap rejects incomplete or weak initial admin credentials', async () => {
  const {
    bootstrapAsyncChartServiceRepository,
    createAsyncChartServiceRepository,
    createMockChartServiceRepository,
    createMockChartServiceState,
  } = await import('../src/server/chart-service/index.ts');
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository(createMockChartServiceState()));

  await assert.rejects(
    bootstrapAsyncChartServiceRepository(repository, {
      initialAdmin: { email: 'owner@example.com', password: '', name: 'Owner' },
    }),
    /requires both email and password/,
  );
  await assert.rejects(
    bootstrapAsyncChartServiceRepository(repository, {
      initialAdmin: { email: 'owner@example.com', password: 'weak', name: 'Owner' },
    }),
    /Password policy failed/,
  );
});

test('bootstrap harness is wired into package scripts and applies migration before seed data', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/bootstrap-chart-service.mjs', import.meta.url), 'utf8');
  const envExample = fs.readFileSync(new URL('../.env.production.example', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:bootstrap'], 'node scripts/bootstrap-chart-service.mjs');
  assert.match(script, /runChartServicePostgresSchemaMigration/);
  assert.match(script, /bootstrapAsyncChartServiceRepository/);
  assert.match(script, /createPostgresAsyncChartServiceRepository/);
  assert.match(script, /close/);
  assert.match(envExample, /CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL=/);
  assert.match(envExample, /CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD=/);
});
