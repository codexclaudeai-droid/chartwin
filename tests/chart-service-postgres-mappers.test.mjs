import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPostgresUpsertStatement,
  createPostgresDeleteStatement,
  createPostgresSelectStatement,
  mapAuditLogDraftToPostgresRow,
  mapAuthSessionFromPostgresRow,
  mapAuthSessionToPostgresRow,
  mapNotificationFromPostgresRow,
  mapNotificationToPostgresRow,
  mapPaymentFromPostgresRow,
  mapPaymentToPostgresRow,
  mapPlanFromPostgresRow,
  mapPlanToPostgresRow,
  mapReferralLedgerFromPostgresRow,
  mapReferralLedgerToPostgresRow,
  mapSubscriptionFromPostgresRow,
  mapSubscriptionToPostgresRow,
  mapSupportMessageFromPostgresRow,
  mapSupportMessageToPostgresRow,
  mapSupportThreadFromPostgresRow,
  mapSupportThreadToPostgresRow,
  mapUserFromPostgresRow,
  mapUserToPostgresRow,
} from '../src/server/chart-service/index.ts';

test('postgres user mapper preserves auth and account fields', () => {
  const row = {
    id: 'user_1',
    email: 'member@example.com',
    name: 'Member',
    password_hash: 'pbkdf2_sha256$1$salt$hash',
    role: 'member',
    account_status: 'active',
    phone_number: '010-1000-2000',
    referral_code: 'TC-MEMBER',
    referred_by_user_id: 'user_referrer',
    created_at: '2026-05-23T10:00:00.000Z',
  };

  const record = mapUserFromPostgresRow(row);

  assert.deepEqual(record, {
    id: 'user_1',
    email: 'member@example.com',
    name: 'Member',
    passwordHash: 'pbkdf2_sha256$1$salt$hash',
    role: 'member',
    accountStatus: 'active',
    phoneNumber: '010-1000-2000',
    referralCode: 'TC-MEMBER',
    referredByUserId: 'user_referrer',
    createdAt: '2026-05-23T10:00:00.000Z',
  });
  assert.deepEqual(mapUserToPostgresRow(record), row);
});

test('postgres session subscription and payment mappers preserve nullable and numeric values', () => {
  assert.deepEqual(mapAuthSessionFromPostgresRow({
    id: 'session_1',
    user_id: 'user_1',
    created_at: '2026-05-23T10:00:00.000Z',
    expires_at: '2026-05-30T10:00:00.000Z',
  }), {
    id: 'session_1',
    userId: 'user_1',
    createdAt: '2026-05-23T10:00:00.000Z',
    expiresAt: '2026-05-30T10:00:00.000Z',
  });

  assert.deepEqual(mapAuthSessionToPostgresRow({
    id: 'session_1',
    userId: 'user_1',
    createdAt: '2026-05-23T10:00:00.000Z',
    expiresAt: '2026-05-30T10:00:00.000Z',
  }).user_id, 'user_1');

  const subscription = mapSubscriptionFromPostgresRow({
    id: 'sub_1',
    user_id: 'user_1',
    plan_id: null,
    status: 'trial_active',
    starts_at: '2026-05-23T00:00:00.000Z',
    ends_at: null,
    approved_by_admin_id: null,
    approved_at: null,
    cancelled_at: null,
    refunded_at: null,
    created_at: '2026-05-23T00:00:00.000Z',
    updated_at: '2026-05-23T00:00:00.000Z',
  });
  assert.equal(subscription.userId, 'user_1');
  assert.equal(subscription.planId, null);
  assert.equal(mapSubscriptionToPostgresRow(subscription).approved_by_admin_id, null);

  const payment = mapPaymentFromPostgresRow({
    id: 'pay_1',
    user_id: 'user_1',
    plan_id: 'plan_monthly',
    subscription_id: 'sub_1',
    support_thread_id: 'support_1',
    method: 'bank_transfer',
    amount_usd: '199.00',
    amount_krw: null,
    exchange_rate: '1390.1250',
    referral_points_used: '0',
    status: 'pending',
    depositor_name: 'Member',
    admin_note: null,
    confirmed_by_admin_id: null,
    confirmed_at: null,
    created_at: '2026-05-23T00:00:00.000Z',
    updated_at: '2026-05-23T00:00:00.000Z',
  });
  assert.equal(payment.amountUsd, 199);
  assert.equal(payment.exchangeRate, 1390.125);
  assert.equal(payment.supportThreadId, 'support_1');
  assert.equal(payment.adminNote, null);
  assert.equal(mapPaymentToPostgresRow(payment).referral_points_used, 0);
  assert.equal(mapPaymentToPostgresRow(payment).support_thread_id, 'support_1');
});

