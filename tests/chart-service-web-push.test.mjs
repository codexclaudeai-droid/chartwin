import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createMockChartServiceRepository } from '../src/server/chart-service/index.ts';

const repositorySource = readFileSync(new URL('../src/server/chart-service/repository.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../src/server/chart-service/database-schema.ts', import.meta.url), 'utf8');
const notificationSource = readFileSync(new URL('../src/server/chart-service/async-service.ts', import.meta.url), 'utf8');
const notificationPanelSource = readFileSync(new URL('../app/notifications/notifications-panel.tsx', import.meta.url), 'utf8');
const profilePanelSource = readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
const supportAdminNotificationSource = readFileSync(new URL('../src/server/chart-service/support-admin-notifications.ts', import.meta.url), 'utf8');

test('web push subscriptions are stored per signed-in user and can be removed', async () => {
  const serviceExports = await import('../src/server/chart-service/index.ts');
  const {
    registerPushSubscriptionForUser,
    unregisterPushSubscriptionForUser,
  } = serviceExports;
  assert.equal(typeof registerPushSubscriptionForUser, 'function');
  assert.equal(typeof unregisterPushSubscriptionForUser, 'function');

  const repository = createMockChartServiceRepository();
  const now = '2026-06-04T12:00:00.000Z';
  const subscription = {
    endpoint: 'https://push.example.test/send/abc',
    expirationTime: null,
    keys: {
      p256dh: 'p256dh-key',
      auth: 'auth-key',
    },
  };

  const saved = registerPushSubscriptionForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    subscription,
    userAgent: 'test-browser',
    now,
  });

  assert.equal(saved.userId, 'user_member');
  assert.equal(saved.endpoint, subscription.endpoint);
  assert.equal(saved.p256dh, 'p256dh-key');
  assert.equal(saved.auth, 'auth-key');
  assert.equal(saved.createdAt, now);
  assert.equal(saved.updatedAt, now);
  assert.equal(repository.listPushSubscriptionsByUserId('user_member').length, 1);

  const updated = registerPushSubscriptionForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    subscription: {
      ...subscription,
      keys: {
        p256dh: 'next-p256dh-key',
        auth: 'next-auth-key',
      },
    },
    userAgent: 'next-browser',
    now: '2026-06-04T12:05:00.000Z',
  });

  assert.equal(updated.p256dh, 'next-p256dh-key');
  assert.equal(updated.auth, 'next-auth-key');
  assert.equal(updated.createdAt, now);
  assert.equal(updated.updatedAt, '2026-06-04T12:05:00.000Z');
  assert.equal(repository.listPushSubscriptionsByUserId('user_member').length, 1);

  const removed = unregisterPushSubscriptionForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    endpoint: subscription.endpoint,
  });
  assert.equal(removed, true);
  assert.equal(repository.listPushSubscriptionsByUserId('user_member').length, 0);
});

test('web push endpoint ownership moves to the latest signed-in user', async () => {
  const serviceExports = await import('../src/server/chart-service/index.ts');
  const { registerPushSubscriptionForUser } = serviceExports;
  const repository = createMockChartServiceRepository();
  const subscription = {
    endpoint: 'https://push.example.test/send/same-device',
    expirationTime: null,
    keys: {
      p256dh: 'p256dh-key',
      auth: 'auth-key',
    },
  };

  registerPushSubscriptionForUser(repository, {
    actor: { id: 'user_member', role: 'member' },
    subscription,
    userAgent: 'test-browser',
    now: '2026-06-04T12:00:00.000Z',
  });

  const moved = registerPushSubscriptionForUser(repository, {
    actor: { id: 'admin_1', role: 'admin' },
    subscription: {
      ...subscription,
      keys: {
        p256dh: 'admin-p256dh-key',
        auth: 'admin-auth-key',
      },
    },
    userAgent: 'same-browser-admin',
    now: '2026-06-04T12:05:00.000Z',
  });

  assert.equal(moved.userId, 'admin_1');
  assert.equal(repository.listPushSubscriptionsByUserId('user_member').length, 0);
  const adminSubscriptions = repository.listPushSubscriptionsByUserId('admin_1');
  assert.equal(adminSubscriptions.length, 1);
  assert.equal(adminSubscriptions[0].endpoint, subscription.endpoint);
  assert.equal(adminSubscriptions[0].p256dh, 'admin-p256dh-key');
});

