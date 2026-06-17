import assert from 'node:assert/strict';
import test from 'node:test';
import {
  archiveAsyncNotificationForUser,
  archiveNotificationForUser,
  approveSubscriptionActivationRequest,
  confirmManualPaymentRequest,
  createAsyncAuthenticatedManualPaymentRequest,
  confirmAsyncManualPaymentRequest,
  createAsyncChartServiceRepository,
  createManualPaymentRequest,
  createMockChartServiceRepository,
  createSupportThread,
  createUserNotification,
  formatNotificationBadgeCount,
  listAsyncNotificationsForUser,
  listAsyncAdminPaymentQueue,
  getNotificationSummaryForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  rejectManualPaymentRequest,
  rejectSubscriptionRequest,
  replyToSupportThreadAsAdmin,
  requestSubscriptionCancellation,
} from '../src/server/chart-service/index.ts';

test('manual payment request creates a receipt notification for the requesting user', () => {
  const repository = createMockChartServiceRepository();

  const result = createManualPaymentRequest(repository, {
    userId: 'user_trial',
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T12:00:00.000Z',
    depositorName: 'Member User',
  });

  const notifications = listNotificationsForUser(repository, {
    actor: { id: 'user_trial', role: 'member' },
  });
  const receipt = notifications.find((notification) => (
    notification.category === 'payment' &&
    notification.title.includes('입금확인 요청')
  ));

  assert.equal(result.payment.status, 'pending');
  assert.equal(result.subscription.status, 'payment_pending');
  assert.ok(receipt);
  assert.match(receipt.body, /수동 확인/);
  assert.equal(receipt.linkUrl, `/profile#payment-${result.payment.id}`);
});

test('async manual payment request creates a receipt notification for the requesting user', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);

  const result = await createAsyncAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T12:00:00.000Z',
    depositorName: 'Trial User',
  });

  const notifications = await listAsyncNotificationsForUser(repository, {
    actor: { id: 'user_trial', role: 'member' },
  });
  const receipt = notifications.find((notification) => (
    notification.category === 'payment' &&
    notification.title.includes('입금확인 요청')
  ));

  assert.equal(result.payment.status, 'pending');
  assert.equal(result.subscription.status, 'payment_pending');
  assert.ok(receipt);
  assert.match(receipt.body, /수동 확인/);
  assert.equal(receipt.linkUrl, `/profile#payment-${result.payment.id}`);
});

test('async manual payment request notifies admins with direct payment queue links', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);

  const result = await createAsyncAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T12:00:00.000Z',
    depositorName: 'Trial User',
  });

  const adminNotifications = await repository.listNotificationsByUserId('admin_1');
  const superAdminNotifications = await repository.listNotificationsByUserId('super_1');
  const adminPaymentNotice = adminNotifications.find((notification) => (
    notification.category === 'payment' &&
    notification.linkUrl === `/admin#admin-payment-${result.payment.id}`
  ));
  const superAdminPaymentNotice = superAdminNotifications.find((notification) => (
    notification.category === 'payment' &&
    notification.linkUrl === `/admin#admin-payment-${result.payment.id}`
  ));
  const paymentQueue = await listAsyncAdminPaymentQueue(repository);

  assert.ok(adminPaymentNotice);
  assert.ok(superAdminPaymentNotice);
  assert.match(adminPaymentNotice.title, /입금확인 요청/);
  assert.match(adminPaymentNotice.body, /Trial User/);
  assert.equal(paymentQueue.some((item) => item.payment.id === result.payment.id), true);
});

test('async manual payment request repairs a pending subscription that has no payment request', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  await repository.saveSubscription({
    id: 'sub_dangling_payment_request',
    userId: 'user_trial',
    planId: 'plan_monthly',
    status: 'payment_pending',
    startsAt: null,
    endsAt: null,
    approvedByAdminId: null,
    approvedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: '2026-05-23T11:59:00.000Z',
    updatedAt: '2026-05-23T11:59:00.000Z',
  });

  const result = await createAsyncAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T12:00:00.000Z',
    depositorName: 'Trial User',
  });
  const paymentQueue = await listAsyncAdminPaymentQueue(repository);
  const repairedSubscription = await repository.getSubscriptionById('sub_dangling_payment_request');

  assert.equal(result.subscription.id, 'sub_dangling_payment_request');
  assert.equal(result.payment.subscriptionId, 'sub_dangling_payment_request');
  assert.equal(repairedSubscription?.updatedAt, '2026-05-23T12:00:00.000Z');
  assert.equal(paymentQueue.some((item) => item.payment.id === result.payment.id), true);
});

