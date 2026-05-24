import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
  updateAuthenticatedUserProfile,
  verifyPasswordHash,
} from '../src/server/chart-service/index.ts';
import { createProfileImagePolicyPayload } from '../app/profile/profile-image-policy.ts';
import { getSubscriptionActionAvailability } from '../app/profile/subscription-action-policy.ts';

test('profile settings update only the authenticated users display name', () => {
  const repository = createMockChartServiceRepository();

  const user = updateAuthenticatedUserProfile(repository, {
    actor: { id: 'user_member', role: 'member' },
    name: '  Blue Trader  ',
  });

  assert.equal(user.name, 'Blue Trader');
  assert.equal(repository.getUserById('user_member')?.name, 'Blue Trader');
  assert.equal(repository.getUserById('user_subscriber')?.name, 'Subscriber');
});

test('profile settings update contact number and password with the current password', () => {
  const repository = createMockChartServiceRepository();

  const user = updateAuthenticatedUserProfile(repository, {
    actor: { id: 'user_member', role: 'member' },
    name: 'Member',
    phoneNumber: '010-9999-8888',
    currentPassword: 'Demo1234!',
    newPassword: 'NextDemo1234!',
  });

  assert.equal(user.phoneNumber, '010-9999-8888');
  assert.equal(repository.getUserById('user_member')?.phoneNumber, '010-9999-8888');
  assert.equal(verifyPasswordHash('NextDemo1234!', repository.getUserById('user_member')?.passwordHash), true);
});

test('profile settings reject password changes with a wrong current password', () => {
  const repository = createMockChartServiceRepository();
  const beforeHash = repository.getUserById('user_member')?.passwordHash;

  assert.throws(() => updateAuthenticatedUserProfile(repository, {
    actor: { id: 'user_member', role: 'member' },
    name: 'Member',
    currentPassword: 'WrongDemo1234!',
    newPassword: 'NextDemo1234!',
  }), /Current password is incorrect/);
  assert.equal(repository.getUserById('user_member')?.passwordHash, beforeHash);
});

test('profile settings reject blank display names', () => {
  const repository = createMockChartServiceRepository();

  assert.throws(() => updateAuthenticatedUserProfile(repository, {
    actor: { id: 'user_member', role: 'member' },
    name: '   ',
  }), /Profile name required/);
  assert.equal(repository.getUserById('user_member')?.name, 'Member');
});

test('profile image policy payload uses the selected browser file metadata', () => {
  assert.deepEqual(createProfileImagePolicyPayload({
    name: 'avatar.webp',
    type: 'image/webp',
    size: 120_000,
  }), {
    filename: 'avatar.webp',
    mimeType: 'image/webp',
    sizeBytes: 120_000,
  });
});

test('profile patch API updates the signed-in users dashboard name', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { PATCH } = await import('../app/api/profile/route.ts');

  const responsePromise = PATCH(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: 'Updated Member' }),
  }));
  assert.equal(typeof responsePromise?.then, 'function');

  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.dashboard.user.name, 'Updated Member');
  assert.equal(repository.getUserById('user_member')?.name, 'Updated Member');
});

test('profile patch API updates contact number and password', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { PATCH } = await import('../app/api/profile/route.ts');

  const response = await PATCH(new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Updated Member',
      phoneNumber: '010-7777-1234',
      currentPassword: 'Demo1234!',
      newPassword: 'NextDemo1234!',
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.dashboard.user.phoneNumber, '010-7777-1234');
  assert.equal(payload.dashboard.user.referralCode, repository.getUserById('user_member')?.referralCode);
  assert.equal(verifyPasswordHash('NextDemo1234!', repository.getUserById('user_member')?.passwordHash), true);
});

