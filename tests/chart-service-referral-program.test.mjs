import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createManualPaymentRequest,
  createMockChartServiceRepository,
  createSessionForUser,
  getAdminUserDetail,
  getChartServiceRepository,
  confirmMaturedReferralLedgers,
  getReferralProgramSettings,
  getUserDashboardSummary,
  getUserReferralSummary,
  SESSION_COOKIE_NAME,
  updateReferralProgramSettings,
} from '../src/server/chart-service/index.ts';

test('point program defaults to subscriber cashback referral and salesperson percents', () => {
  const repository = createMockChartServiceRepository();

  const settings = getReferralProgramSettings(repository);

  assert.equal(settings.subscriberCashbackPercent, 3);
  assert.equal(settings.rewardPercent, 10);
  assert.equal(settings.salespersonRewardPercent, 30);
});

test('manual payment request from a referred user creates pending referral points', () => {
  const repository = createMockChartServiceRepository();

  const { payment } = createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-24T09:00:00.000Z',
    depositorName: 'Member',
  });
  const ledgers = repository.listReferralLedgersByPaymentId(payment.id);

  assert.equal(ledgers.length, 1);
  assert.equal(ledgers[0].referrerUserId, 'user_subscriber');
  assert.equal(ledgers[0].referredUserId, 'user_member');
  assert.equal(ledgers[0].percent, 10);
  assert.equal(ledgers[0].points, 19.9);
  assert.equal(ledgers[0].status, 'pending');
  assert.equal(ledgers[0].confirmAfter, '2026-05-31T09:00:00.000Z');
});

test('referral points automatically confirm after the seven day refund window', () => {
  const repository = createMockChartServiceRepository();

  const result = confirmMaturedReferralLedgers(repository, '2026-05-30T00:00:00.000Z');
  const summary = getUserReferralSummary(repository, 'user_subscriber', {
    nowIso: '2026-05-30T00:00:00.000Z',
  });
  const ledgers = repository.listReferralLedgersByPaymentId('pay_pending');

  assert.equal(result.confirmedCount, 1);
  assert.equal(ledgers[0].status, 'confirmed');
  assert.equal(ledgers[0].confirmedAt, '2026-05-30T00:00:00.000Z');
  assert.equal(summary.pendingPoints, 0);
  assert.equal(summary.confirmedPoints, 19.9);
  assert.equal(summary.totalPoints, 19.9);
});

test('referral points remain pending before the seven day refund window', () => {
  const repository = createMockChartServiceRepository();

  const result = confirmMaturedReferralLedgers(repository, '2026-05-29T23:59:59.999Z');
  const ledgers = repository.listReferralLedgersByPaymentId('pay_pending');

  assert.equal(result.confirmedCount, 0);
  assert.equal(ledgers[0].status, 'pending');
  assert.equal(ledgers[0].confirmedAt, null);
});

test('super admin can change referral reward percent for future payment requests', () => {
  const repository = createMockChartServiceRepository();

  const settings = updateReferralProgramSettings(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    rewardPercent: 15,
    updatedAt: '2026-05-24T10:00:00.000Z',
  });
  const { payment } = createManualPaymentRequest(repository, {
    userId: 'user_member',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-24T10:10:00.000Z',
  });
  const ledgers = repository.listReferralLedgersByPaymentId(payment.id);

  assert.equal(settings.rewardPercent, 15);
  assert.equal(ledgers[0].percent, 15);
  assert.equal(ledgers[0].points, 29.85);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.points.settings.update');
});

test('super admin can change all point program percents together', () => {
  const repository = createMockChartServiceRepository();

  const settings = updateReferralProgramSettings(repository, {
    admin: { id: 'super_1', role: 'super_admin' },
    subscriberCashbackPercent: 4,
    rewardPercent: 12,
    salespersonRewardPercent: 28,
    updatedAt: '2026-05-24T10:00:00.000Z',
  });

  assert.equal(settings.subscriberCashbackPercent, 4);
  assert.equal(settings.rewardPercent, 12);
  assert.equal(settings.salespersonRewardPercent, 28);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.points.settings.update');
});

test('normal admin cannot change referral reward percent', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateReferralProgramSettings(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    rewardPercent: 15,
    updatedAt: '2026-05-24T10:00:00.000Z',
  }), /Super admin role required/);
});

test('profile and admin summaries expose referred users and point totals', () => {
  const repository = createMockChartServiceRepository();

  const profileSummary = getUserDashboardSummary(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
  });
  const adminDetail = getAdminUserDetail(repository, 'user_subscriber');
  const directSummary = getUserReferralSummary(repository, 'user_subscriber', {
    nowIso: '2026-05-29T00:00:00.000Z',
  });

  assert.equal(profileSummary.referrals.referredUserCount, 1);
  assert.equal(profileSummary.referrals.pendingPoints, 19.9);
  assert.equal(profileSummary.referrals.totalPoints, 19.9);
  assert.equal(profileSummary.referrals.referredUsers[0].user.email, 'member@example.com');
  assert.equal(profileSummary.referrals.referredUsers[0].pendingPoints, 19.9);
  assert.equal(adminDetail.referrals.referredUsers[0].user.email, 'member@example.com');
  assert.deepEqual(profileSummary.referrals, directSummary);
});

test('point settings API is readable by admins and writable only by super admins', async () => {
  const repository = getChartServiceRepository();
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const superSession = createSessionForUser(repository, {
    userId: 'super_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { GET, PATCH } = await import('../app/api/admin/point-settings/route.ts');

  const readable = await GET(new Request('http://localhost/api/admin/point-settings', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}` },
  }));
  const denied = await PATCH(new Request('http://localhost/api/admin/point-settings', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      subscriberCashbackPercent: 4,
      rewardPercent: 12,
      salespersonRewardPercent: 28,
    }),
  }));
  const updated = await PATCH(new Request('http://localhost/api/admin/point-settings', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${superSession.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      subscriberCashbackPercent: 4,
      rewardPercent: 12,
      salespersonRewardPercent: 28,
    }),
  }));
  const readablePayload = await readable.json();
  const updatedPayload = await updated.json();

  assert.equal(readable.status, 200);
  assert.equal(readablePayload.settings.subscriberCashbackPercent, 3);
  assert.equal(readablePayload.settings.rewardPercent, 10);
  assert.equal(readablePayload.settings.salespersonRewardPercent, 30);
  assert.equal(denied.status, 403);
  assert.equal(updated.status, 200);
  assert.equal(updatedPayload.settings.subscriberCashbackPercent, 4);
  assert.equal(updatedPayload.settings.rewardPercent, 12);
  assert.equal(updatedPayload.settings.salespersonRewardPercent, 28);
});
