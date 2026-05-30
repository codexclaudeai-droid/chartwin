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
