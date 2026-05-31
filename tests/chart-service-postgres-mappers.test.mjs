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
  mapNoticePopupFromPostgresRow,
  mapNoticePopupToPostgresRow,
  mapPaymentFromPostgresRow,
  mapPaymentToPostgresRow,
  mapPaymentTransferSettingsFromPostgresRow,
  mapPaymentTransferSettingsToPostgresRow,
  mapPlanFromPostgresRow,
  mapPlanToPostgresRow,
  mapPublicBoardPostFromPostgresRow,
  mapPublicBoardPostToPostgresRow,
  mapReferralProgramSettingsFromPostgresRow,
  mapReferralProgramSettingsToPostgresRow,
  mapReferralLedgerFromPostgresRow,
  mapReferralLedgerToPostgresRow,
  mapSalesTeamFromPostgresRow,
  mapSalesTeamToPostgresRow,
  mapSignupAgreementFromPostgresRow,
  mapSignupAgreementToPostgresRow,
  mapSocialAuthAccountFromPostgresRow,
  mapSocialAuthAccountToPostgresRow,
  mapSubscriptionFromPostgresRow,
  mapSubscriptionToPostgresRow,
  mapSupportMessageFromPostgresRow,
  mapSupportMessageToPostgresRow,
  mapSupportThreadFromPostgresRow,
  mapSupportThreadToPostgresRow,
  mapUserFromPostgresRow,
  mapUserToPostgresRow,
  mapWebInfoSettingsFromPostgresRow,
  mapWebInfoSettingsToPostgresRow,
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
    profile_image_data_url: 'data:image/png;base64,AAAA',
    referral_code: 'TC-MEMBER',
    referred_by_user_id: 'user_referrer',
    created_at: '2026-05-23T10:00:00.000Z',
    email_verified_at: '2026-05-23T10:05:00.000Z',
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
    profileImageDataUrl: 'data:image/png;base64,AAAA',
    referralCode: 'TC-MEMBER',
    referredByUserId: 'user_referrer',
    createdAt: '2026-05-23T10:00:00.000Z',
    emailVerifiedAt: '2026-05-23T10:05:00.000Z',
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
    transaction_id: '0xabc123txid',
    transaction_verification_status: 'verified',
    transaction_verification_message: 'TronScan confirmed 199 USDT',
    transaction_verified_at: '2026-05-23T00:10:00.000Z',
    admin_note: null,
    confirmed_by_admin_id: null,
    confirmed_at: null,
    created_at: '2026-05-23T00:00:00.000Z',
    updated_at: '2026-05-23T00:00:00.000Z',
  });
  assert.equal(payment.amountUsd, 199);
  assert.equal(payment.exchangeRate, 1390.125);
  assert.equal(payment.supportThreadId, 'support_1');
  assert.equal(payment.transactionId, '0xabc123txid');
  assert.equal(payment.transactionVerificationStatus, 'verified');
  assert.equal(payment.transactionVerificationMessage, 'TronScan confirmed 199 USDT');
  assert.equal(payment.transactionVerifiedAt, '2026-05-23T00:10:00.000Z');
  assert.equal(payment.adminNote, null);
  assert.equal(mapPaymentToPostgresRow(payment).referral_points_used, 0);
  assert.equal(mapPaymentToPostgresRow(payment).support_thread_id, 'support_1');
  assert.equal(mapPaymentToPostgresRow(payment).transaction_id, '0xabc123txid');
  assert.equal(mapPaymentToPostgresRow(payment).transaction_verification_status, 'verified');
  assert.equal(mapPaymentToPostgresRow(payment).transaction_verification_message, 'TronScan confirmed 199 USDT');
  assert.equal(mapPaymentToPostgresRow(payment).transaction_verified_at, '2026-05-23T00:10:00.000Z');
});

