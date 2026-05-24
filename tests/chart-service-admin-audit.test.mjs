import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createAuditLogDraft } from '../src/domain/chart-service/index.ts';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  getAdminAuditLogEntries,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';

test('admin audit log entries are newest first and joined with actor details', () => {
  const repository = createMockChartServiceRepository();
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'payment.confirm_and_subscription.activate',
    targetType: 'payment_request',
    targetId: 'pay_pending',
    beforeJson: { status: 'pending' },
    afterJson: { status: 'confirmed' },
  }));
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'super_1', role: 'super_admin' },
    action: 'subscription.refund.approve',
    targetType: 'subscription',
    targetId: 'sub_active',
    beforeJson: { status: 'refund_requested' },
    afterJson: { status: 'refunded' },
  }));

  const entries = getAdminAuditLogEntries(repository);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].sequence, 2);
  assert.equal(entries[0].log.action, 'subscription.refund.approve');
  assert.equal(entries[0].actor?.email, 'super@example.com');
  assert.equal(entries[1].sequence, 1);
  assert.equal(entries[1].actor?.email, 'admin@example.com');
});

test('admin audit log panel renders quick filter presets that refresh with selected values', () => {
  const source = fs.readFileSync(new URL('../app/admin/audit-log-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /AUDIT_LOG_FILTER_PRESETS/);
  assert.match(source, /aria-label="감사 로그 빠른 필터"/);
  assert.match(source, /applyPreset/);
  assert.match(source, /refresh\(\{ action: preset\.action, targetType: preset\.targetType, targetId: '' \}\)/);
});

test('admin audit log entries can be filtered by action target type and target id', () => {
  const repository = createMockChartServiceRepository();
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'payment.reject_and_subscription.cancel',
    targetType: 'payment_request',
    targetId: 'pay_pending',
    beforeJson: {},
    afterJson: {},
  }));
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'support.reply.created',
    targetType: 'support_thread',
    targetId: 'support_public_notice',
    beforeJson: {},
    afterJson: {},
  }));
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'support.reply.created',
    targetType: 'support_thread',
    targetId: 'support_deposit_request',
    beforeJson: {},
    afterJson: {},
  }));

  const paymentEntries = getAdminAuditLogEntries(repository, {
    action: 'payment',
    targetType: 'payment_request',
  });
  const supportEntries = getAdminAuditLogEntries(repository, {
    action: 'support',
    targetType: 'support_thread',
    targetId: 'support_public_notice',
  });

  assert.equal(paymentEntries.length, 1);
  assert.equal(paymentEntries[0].log.action, 'payment.reject_and_subscription.cancel');
  assert.equal(supportEntries.length, 1);
  assert.equal(supportEntries[0].log.targetId, 'support_public_notice');
});

test('admin audit logs API requires admin session and supports filters', async () => {
  const repository = getChartServiceRepository();
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'audit.test.filtered',
    targetType: 'payment_request',
    targetId: 'pay_pending',
    beforeJson: {},
    afterJson: {},
  }));
  const memberSession = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { GET } = await import('../app/api/admin/audit-logs/route.ts');

  const denied = await GET(new Request('http://localhost/api/admin/audit-logs', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberSession.id}` },
  }));
  const allowed = await GET(new Request('http://localhost/api/admin/audit-logs?action=audit.test&targetId=pay_pending', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}` },
  }));
  const payload = await allowed.json();

  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.entries.length, 1);
  assert.equal(payload.entries[0].log.action, 'audit.test.filtered');
  assert.equal(payload.entries[0].actor.passwordHash, undefined);
});