test('profile page and panel expose my profile edit modal and referral controls', () => {
  const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const pageSource = fs.readFileSync(new URL('../app/profile/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /isProfileEditOpen/);
  assert.match(panelSource, /openProfileEditModal/);
  assert.match(panelSource, /프로필수정/);
  assert.match(panelSource, /role="dialog"/);

  assert.match(layoutSource, /마이프로필/);
  assert.match(pageSource, /마이프로필/);
  assert.match(panelSource, /phoneDraft/);
  assert.match(panelSource, /htmlFor="profilePhoneNumber"/);
  assert.match(panelSource, /currentPassword/);
  assert.match(panelSource, /newPassword/);
  assert.match(panelSource, /dashboard\.user\.referralCode/);
  assert.match(panelSource, /\/signup\?ref=/);
});

test('profile page no longer renders the standalone subscription actions panel', () => {
  const pricingSource = fs.readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  const profileSource = fs.readFileSync(new URL('../app/profile/page.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(pricingSource, /SubscriptionActionsPanel/);
  assert.doesNotMatch(profileSource, /SubscriptionActionsPanel/);
});

test('profile service status card includes subscription request actions without rendering a duplicate card', () => {
  const profileSource = fs.readFileSync(new URL('../app/profile/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(profileSource, /<SubscriptionActionsPanel/);
  assert.match(panelSource, /getSubscriptionActionAvailability/);
  assert.match(panelSource, /requestSubscriptionAction/);
  assert.match(panelSource, /\/api\/subscription\/cancel-request/);
  assert.match(panelSource, /\/api\/subscription\/refund-request/);
  assert.match(panelSource, /disabled=\{isBusy \|\| !subscriptionActionAvailability\.canCancel\}/);
  assert.match(panelSource, /disabled=\{isBusy \|\| !subscriptionActionAvailability\.canRefund\}/);
});

test('profile subscription action policy enables buttons only for active subscriptions', () => {
  assert.deepEqual(getSubscriptionActionAvailability('active'), {
    canCancel: true,
    canRefund: true,
    reason: '활성 구독은 취소 또는 환불 요청을 접수할 수 있습니다.',
  });
  assert.deepEqual(getSubscriptionActionAvailability('expiring'), {
    canCancel: true,
    canRefund: true,
    reason: '만료 예정 구독은 취소 또는 환불 요청을 접수할 수 있습니다.',
  });
  assert.equal(getSubscriptionActionAvailability('payment_pending').canCancel, false);
  assert.equal(getSubscriptionActionAvailability('payment_requested').canRefund, false);
  assert.match(getSubscriptionActionAvailability('cancel_requested').reason, /이미 취소 요청/);
  assert.match(getSubscriptionActionAvailability('refund_requested').reason, /이미 환불 요청/);
  assert.match(getSubscriptionActionAvailability('none').reason, /활성 구독이 없습니다/);
});

test('profile edit controls move into a modal instead of inline summary edits', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(panelSource, /focusPhoneNumberEditor/);
  assert.doesNotMatch(panelSource, /aria-label="연락번호 수정"/);
  assert.match(panelSource, /profile-edit-modal-backdrop/);
  assert.match(panelSource, /profile-edit-modal/);
  assert.match(panelSource, /closeProfileEditModal/);
  assert.match(styleSource, /\.profile-edit-modal-backdrop/);
  assert.match(styleSource, /\.profile-edit-modal/);
});

test('profile edit modal closes from backdrop clicks and Escape key', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /handleProfileEditModalBackdropClick/);
  assert.match(panelSource, /handleProfileEditModalKeyDown/);
  assert.match(panelSource, /event\.currentTarget === event\.target/);
  assert.match(panelSource, /event\.key === 'Escape'/);
  assert.match(panelSource, /onClick=\{handleProfileEditModalBackdropClick\}/);
  assert.match(panelSource, /onKeyDown=\{handleProfileEditModalKeyDown\}/);
});

test('profile referral card exposes copy icon buttons for code and link', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /copyReferralValue/);
  assert.match(panelSource, /navigator\.clipboard\.writeText/);
  assert.match(panelSource, /aria-label="추천코드 복사"/);
  assert.match(panelSource, /aria-label="추천링크 복사"/);
  assert.match(panelSource, /referral-copy-row/);
  assert.match(styleSource, /\.copy-icon-button/);
  assert.match(styleSource, /\.screen-reader-only/);
});

test('profile panel renders my referral list with individual and total points', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /referrals/);
  assert.match(panelSource, /dashboard\.referrals\.referredUsers/);
  assert.match(panelSource, /pendingPoints/);
  assert.match(panelSource, /confirmedPoints/);
  assert.match(panelSource, /totalPoints/);
  assert.match(panelSource, /나의 추천리스트/);
  assert.match(panelSource, /추천개별포인트/);
});

test('profile API mutation path is routed through the async persistence boundary', () => {
  const routeSource = fs.readFileSync(new URL('../app/api/profile/route.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /getAsyncChartServicePersistence/);
  assert.match(routeSource, /runMutation/);
});

test('profile image policy API validates upload metadata for signed-in users', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { POST } = await import('../app/api/profile/image-policy/route.ts');

  const allowed = await POST(new Request('http://localhost/api/profile/image-policy', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ filename: 'avatar.webp', mimeType: 'image/webp', sizeBytes: 120_000 }),
  }));
  const denied = await POST(new Request('http://localhost/api/profile/image-policy', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ filename: 'avatar.svg', mimeType: 'image/svg+xml', sizeBytes: 12_000 }),
  }));
  const allowedPayload = await allowed.json();
  const deniedPayload = await denied.json();

  assert.equal(allowed.status, 200);
  assert.equal(allowedPayload.policy.ok, true);
  assert.equal(denied.status, 400);
  assert.equal(deniedPayload.policy.reason, 'unsupported_type');
});