test('postgres audit row and upsert statement builder use safe parameter placeholders', () => {
  const auditRow = mapAuditLogDraftToPostgresRow({
    actorAdminId: 'admin_1',
    action: 'admin.payment.confirm',
    targetType: 'payment',
    targetId: 'pay_1',
    beforeJson: { status: 'pending' },
    afterJson: { status: 'confirmed' },
  });

  assert.deepEqual(auditRow, {
    actor_admin_id: 'admin_1',
    action: 'admin.payment.confirm',
    target_type: 'payment',
    target_id: 'pay_1',
    before_json: { status: 'pending' },
    after_json: { status: 'confirmed' },
  });

  const statement = createPostgresUpsertStatement('users', mapUserToPostgresRow({
    id: 'user_1',
    email: 'member@example.com',
    name: 'Member',
    passwordHash: 'hash',
    role: 'member',
    accountStatus: 'active',
    phoneNumber: '010-1000-2000',
    referralCode: 'TC-MEMBER',
    referredByUserId: 'user_referrer',
    createdAt: '2026-05-23T10:00:00.000Z',
  }), ['id']);

  assert.match(statement.sql, /^insert into users \(/i);
  assert.match(statement.sql, /values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10\)/i);
  assert.match(statement.sql, /on conflict \(id\) do update set/i);
  assert.deepEqual(statement.values, [
    'user_1',
    'member@example.com',
    'Member',
    'hash',
    'member',
    'active',
    '010-1000-2000',
    'TC-MEMBER',
    'user_referrer',
    '2026-05-23T10:00:00.000Z',
  ]);
});

test('postgres plan referral support and notification mappers preserve repository records', () => {
  const plan = mapPlanFromPostgresRow({
    id: 'plan_monthly',
    name: 'Monthly',
    duration_days: 30,
    base_price_usd: '199.00',
    discount_percent: '0',
    is_active: true,
  });
  assert.equal(plan.basePriceUsd, 199);
  assert.equal(mapPlanToPostgresRow(plan).duration_days, 30);

  const ledger = mapReferralLedgerFromPostgresRow({
    id: 'ref_1',
    referrer_user_id: 'user_a',
    referred_user_id: 'user_b',
    payment_request_id: 'pay_1',
    amount_usd: '199',
    percent: '20',
    points: '39.8',
    status: 'pending',
    confirm_after: '2026-05-30T00:00:00.000Z',
    confirmed_at: null,
    reversed_at: null,
    created_at: '2026-05-23T00:00:00.000Z',
  });
  assert.equal(ledger.referrerUserId, 'user_a');
  assert.equal(ledger.points, 39.8);
  assert.equal(mapReferralLedgerToPostgresRow(ledger).payment_request_id, 'pay_1');

  const thread = mapSupportThreadFromPostgresRow({
    id: 'support_1',
    author_user_id: 'user_1',
    category: 'deposit',
    title: '입금 문의',
    visibility: 'private',
    status: 'waiting',
    created_at: '2026-05-23T00:00:00.000Z',
    updated_at: '2026-05-23T00:00:00.000Z',
  });
  assert.equal(thread.authorUserId, 'user_1');
  assert.equal(mapSupportThreadToPostgresRow(thread).author_user_id, 'user_1');

  const message = mapSupportMessageFromPostgresRow({
    id: 'msg_1',
    thread_id: 'support_1',
    author_user_id: 'admin_1',
    body: '확인했습니다.',
    is_admin_reply: true,
    created_at: '2026-05-23T00:00:00.000Z',
  });
  assert.equal(message.isAdminReply, true);
  assert.equal(mapSupportMessageToPostgresRow(message).is_admin_reply, true);

  const notification = mapNotificationFromPostgresRow({
    id: 'noti_1',
    user_id: 'user_1',
    category: 'payment',
    title: '입금 확인',
    body: '승인되었습니다.',
    link_url: '/profile',
    read_at: null,
    archived_at: '2026-05-23T00:10:00.000Z',
    created_at: '2026-05-23T00:00:00.000Z',
  });
  assert.equal(notification.linkUrl, '/profile');
  assert.equal(notification.archivedAt, '2026-05-23T00:10:00.000Z');
  assert.equal(mapNotificationToPostgresRow(notification).read_at, null);
  assert.equal(mapNotificationToPostgresRow(notification).archived_at, '2026-05-23T00:10:00.000Z');
});

test('postgres select and delete statement builders keep filters parameterized', () => {
  const select = createPostgresSelectStatement('users', {
    email: 'member@example.com',
    account_status: 'active',
  }, { orderBy: ['email'] });

  assert.equal(select.sql, 'select * from users where email = $1 and account_status = $2 order by email asc');
  assert.deepEqual(select.values, ['member@example.com', 'active']);

  const selectAll = createPostgresSelectStatement('payment_requests', {}, { orderBy: ['created_at'], direction: 'desc' });
  assert.equal(selectAll.sql, 'select * from payment_requests order by created_at desc');
  assert.deepEqual(selectAll.values, []);

  const deletion = createPostgresDeleteStatement('auth_sessions', { id: 'session_1' });
  assert.equal(deletion.sql, 'delete from auth_sessions where id = $1');
  assert.deepEqual(deletion.values, ['session_1']);

  assert.throws(
    () => createPostgresSelectStatement('users;drop table users', {}),
    /Unsafe postgres identifier/,
  );
});
