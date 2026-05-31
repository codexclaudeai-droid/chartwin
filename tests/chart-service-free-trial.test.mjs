import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  getAsyncChartAccessSnapshot,
  requestAsyncFreeTrial,
} from '../src/server/chart-service/index.ts';
import { SUBSCRIPTION_STATUSES } from '../src/domain/chart-service/index.ts';

test('free trial request activates chart access and records the trial end date', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());

  const result = await requestAsyncFreeTrial(repository, {
    actor: { id: 'user_member', role: 'member' },
    requestedAt: '2026-05-30T00:00:00.000Z',
  });
  const access = await getAsyncChartAccessSnapshot(repository, 'user_member');

  assert.equal(result.status, 'started');
  assert.equal(result.endsAt, '2026-06-06T00:00:00.000Z');
  assert.equal(result.subscription?.status, SUBSCRIPTION_STATUSES.trialActive);
  assert.equal(result.supportThread?.category, 'trial');
  assert.equal(access.fullChart, true);

  const usageRecords = await repository.listFreeTrialUsageRecordsByUserId('user_member');
  assert.equal(usageRecords.length, 1);
  assert.equal(usageRecords[0]?.source, 'standard');
  assert.equal(usageRecords[0]?.durationDays, 7);
});

test('free trial request is limited to one lifetime trial per account', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
  const previousTrial = await repository.getSubscriptionByUserId('user_trial');
  assert.ok(previousTrial);
  await repository.saveSubscription({
    ...previousTrial,
    status: SUBSCRIPTION_STATUSES.trialExpired,
    endsAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
  });

  await assert.rejects(
    () => requestAsyncFreeTrial(repository, {
      actor: { id: 'user_trial', role: 'member' },
      requestedAt: '2026-06-01T00:00:00.000Z',
    }),
    /무료체험은 계정당 1회만 신청할 수 있습니다/,
  );

  const subscription = await repository.getSubscriptionByUserId('user_trial');
  assert.equal(subscription?.status, SUBSCRIPTION_STATUSES.trialExpired);
  assert.equal(subscription?.endsAt, '2026-05-30T00:00:00.000Z');
});

test('free trial event policy can temporarily reopen expired trial accounts', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
  const previousTrial = await repository.getSubscriptionByUserId('user_trial');
  assert.ok(previousTrial);
  await repository.saveSubscription({
    ...previousTrial,
    status: SUBSCRIPTION_STATUSES.trialExpired,
    endsAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
  });
  await repository.saveFreeTrialPolicySettings({
    id: 'default',
    baseDurationDays: 7,
    eventEnabled: true,
    eventStartsAt: '2026-06-01T00:00:00.000Z',
    eventEndsAt: '2026-06-10T00:00:00.000Z',
    eventDurationDays: 14,
    eventAllowReapply: true,
    updatedByAdminId: 'admin_1',
    updatedAt: '2026-06-01T00:00:00.000Z',
  });

  const result = await requestAsyncFreeTrial(repository, {
    actor: { id: 'user_trial', role: 'member' },
    requestedAt: '2026-06-01T00:00:00.000Z',
  });

  assert.equal(result.status, 'started');
  assert.equal(result.endsAt, '2026-06-15T00:00:00.000Z');
  assert.notEqual(result.subscription?.id, previousTrial.id);
  const usageRecords = await repository.listFreeTrialUsageRecordsByUserId('user_trial');
  assert.equal(usageRecords.length, 1);
  assert.equal(usageRecords[0]?.source, 'global_event');
  assert.equal(usageRecords[0]?.durationDays, 14);
});

test('member-specific free trial allowance is adjustable and consumed on use', async () => {
  const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
  const previousTrial = await repository.getSubscriptionByUserId('user_trial');
  assert.ok(previousTrial);
  await repository.saveSubscription({
    ...previousTrial,
    status: SUBSCRIPTION_STATUSES.trialExpired,
    endsAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
  });
  await repository.saveFreeTrialUserAllowance({
    userId: 'user_trial',
    remainingCount: 2,
    note: 'manual reopen',
    updatedByAdminId: 'admin_1',
    updatedAt: '2026-06-01T00:00:00.000Z',
  });

  const result = await requestAsyncFreeTrial(repository, {
    actor: { id: 'user_trial', role: 'member' },
    requestedAt: '2026-06-02T00:00:00.000Z',
  });

  const allowance = await repository.getFreeTrialUserAllowanceByUserId('user_trial');
  const usageRecords = await repository.listFreeTrialUsageRecordsByUserId('user_trial');
  assert.equal(result.status, 'started');
  assert.equal(result.endsAt, '2026-06-09T00:00:00.000Z');
  assert.equal(allowance?.remainingCount, 1);
  assert.equal(usageRecords.length, 1);
  assert.equal(usageRecords[0]?.source, 'user_allowance');
});

test('free trial request button posts to the trial request API and shows auth prompt for guests', () => {
  const source = readFileSync(new URL('../app/shared/free-trial-request-button.tsx', import.meta.url), 'utf8');

  assert.match(source, /fetch\('\/api\/trial\/request'/);
  assert.match(source, /response\.status === 401/);
  assert.match(source, /AuthPromptModal/);
  assert.match(source, /무료체험 신청이 접수되었습니다/);
  assert.match(source, /window\.location\.assign\(returnHref\)/);
});

test('chart access gate offers subscription and free trial actions', () => {
  const pageSource = readFileSync(new URL('../app/chart/page.tsx', import.meta.url), 'utf8');
  const runtimeSource = readFileSync(new URL('../app/chart/chart-runtime.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /구독하기/);
  assert.match(pageSource, /무료체험 신청/);
  assert.doesNotMatch(pageSource, /href="\/support">고객센터/);
  assert.match(runtimeSource, /구독하기/);
  assert.match(runtimeSource, /무료체험 신청/);
  assert.doesNotMatch(runtimeSource, /href="\/support">고객센터/);
});