test('web push database and repository expose subscription persistence', () => {
  assert.match(repositorySource, /export type PushSubscriptionRecord = \{/);
  assert.match(repositorySource, /listPushSubscriptionsByUserId\(userId: string\): PushSubscriptionRecord\[\];/);
  assert.match(repositorySource, /savePushSubscription\(subscription: PushSubscriptionRecord\): void;/);
  assert.match(repositorySource, /deletePushSubscription\(userId: string, endpoint: string\): void;/);

  assert.match(schemaSource, /name: 'push_subscriptions'/);
  assert.match(schemaSource, /endpoint: \{ type: 'text', primaryKey: true \}/);
  assert.match(schemaSource, /idx_push_subscriptions_user_id/);
  assert.match(schemaSource, /create table if not exists push_subscriptions/);
});

test('web push routes service worker and notification panel are wired', () => {
  const publicKeyRoute = readFileSync(new URL('../app/api/push/public-key/route.ts', import.meta.url), 'utf8');
  const subscribeRoute = readFileSync(new URL('../app/api/push/subscribe/route.ts', import.meta.url), 'utf8');
  const unsubscribeRoute = readFileSync(new URL('../app/api/push/unsubscribe/route.ts', import.meta.url), 'utf8');
  const testRoute = readFileSync(new URL('../app/api/push/test/route.ts', import.meta.url), 'utf8');
  const serviceWorkerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const clientSource = readFileSync(new URL('../app/shared/push-notification-control.tsx', import.meta.url), 'utf8');
  const styleSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const pushClientSource = readFileSync(new URL('../app/push-subscription-client.ts', import.meta.url), 'utf8');
  const sessionNavSource = readFileSync(new URL('../app/session-nav.tsx', import.meta.url), 'utf8');
  const loginPanelSource = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(publicKeyRoute, /getWebPushPublicKey/);
  assert.match(subscribeRoute, /registerPushSubscriptionForUser/);
  assert.match(unsubscribeRoute, /unregisterPushSubscriptionForUser/);
  assert.match(testRoute, /notifyUserPushSubscriptions/);
  assert.match(testRoute, /saveNotification/);
  assert.match(testRoute, /isPushTestAllowed/);
  assert.match(testRoute, /actor\.role === USER_ROLES\.admin/);
  assert.match(testRoute, /actor\.role === USER_ROLES\.superAdmin/);
  assert.match(testRoute, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(serviceWorkerSource, /self\.addEventListener\('push'/);
  assert.match(serviceWorkerSource, /postMessage\(\{ type: 'chart-service-notifications-refresh' \}\)/);
  assert.match(serviceWorkerSource, /\/api\/notifications\?summary=1/);
  assert.match(serviceWorkerSource, /self\.registration\.showNotification/);
  assert.match(pushClientSource, /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(pushClientSource, /pushManager\.subscribe/);
  assert.match(pushClientSource, /\/api\/push\/subscribe/);
  assert.match(pushClientSource, /\/api\/push\/unsubscribe/);
  assert.match(pushClientSource, /syncExistingBrowserPushSubscriptionForCurrentUser/);
  assert.match(clientSource, /createBrowserPushSubscription/);
  assert.match(clientSource, /syncCurrentBrowserPushSubscription/);
  assert.match(clientSource, /\/api\/push\/test/);
  assert.match(clientSource, /testPush/);
  assert.match(clientSource, /canSendTestPush/);
  assert.match(clientSource, /\{isSubscribed && canSendTestPush && \(/);
  assert.match(clientSource, /role="switch"/);
  assert.match(clientSource, /aria-checked=\{isSubscribed\}/);
  assert.match(clientSource, /앱 푸시 알림 켜기/);
  assert.match(clientSource, /앱 푸시 알림 끄기/);
  assert.match(clientSource, /push-notification-toggle/);
  assert.match(clientSource, /push-notification-toggle-state/);
  assert.match(clientSource, /\{isSubscribed \? 'ON' : 'OFF'\}/);
  assert.match(styleSource, /\.push-notification-toggle-state\s*\{[\s\S]*?font-weight: 500/);
  assert.match(styleSource, /\.push-notification-toggle-state\s*\{[\s\S]*?letter-spacing: 0\.04em/);
  assert.match(styleSource, /\.push-notification-toggle-track\s*\{[\s\S]*?width: 68px/);
  assert.match(styleSource, /\.push-notification-toggle\.active \.push-notification-toggle-thumb\s*\{[\s\S]*?translateX\(38px\)/);
  assert.match(styleSource, /\.profile-page \.button\.secondary\.compact\.push-notification-test-button\s*\{[\s\S]*?height: 30px/);
  assert.match(styleSource, /\.profile-page \.button\.secondary\.compact\.push-notification-test-button\s*\{[\s\S]*?min-height: 30px/);
  assert.match(styleSource, /\.push-notification-test-button\s*\{[\s\S]*?align-items: center/);
  assert.match(profilePanelSource, /canSendProfilePushTest/);
  assert.match(profilePanelSource, /<PushNotificationControl canSendTestPush=\{canSendProfilePushTest\(dashboard\.user\.role\)\} \/>/);
  assert.match(profilePanelSource, /profile-push-setting-row/);
  assert.doesNotMatch(notificationPanelSource, /<PushNotificationControl \/>/);
  assert.match(sessionNavSource, /detachBrowserPushSubscriptionForCurrentUser/);
  assert.match(sessionNavSource, /syncExistingBrowserPushSubscriptionForCurrentUser/);
  assert.match(loginPanelSource, /detachBrowserPushSubscriptionForCurrentUser/);
  assert.match(loginPanelSource, /syncExistingBrowserPushSubscriptionForCurrentUser/);
});

test('new async notifications attempt web push delivery without blocking notification creation', () => {
  assert.match(notificationSource, /notifyUserPushSubscriptions\(repository, notification\)/);
  assert.match(notificationSource, /\.catch\(\(\) => \{\}\)/);
  assert.match(supportAdminNotificationSource, /notifyUserPushSubscriptions\(repository, notification\)/);
});