test('async payment confirmation notifies admins that subscription approval is waiting', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);

  const request = await createAsyncAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T12:00:00.000Z',
    depositorName: 'Trial User',
  });

  await confirmAsyncManualPaymentRequest(repository, {
    paymentId: request.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T12:10:00.000Z',
  });

  const adminNotifications = await repository.listNotificationsByUserId('admin_1');
  const superAdminNotifications = await repository.listNotificationsByUserId('super_1');
  const adminApprovalNotice = adminNotifications.find((notification) => (
    notification.category === 'subscription' &&
    notification.linkUrl === `/admin#admin-subscription-${request.subscription.id}`
  ));
  const superApprovalNotice = superAdminNotifications.find((notification) => (
    notification.category === 'subscription' &&
    notification.linkUrl === `/admin#admin-subscription-${request.subscription.id}`
  ));

  assert.ok(adminApprovalNotice);
  assert.ok(superApprovalNotice);
  assert.match(adminApprovalNotice.title, /구독승인 요청/);
  assert.match(adminApprovalNotice.body, /Trial User/);
});

test('payment confirmation creates a user notification without activating subscription', () => {
  const repository = createMockChartServiceRepository();

  const result = confirmManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T13:00:00.000Z',
    adminNote: '입금 확인 완료',
  });

  const notifications = listNotificationsForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(result.subscription.status, 'payment_requested');
  assert.equal(notifications.at(0)?.category, 'payment');
  assert.match(notifications.at(0)?.title ?? '', /입금/);
  assert.equal(notifications.at(0)?.linkUrl, '/profile#payment-pay_pending');
});

test('subscription activation approval creates a subscription notification', () => {
  const repository = createMockChartServiceRepository();
  const confirmed = confirmManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T13:00:00.000Z',
  });

  approveSubscriptionActivationRequest(repository, {
    subscriptionId: confirmed.subscription.id,
    admin: { id: 'admin_1', role: 'admin' },
    approvedAt: '2026-05-23T13:05:00.000Z',
    adminNote: '구독 승인 완료',
  });

  const notifications = listNotificationsForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(notifications.at(0)?.category, 'subscription');
  assert.match(notifications.at(0)?.title ?? '', /구독/);
  assert.equal(notifications.at(0)?.linkUrl, '/profile#payment-pay_pending');
});

test('async provisional sale confirmation creates a subscription approval notification for the member', async () => {
  const syncRepository = createMockChartServiceRepository();
  const repository = createAsyncChartServiceRepository(syncRepository);
  const request = await createAsyncAuthenticatedManualPaymentRequest(repository, {
    actor: { id: 'user_trial', role: 'member' },
    planId: 'plan_monthly',
    method: 'bank_transfer',
    requestedAt: '2026-05-23T12:00:00.000Z',
    depositorName: 'Trial User',
  });

  const result = await confirmAsyncManualPaymentRequest(repository, {
    paymentId: request.payment.id,
    admin: { id: 'admin_1', role: 'admin' },
    confirmedAt: '2026-05-23T12:10:00.000Z',
    adminNote: '가매출승인',
    provisionalSale: true,
  });
  const notifications = await repository.listNotificationsByUserId('user_trial');
  const approvalNotice = notifications.find((notification) => (
    notification.category === 'subscription' &&
    notification.title === '구독이 활성화되었습니다'
  ));

  assert.equal(result.subscription.status, 'active');
  assert.ok(approvalNotice);
  assert.match(approvalNotice.body, /구독 승인/);
  assert.equal(approvalNotice.linkUrl, `/profile#payment-${request.payment.id}`);
});

test('payment rejection creates a user notification with the admin note', () => {
  const repository = createMockChartServiceRepository();

  rejectManualPaymentRequest(repository, {
    paymentId: 'pay_pending',
    admin: { id: 'admin_1', role: 'admin' },
    rejectedAt: '2026-05-23T13:00:00.000Z',
    adminNote: '입금 내역 확인 불가',
  });

  const notifications = listNotificationsForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(notifications.at(0)?.category, 'payment');
  assert.match(notifications.at(0)?.body ?? '', /입금 내역 확인 불가/);
  assert.equal(notifications.at(0)?.linkUrl, '/profile#payment-pay_pending');
});

test('subscription request rejection creates a user notification', () => {
  const repository = createMockChartServiceRepository();
  const requested = requestSubscriptionCancellation(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    requestedAt: '2026-05-23T13:00:00.000Z',
  });

  rejectSubscriptionRequest(repository, {
    subscriptionId: requested.id,
    admin: { id: 'admin_1', role: 'admin' },
    rejectedAt: '2026-05-23T13:05:00.000Z',
    adminNote: '요청 사유 확인 필요',
  });

  const notifications = listNotificationsForUser(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
  });

  assert.equal(notifications.at(0)?.category, 'subscription');
  assert.match(notifications.at(0)?.body ?? '', /요청 사유 확인 필요/);
});

test('support admin reply creates a support notification for the thread owner', () => {
  const repository = createMockChartServiceRepository();
  const { thread } = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'usage',
    title: '차트 질문',
    body: '사용법 문의입니다.',
    visibility: 'private',
    createdAt: '2026-05-23T13:00:00.000Z',
  });

  replyToSupportThreadAsAdmin(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    threadId: thread.id,
    body: '답변 완료했습니다.',
    createdAt: '2026-05-23T13:05:00.000Z',
  });

  const notifications = listNotificationsForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(notifications.at(0)?.category, 'support_reply');
  assert.match(notifications.at(0)?.title ?? '', /고객센터/);
  assert.equal(notifications.at(0)?.linkUrl, `/support?thread=${thread.id}#support-${thread.id}`);
});

