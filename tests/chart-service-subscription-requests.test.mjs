import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  approveSubscriptionActivationRequest,
  approveSubscriptionCancelRequest,
  approveSubscriptionRefundRequest,
  confirmManualPaymentRequest,
  createMockChartServiceRepository,
  listAdminSubscriptionQueue,
  rejectSubscriptionRequest,
  requestSubscriptionCancellation,
  requestSubscriptionRefund,
} from '../src/server/chart-service/index.ts';

test('subscriber can request cancellation for an active subscription', () => {
  const repository = createMockChartServiceRepository();

  const result = requestSubscriptionCancellation(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  assert.equal(result.status, 'cancel_requested');
  assert.equal(result.userId, 'user_subscriber');
});

test('subscriber can request refund for an active subscription', () => {
  const repository = createMockChartServiceRepository();

  const result = requestSubscriptionRefund(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  assert.equal(result.status, 'refund_requested');
  assert.equal(result.userId, 'user_subscriber');
});

test('admin subscription queue joins requested subscriptions with user and plan details', () => {
  const repository = createMockChartServiceRepository();
  requestSubscriptionCancellation(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  const queue = listAdminSubscriptionQueue(repository);
  const requested = queue.find((item) => item.subscription.userId === 'user_subscriber');

  assert.ok(requested);
  assert.equal(requested.user.email, 'subscriber@example.com');
  assert.equal(requested.plan?.name, 'Monthly');
  assert.equal(requested.subscription.status, 'cancel_requested');
});

test('admin can approve a payment-requested subscription from the subscription queue', () => {
  const repository = createMockChartServiceRepository();
  const confirmed = confirmManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T12:00:00.000Z',
  });
  const queueItem = listAdminSubscriptionQueue(repository)
    .find((item) => item.subscription.id === confirmed.subscription.id);

  const result = approveSubscriptionActivationRequest(repository, {
    subscriptionId: confirmed.subscription.id,
    admin: { id: 'admin_1', role: 'admin' },
    approvedAt: '2026-05-23T12:05:00.000Z',
    adminNote: '최종 승인',
  });

  assert.equal(queueItem?.subscription.status, 'payment_requested');
  assert.equal(queueItem?.payment?.status, 'confirmed');
  assert.equal(result.status, 'active');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'subscription.activate.approve');
});