test('admin audit log API strips nested password hashes from log payloads', async () => {
  const repository = getChartServiceRepository();
  repository.appendAuditLog(createAuditLogDraft({
    actor: { id: 'admin_1', role: 'admin' },
    action: 'admin.user.role.update',
    targetType: 'user',
    targetId: 'user_member',
    beforeJson: { user: { id: 'user_member', passwordHash: 'secret-hash' } },
    afterJson: { user: { id: 'user_member', passwordHash: 'next-secret-hash' } },
  }));
  const adminSession = createSessionForUser(repository, {
    userId: 'admin_1',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  }).session;
  const { GET } = await import('../app/api/admin/audit-logs/route.ts');

  const response = await GET(new Request('http://localhost/api/admin/audit-logs?action=admin.user.role.update', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.id}` },
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.entries[0].log.beforeJson.user.passwordHash, undefined);
  assert.equal(payload.entries[0].log.afterJson.user.passwordHash, undefined);
});

test('legacy audit preview route is admin protected', async () => {
  const { GET } = await import('../app/api/admin/audit-preview/route.ts');

  const response = await GET(new Request('http://localhost/api/admin/audit-preview'));

  assert.equal(response.status, 401);
});

test('admin audit log panel renders human-readable summaries above raw JSON', () => {
  const source = fs.readFileSync(new URL('../app/admin/audit-log-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatAuditLogSummary/);
  assert.match(source, /className="audit-summary"/);
  assert.match(source, /변경 전후 데이터 보기/);
});

test('admin audit log panels link operational targets back to source screens', async () => {
  const source = fs.readFileSync(new URL('../app/admin/audit-log-panel.tsx', import.meta.url), 'utf8');
  const userSource = fs.readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const { getAdminAuditTargetLink } = await import('../app/admin/audit-target-links.ts');

  assert.deepEqual(getAdminAuditTargetLink('payment_request', 'pay_pending'), {
    href: '/admin#admin-payment-pay_pending',
    label: '결제 큐에서 보기',
  });
  assert.deepEqual(getAdminAuditTargetLink('subscription', 'sub_pending'), {
    href: '/admin#admin-subscription-sub_pending',
    label: '구독 큐에서 보기',
  });
  assert.deepEqual(getAdminAuditTargetLink('support_thread', 'support_123'), {
    href: '/admin?supportThread=support_123#admin-support',
    label: '문의 답변 화면으로 이동',
  });
  assert.equal(getAdminAuditTargetLink('user', 'user_member'), null);
  assert.match(source, /getAdminAuditTargetLink\(entry\.log\.targetType, entry\.log\.targetId\)/);
  assert.match(source, /auditTargetLink\.href/);
  assert.match(userSource, /getAdminAuditTargetLink\(entry\.log\.targetType, entry\.log\.targetId\)/);
  assert.match(userSource, /auditTargetLink\.label/);
});

test('admin audit log panel keeps active filters and explains source-triggered refreshes', () => {
  const source = fs.readFileSync(new URL('../app/admin/audit-log-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /type AuditLogRefreshOptions = AuditLogFilterInput & \{/);
  assert.match(source, /nextMessage\?: string/);
  assert.match(source, /const \[targetId, setTargetId\] = useState\(''\)/);
  assert.match(source, /const latestFilterRef = useRef<AuditLogFilterInput>\(\{ action: '', targetType: '', targetId: '' \}\)/);
  assert.match(source, /latestFilterRef\.current = \{ action, targetType, targetId \}/);
  assert.match(source, /aria-label="감사 로그 대상 ID 필터"/);
  assert.match(source, /params\.set\('targetId', nextTargetId\)/);
  assert.match(source, /subscribeAdminRefreshEvent\(\(detail\) => \{/);
  assert.match(source, /void refresh\(\{ \.\.\.latestFilterRef\.current, nextMessage \}\)/);
  assert.match(source, /formatAuditLogRefreshMessage\(detail\.source\)/);
});

test('admin audit log panel applies dashboard preset events with an operator message', () => {
  const source = fs.readFileSync(new URL('../app/admin/audit-log-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /subscribeAdminAuditLogPresetEvent/);
  assert.match(source, /const preset = getAuditLogFilterPreset\(detail\.presetKey\)/);
  assert.match(source, /setAction\(preset\.action\)/);
  assert.match(source, /setTargetType\(preset\.targetType\)/);
  assert.match(source, /const nextTargetId = detail\.targetId \?\? ''/);
  assert.match(source, /setTargetId\(nextTargetId\)/);
  assert.match(source, /void refresh\(\{ action: preset\.action, targetType: preset\.targetType, targetId: nextTargetId, nextMessage: `\$\{preset\.label\} 감사 로그 필터를 적용했습니다\.` \}\)/);
});