test('notification summary counts unread notifications for a user', () => {
  const repository = createMockChartServiceRepository();
  createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: '첫 번째 알림',
    body: '확인 필요',
    createdAt: '2026-05-23T13:00:00.000Z',
  });
  createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: '두 번째 알림',
    body: '확인 필요',
    createdAt: '2026-05-23T13:01:00.000Z',
  });

  const summary = getNotificationSummaryForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(summary.totalCount, 2);
  assert.equal(summary.unreadCount, 2);
});

test('archived notifications are hidden from user lists and summaries', () => {
  const repository = createMockChartServiceRepository();
  const archivedSource = createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: 'Archive me',
    body: 'This notification is done.',
    createdAt: '2026-05-23T13:00:00.000Z',
  });
  const visibleSource = createUserNotification(repository, {
    userId: 'user_member',
    category: 'payment',
    title: 'Keep visible',
    body: 'This notification still needs attention.',
    createdAt: '2026-05-23T13:01:00.000Z',
  });

  const archived = archiveNotificationForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    notificationId: archivedSource.id,
    archivedAt: '2026-05-23T13:02:00.000Z',
  });
  const notifications = listNotificationsForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });
  const summary = getNotificationSummaryForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(archived.archivedAt, '2026-05-23T13:02:00.000Z');
  assert.deepEqual(notifications.map((notification) => notification.id), [visibleSource.id]);
  assert.equal(summary.totalCount, 1);
  assert.equal(summary.unreadCount, 1);
});

test('user can mark one own notification as read', () => {
  const repository = createMockChartServiceRepository();
  const notification = createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: '읽음 처리 대상',
    body: '확인 필요',
    createdAt: '2026-05-23T13:00:00.000Z',
  });

  const result = markNotificationReadForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    notificationId: notification.id,
    readAt: '2026-05-23T13:02:00.000Z',
  });

  assert.equal(result.readAt, '2026-05-23T13:02:00.000Z');
  assert.equal(getNotificationSummaryForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  }).unreadCount, 0);
});

test('mark all read ignores archived notifications', () => {
  const repository = createMockChartServiceRepository();
  const archivedSource = createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: 'Archived unread',
    body: 'This one should stay unread while archived.',
    createdAt: '2026-05-23T13:00:00.000Z',
  });
  createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: 'Visible unread',
    body: 'This one should be marked read.',
    createdAt: '2026-05-23T13:01:00.000Z',
  });
  archiveNotificationForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    notificationId: archivedSource.id,
    archivedAt: '2026-05-23T13:02:00.000Z',
  });

  const result = markAllNotificationsReadForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    readAt: '2026-05-23T13:03:00.000Z',
  });
  const storedArchived = repository
    .listNotificationsByUserId('user_member')
    .find((notification) => notification.id === archivedSource.id);

  assert.equal(result.updatedCount, 1);
  assert.equal(storedArchived?.readAt, null);
});

test('user can mark all own notifications as read', () => {
  const repository = createMockChartServiceRepository();
  createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: '첫 번째 알림',
    body: '확인 필요',
    createdAt: '2026-05-23T13:00:00.000Z',
  });
  createUserNotification(repository, {
    userId: 'user_member',
    category: 'notice',
    title: '두 번째 알림',
    body: '확인 필요',
    createdAt: '2026-05-23T13:01:00.000Z',
  });

  const result = markAllNotificationsReadForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    readAt: '2026-05-23T13:03:00.000Z',
  });

  assert.equal(result.updatedCount, 2);
  assert.equal(getNotificationSummaryForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  }).unreadCount, 0);
});

test('notification badge count is hidden at zero and capped above 99', () => {
  assert.equal(formatNotificationBadgeCount(0), null);
  assert.equal(formatNotificationBadgeCount(1), '1');
  assert.equal(formatNotificationBadgeCount(99), '99');
  assert.equal(formatNotificationBadgeCount(100), '99+');
});

test('async notification archive hides a notification from async user lists', async () => {
  const syncRepository = createMockChartServiceRepository();
  const notification = createUserNotification(syncRepository, {
    userId: 'user_member',
    category: 'notice',
    title: 'Async archive me',
    body: 'This notification is done.',
    createdAt: '2026-05-23T13:00:00.000Z',
  });
  const repository = createAsyncChartServiceRepository(syncRepository);

  const archived = await archiveAsyncNotificationForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    notificationId: notification.id,
    archivedAt: '2026-05-23T13:02:00.000Z',
  });
  const notifications = await listAsyncNotificationsForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
  });

  assert.equal(archived.archivedAt, '2026-05-23T13:02:00.000Z');
  assert.deepEqual(notifications, []);
});