test('admin subscription queue API does not expose user password hashes', async () => {
  const {
    createSessionForUser,
    getChartServiceRepository,
    SESSION_COOKIE_NAME,
  } = await import('../src/server/chart-service/index.ts');
  const repository = getChartServiceRepository();
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { GET } = await import('../app/api/admin/subscriptions/route.ts');

  const response = await GET(new Request('http://localhost/api/admin/subscriptions', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}` },
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.subscriptions[0].user.passwordHash, undefined);
});

test('admin can approve a cancellation request and write an audit log', () => {
  const repository = createMockChartServiceRepository();
  const requested = requestSubscriptionCancellation(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  const result = approveSubscriptionCancelRequest(repository, {
    subscriptionId: requested.id,
    admin: { id: 'admin_1', role: 'admin' },
    cancelledAt: '2026-05-23T12:05:00.000Z',
    adminNote: '사용자 요청 사유를 확인했습니다.',
  });

  assert.equal(result.status, 'cancelled');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'subscription.cancel.approve');
});

test('admin subscription cancellation approval requires an explicit admin note', () => {
  const repository = createMockChartServiceRepository();
  const requested = requestSubscriptionCancellation(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  assert.throws(() => approveSubscriptionCancelRequest(repository, {
    subscriptionId: requested.id,
    admin: { id: 'admin_1', role: 'admin' },
    cancelledAt: '2026-05-23T12:05:00.000Z',
    adminNote: '   ',
  }), /Admin note required/);

  assert.equal(repository.getSubscriptionById(requested.id)?.status, 'cancel_requested');
  assert.equal(repository.listAuditLogs().length, 0);
});

test('admin can approve a refund request, refund payment, and write an audit log', () => {
  const repository = createMockChartServiceRepository();
  const requested = requestSubscriptionRefund(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  const result = approveSubscriptionRefundRequest(repository, {
    subscriptionId: requested.id,
    admin: { id: 'admin_1', role: 'admin' },
    refundedAt: '2026-05-23T12:05:00.000Z',
    adminNote: '환불 승인',
  });

  assert.equal(result.subscription.status, 'refunded');
  assert.equal(result.payment.status, 'refunded');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'subscription.refund.approve');
});

test('admin can reject a cancellation request and restore active subscription status', () => {
  const repository = createMockChartServiceRepository();
  const requested = requestSubscriptionCancellation(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  const result = rejectSubscriptionRequest(repository, {
    subscriptionId: requested.id,
    admin: { id: 'admin_1', role: 'admin' },
    rejectedAt: '2026-05-23T12:10:00.000Z',
    adminNote: '요청 사유가 확인되지 않았습니다.',
  });

  assert.equal(result.status, 'active');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'subscription.request.reject');
});

test('admin subscription refund and rejection require explicit admin notes', () => {
  const repository = createMockChartServiceRepository();
  const refundRequested = requestSubscriptionRefund(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  assert.throws(() => approveSubscriptionRefundRequest(repository, {
    subscriptionId: refundRequested.id,
    admin: { id: 'admin_1', role: 'admin' },
    refundedAt: '2026-05-23T12:05:00.000Z',
    adminNote: '',
  }), /Admin note required/);
  assert.equal(repository.getSubscriptionById(refundRequested.id)?.status, 'refund_requested');

  const cancelRepository = createMockChartServiceRepository();
  const cancelRequested = requestSubscriptionCancellation(cancelRepository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T12:00:00.000Z',
  });

  assert.throws(() => rejectSubscriptionRequest(cancelRepository, {
    subscriptionId: cancelRequested.id,
    admin: { id: 'admin_1', role: 'admin' },
    rejectedAt: '2026-05-23T12:10:00.000Z',
    adminNote: '  ',
  }), /Admin note required/);
  assert.equal(cancelRepository.getSubscriptionById(cancelRequested.id)?.status, 'cancel_requested');
});

test('admin subscription panel renders request quick filters before the table', () => {
  const source = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /SUBSCRIPTION_QUEUE_FILTER_PRESETS/);
  assert.match(source, /aria-label="구독 요청 빠른 필터"/);
  assert.match(source, /filteredItems\.map/);
});

test('admin subscription panel applies dashboard queue preset events', () => {
  const source = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /subscribeAdminQueuePresetEvent/);
  assert.match(source, /detail\.panel !== 'subscriptions'/);
  assert.match(source, /const dashboardFilter = getSubscriptionQueueFilterPreset\(detail\.presetKey\)/);
  assert.match(source, /setActiveFilterKey\(dashboardFilter\.key\)/);
});

test('admin subscription panel renders operator-friendly status labels', () => {
  const source = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatSubscriptionStatusLabel/);
  assert.match(source, /formatPaymentStatusLabel/);
});

test('admin subscription panel confirms cancellation refund and rejection operations before posting', () => {
  const source = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /useAdminActionConfirmation/);
  assert.match(source, /await confirmAdminAction/);
  assert.match(source, /\{confirmationDialog\}/);
  assert.match(source, /`subscription\.\$\{action\}`/);
  assert.doesNotMatch(source, /shouldRunAdminAction/);
});

test('admin subscription panel exposes a separate activation approval action', () => {
  const source = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /runOperation\(item\.subscription\.id, 'approve'\)/);
  assert.match(source, /\/api\/admin\/subscriptions\/approve/);
  assert.match(source, /item\.subscription\.status === 'payment_requested'/);
});

test('admin subscription panel refreshes its filtered queue after local operations without overwriting success context', () => {
  const source = fs.readFileSync(new URL('../app/admin/subscription-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /type SubscriptionAdminPanelRefreshOptions = \{/);
  assert.match(source, /nextMessage\?: string/);
  assert.match(source, /detail\.source === 'subscriptions'/);
  assert.match(source, /void refresh\(\{ nextMessage: `\$\{subscriptionId\} 요청을 처리했습니다\. 목록을 갱신했습니다\.` \}\)/);
  assert.match(source, /dispatchAdminRefreshEvent\(\{ source: 'subscriptions' \}\)/);
});