test('postgres social auth mapper preserves provider account links', () => {
  const record = mapSocialAuthAccountFromPostgresRow({
    id: 'social_auth_1',
    provider: 'google',
    provider_user_id: 'google-123',
    user_id: 'user_1',
    email: 'member@example.com',
    created_at: '2026-06-01T10:00:00.000Z',
    updated_at: '2026-06-01T10:01:00.000Z',
  });

  assert.deepEqual(record, {
    id: 'social_auth_1',
    provider: 'google',
    providerUserId: 'google-123',
    userId: 'user_1',
    email: 'member@example.com',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:01:00.000Z',
  });
  assert.deepEqual(mapSocialAuthAccountToPostgresRow(record), {
    id: 'social_auth_1',
    provider: 'google',
    provider_user_id: 'google-123',
    user_id: 'user_1',
    email: 'member@example.com',
    created_at: '2026-06-01T10:00:00.000Z',
    updated_at: '2026-06-01T10:01:00.000Z',
  });
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
    profileImageDataUrl: 'data:image/png;base64,AAAA',
    referralCode: 'TC-MEMBER',
    referredByUserId: 'user_referrer',
    createdAt: '2026-05-23T10:00:00.000Z',
    emailVerifiedAt: '2026-05-23T10:05:00.000Z',
  }), ['id']);

  assert.match(statement.sql, /^insert into users \(/i);
  assert.match(statement.sql, /values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12\)/i);
  assert.match(statement.sql, /on conflict \(id\) do update set/i);
  assert.deepEqual(statement.values, [
    'user_1',
    'member@example.com',
    'Member',
    'hash',
    'member',
    'active',
    '010-1000-2000',
    'data:image/png;base64,AAAA',
    'TC-MEMBER',
    'user_referrer',
    '2026-05-23T10:00:00.000Z',
    '2026-05-23T10:05:00.000Z',
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

  const settings = mapReferralProgramSettingsFromPostgresRow({
    id: 'default',
    subscriber_cashback_percent: '3',
    reward_percent: '10',
    salesperson_reward_percent: '30',
    sales_team_reward_percent: '50',
    updated_by_admin_id: 'super_1',
    updated_at: '2026-05-24T10:00:00.000Z',
  });
  assert.equal(settings.subscriberCashbackPercent, 3);
  assert.equal(settings.rewardPercent, 10);
  assert.equal(settings.salespersonRewardPercent, 30);
  assert.equal(settings.salesTeamRewardPercent, 50);
  assert.equal(mapReferralProgramSettingsToPostgresRow(settings).subscriber_cashback_percent, 3);
  assert.equal(mapReferralProgramSettingsToPostgresRow(settings).reward_percent, 10);
  assert.equal(mapReferralProgramSettingsToPostgresRow(settings).salesperson_reward_percent, 30);
  assert.equal(mapReferralProgramSettingsToPostgresRow(settings).sales_team_reward_percent, 50);

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

test('postgres sales team mapper preserves team commission and member assignments', () => {
  const team = mapSalesTeamFromPostgresRow({
    id: 'sales_team_1',
    name: 'Alpha Team',
    commission_percent: '35',
    salesperson_ids: ['user_sales_1', 'user_sales_2'],
    created_at: '2026-05-25T00:00:00.000Z',
    updated_at: '2026-05-25T01:00:00.000Z',
    updated_by_admin_id: 'super_1',
  });

  assert.deepEqual(team, {
    id: 'sales_team_1',
    name: 'Alpha Team',
    commissionPercent: 35,
    salespersonIds: ['user_sales_1', 'user_sales_2'],
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T01:00:00.000Z',
    updatedByAdminId: 'super_1',
  });
  assert.deepEqual(mapSalesTeamToPostgresRow(team), {
    id: 'sales_team_1',
    name: 'Alpha Team',
    commission_percent: 35,
    salesperson_ids: ['user_sales_1', 'user_sales_2'],
    created_at: '2026-05-25T00:00:00.000Z',
    updated_at: '2026-05-25T01:00:00.000Z',
    updated_by_admin_id: 'super_1',
  });
});

test('postgres payment transfer settings mapper preserves bank and USDT instructions', () => {
  const settings = mapPaymentTransferSettingsFromPostgresRow({
    id: 'default',
    bank_name: 'KB국민은행',
    bank_account_number: '123-456-7890',
    bank_account_holder: 'TradingCore',
    bank_logo_url: '/bank-logos/kb.svg',
    usdt_address: 'TXYZ123456789',
    usdt_network: 'TRC20',
    updated_by_admin_id: 'admin_1',
    updated_at: '2026-05-25T02:00:00.000Z',
  });

  assert.deepEqual(settings, {
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
  assert.deepEqual(mapPaymentTransferSettingsToPostgresRow(settings), {
    id: 'default',
    bank_name: 'KB국민은행',
    bank_account_number: '123-456-7890',
    bank_account_holder: 'TradingCore',
    bank_logo_url: '/bank-logos/kb.svg',
    usdt_address: 'TXYZ123456789',
    usdt_network: 'TRC20',
    updated_by_admin_id: 'admin_1',
    updated_at: '2026-05-25T02:00:00.000Z',
  });
});

test('postgres web info settings mapper preserves signup policy content', () => {
  const settings = mapWebInfoSettingsFromPostgresRow({
    id: 'default',
    terms_content: 'Terms content',
    privacy_content: 'Privacy content',
    plan_services_json: {
      plan_monthly: ['월간 차트 접근'],
      plan_half_year: ['6개월 혜택'],
      plan_yearly: ['연간 혜택'],
    },
    updated_by_admin_id: 'admin_1',
    updated_at: '2026-05-25T05:00:00.000Z',
  });

  assert.deepEqual(settings, {
    id: 'default',
    termsContent: 'Terms content',
    privacyContent: 'Privacy content',
    planServices: {
      plan_monthly: ['월간 차트 접근'],
      plan_half_year: ['6개월 혜택'],
      plan_yearly: ['연간 혜택'],
    },
    updatedByAdminId: 'admin_1',
    updatedAt: '2026-05-25T05:00:00.000Z',
  });
  assert.deepEqual(mapWebInfoSettingsToPostgresRow(settings), {
    id: 'default',
    terms_content: 'Terms content',
    privacy_content: 'Privacy content',
    plan_services_json: {
      plan_monthly: ['월간 차트 접근'],
      plan_half_year: ['6개월 혜택'],
      plan_yearly: ['연간 혜택'],
    },
    updated_by_admin_id: 'admin_1',
    updated_at: '2026-05-25T05:00:00.000Z',
  });
});

test('postgres signup agreement mapper preserves policy evidence snapshots', () => {
  const agreement = mapSignupAgreementFromPostgresRow({
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
  });

  assert.deepEqual(agreement, {
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
  assert.deepEqual(mapSignupAgreementToPostgresRow(agreement), {
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
  });
});

test('postgres public board post mapper preserves publishing controls', () => {
  const post = mapPublicBoardPostFromPostgresRow({
    id: 'public_board_notice',
    category: 'notice',
    title: 'Service notice',
    body: 'Published notice body',
    is_published: true,
    sort_order: '3',
    created_at: '2026-05-25T09:00:00.000Z',
    updated_at: '2026-05-25T10:00:00.000Z',
    updated_by_admin_id: null,
  });

  assert.deepEqual(post, {
    id: 'public_board_notice',
    category: 'notice',
    title: 'Service notice',
    body: 'Published notice body',
    isPublished: true,
    sortOrder: 3,
    createdAt: '2026-05-25T09:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    updatedByAdminId: null,
  });
  assert.deepEqual(mapPublicBoardPostToPostgresRow(post), {
    id: 'public_board_notice',
    category: 'notice',
    title: 'Service notice',
    body: 'Published notice body',
    is_published: true,
    sort_order: 3,
    created_at: '2026-05-25T09:00:00.000Z',
    updated_at: '2026-05-25T10:00:00.000Z',
    updated_by_admin_id: null,
  });
});

test('postgres notice popup mapper preserves schedule controls', () => {
  const popup = mapNoticePopupFromPostgresRow({
    id: 'notice_popup_1',
    title: 'Scheduled notice',
    body_html: '<p>Notice body</p>',
    is_active: true,
    sort_order: '7',
    start_at: '2026-05-31T00:00:00.000Z',
    end_at: '2026-05-31T23:59:00.000Z',
    created_at: '2026-05-30T09:00:00.000Z',
    updated_at: '2026-05-30T10:00:00.000Z',
    updated_by_admin_id: 'admin_1',
  });

  assert.deepEqual(popup, {
    id: 'notice_popup_1',
    title: 'Scheduled notice',
    bodyHtml: '<p>Notice body</p>',
    isActive: true,
    sortOrder: 7,
    startAt: '2026-05-31T00:00:00.000Z',
    endAt: '2026-05-31T23:59:00.000Z',
    createdAt: '2026-05-30T09:00:00.000Z',
    updatedAt: '2026-05-30T10:00:00.000Z',
    updatedByAdminId: 'admin_1',
  });
  assert.deepEqual(mapNoticePopupToPostgresRow(popup), {
    id: 'notice_popup_1',
    title: 'Scheduled notice',
    body_html: '<p>Notice body</p>',
    is_active: true,
    sort_order: 7,
    start_at: '2026-05-31T00:00:00.000Z',
    end_at: '2026-05-31T23:59:00.000Z',
    created_at: '2026-05-30T09:00:00.000Z',
    updated_at: '2026-05-30T10:00:00.000Z',
    updated_by_admin_id: 'admin_1',
  });
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
