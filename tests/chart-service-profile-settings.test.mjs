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

test('profile image upload route stores the avatar data url on the dashboard user', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { POST } = await import('../app/api/profile/avatar/route.ts');
  const dataUrl = 'data:image/png;base64,AAAA';

  const response = await POST(new Request('http://localhost/api/profile/avatar', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      filename: 'avatar.png',
      mimeType: 'image/png',
      sizeBytes: 4,
      dataUrl,
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.dashboard.user.profileImageDataUrl, dataUrl);
  assert.equal(repository.getUserById('user_member')?.profileImageDataUrl, dataUrl);
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

test('profile delete API withdraws the signed-in member and clears active sessions', async () => {
  const repository = getChartServiceRepository();
  const user = repository.getUserById('user_trial');
  assert.ok(user);
  repository.saveUser({ ...user, accountStatus: 'active' });
  const { session } = createSessionForUser(repository, {
    userId: 'user_trial',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { DELETE } = await import('../app/api/profile/route.ts');

  const response = await DELETE(new Request('http://localhost/api/profile', {
    method: 'DELETE',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
    },
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(repository.getUserById('user_trial')?.accountStatus, 'suspended');
  assert.equal(repository.listSessionsByUserId('user_trial').length, 0);
  assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/);
});

test('profile page and panel expose my profile edit modal and referral controls', () => {
  const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const pageSource = fs.readFileSync(new URL('../app/profile/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /isProfileEditOpen/);
  assert.match(panelSource, /openProfileEditModal/);
  assert.match(panelSource, /프로필수정/);
  assert.match(panelSource, /role="dialog"/);

  assert.match(layoutSource, /ProfileNavLink/);
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
  assert.match(panelSource, /dashboard\.subscription\?\.startsAt/);
  assert.match(panelSource, /시작일/);
  assert.match(panelSource, /만료일/);
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
  assert.match(styleSource, /\.profile-edit-modal input/);
  assert.match(styleSource, /min-height: 52px/);
  assert.match(styleSource, /background: #07101f/);
});

test('profile edit modal closes from backdrop clicks and Escape key', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /handleProfileEditModalBackdropClick/);
  assert.match(panelSource, /handleProfileEditModalKeyDown/);
  assert.match(panelSource, /event\.currentTarget === event\.target/);
  assert.match(panelSource, /event\.key === 'Escape'/);
  assert.match(panelSource, /onClick=\{handleProfileEditModalBackdropClick\}/);
  assert.match(panelSource, /onKeyDown=\{handleProfileEditModalKeyDown\}/);
  assert.match(panelSource, /className="mobile-nav-panel-close profile-edit-close"/);
  assert.match(styleSource, /\.profile-edit-close span:nth-child\(1\)/);
});

test('profile referral card exposes copy icon buttons for code and link', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /copyReferralValue/);
  assert.match(panelSource, /navigator\.clipboard\.writeText/);
  assert.match(panelSource, /copyTextWithHiddenTextarea/);
  assert.match(panelSource, /document\.execCommand\('copy'\)/);
  assert.match(panelSource, /referralCopyMessage/);
  assert.match(panelSource, /className="referral-copy-message"/);
  assert.match(panelSource, /role="status"/);
  assert.match(panelSource, /회원 초대 시 이 코드를 입력하면 추천인 정보가 입력됩니다\./);
  assert.match(panelSource, /회원 초대 시 이 링크를 전달하면 추천인 정보가 자동입력됩니다\./);
  assert.match(panelSource, /window\.alert\(getReferralCopyAlertMessage\(label\)\)/);
  assert.match(panelSource, /추천코드가 카피되었습니다/);
  assert.match(panelSource, /추천링크가 카피되었습니다/);
  assert.doesNotMatch(panelSource, /회원 초대 시 이 링크를 전달하면 추천인 정보를 추적할 수 있습니다\./);
  assert.match(panelSource, /aria-label="추천코드 복사"/);
  assert.match(panelSource, /aria-label="추천링크 복사"/);
  assert.match(panelSource, /aria-label="추천링크 공유"/);
  assert.match(panelSource, /navigator\.share/);
  assert.match(panelSource, /추천코드.*복사했습니다|추천코드.*복사/);
  assert.match(panelSource, /CopyIcon/);
  assert.match(panelSource, /ShareIcon/);
  assert.match(panelSource, /<rect x="5\.5" y="8\.5"/);
  assert.match(panelSource, /<rect x="9" y="5"/);
  assert.match(panelSource, /<circle cx="7" cy="12"/);
  assert.match(panelSource, /referral-copy-row/);
  assert.match(styleSource, /\.referral-icon-button/);
  assert.match(styleSource, /\.referral-copy-message/);
  assert.match(styleSource, /\.referral-card \.referral-copy-message\s*\{[\s\S]*?color: var\(--muted\)/);
  assert.match(styleSource, /body:not\(:has\(\.landing-page\)\) \.profile-page \.referral-card \.referral-copy-message\s*\{[\s\S]*?color: rgba\(216, 236, 255, 0\.68\)/);
  assert.match(styleSource, /\.profile-page \.referral-card\s*\{[\s\S]*?background: transparent/);
  assert.match(styleSource, /\.profile-page \.referral-card\s*\{[\s\S]*?border-top: 1px solid var\(--line\)/);
  assert.match(styleSource, /body:not\(:has\(\.landing-page\)\) \.profile-page \.referral-card\s*\{[\s\S]*?border-top: 1px solid rgba\(125, 183, 255, 0\.14\)/);
  assert.match(styleSource, /background: transparent/);
  assert.match(styleSource, /border: 0/);
  assert.match(styleSource, /outline: 0/);
  assert.match(styleSource, /\.screen-reader-only/);
});

test('profile edit modal reuses signup phone formatting and password guidance', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /formatSignupPhoneNumber/);
  assert.match(panelSource, /handleProfilePhoneNumberChange/);
  assert.match(panelSource, /inputMode="numeric"/);
  assert.match(panelSource, /maxLength=\{13\}/);
  assert.match(panelSource, /8자리 이상, 대문자, 숫자, 특수문자/);
});

test('profile panel exposes a member withdrawal danger action', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /withdrawAccount/);
  assert.match(panelSource, /method: 'DELETE'/);
  assert.match(panelSource, /회원탈퇴/);
  assert.match(panelSource, /canWithdrawAccount/);
  assert.match(panelSource, /\{canWithdraw && \(/);
  assert.doesNotMatch(panelSource, /관리자 계정은 회원관리/);
});

test('profile image file control keeps the picker and guide text vertically aligned', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /profile-card-header/);
  assert.doesNotMatch(panelSource, /<h2>마이프로필<\/h2>/);
  assert.match(panelSource, /<button className="button" type="button" onClick=\{openProfileEditModal\}>프로필수정<\/button>\s*<RefreshIconButton/);
  assert.match(panelSource, /profile-avatar-preview/);
  assert.match(panelSource, /dashboard\.user\.profileImageDataUrl/);
  assert.match(panelSource, /DefaultProfileIcon/);
  assert.match(panelSource, /profile-avatar-default-icon/);
  assert.match(panelSource, /readFileAsDataUrl/);
  assert.match(panelSource, /\/api\/profile\/avatar/);
  assert.match(panelSource, /프로필 이미지 저장/);
  assert.match(panelSource, /profile-image-save-button/);
  assert.match(panelSource, /profile-image-file-row/);
  assert.match(panelSource, /profile-image-file-help/);
  assert.match(panelSource, /<\/div>\s*<p className="profile-image-file-help">/);
  assert.match(styleSource, /\.profile-avatar-preview/);
  assert.match(styleSource, /\.profile-card-header/);
  assert.match(styleSource, /\.profile-card-header \.toolbar-actions/);
  assert.match(styleSource, /\.profile-avatar-default-icon/);
  assert.match(styleSource, /\.profile-image-save-button/);
  assert.match(styleSource, /justify-content: center/);
  assert.match(styleSource, /\.profile-image-file-row/);
  assert.match(styleSource, /align-items: center/);
  assert.match(styleSource, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styleSource, /\.profile-image-file-row input\[type="file"\]/);
  assert.match(styleSource, /line-height: 44px/);
  assert.match(styleSource, /::file-selector-button/);
  assert.match(styleSource, /height: 30px/);
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

test('profile payment flow localizes payment methods and exposes stage highlight tones', async () => {
  const {
    formatProfilePaymentMethodLabel,
    getProfilePaymentFlowTone,
  } = await import('../app/profile/profile-payment-flow.ts');

  assert.equal(formatProfilePaymentMethodLabel('bank_transfer'), '은행이체');
  assert.equal(formatProfilePaymentMethodLabel('usdt'), 'USDT전송');
  assert.equal(formatProfilePaymentMethodLabel('manual'), 'manual');
  assert.equal(getProfilePaymentFlowTone({ paymentStatus: 'pending' }), 'pending');
  assert.equal(getProfilePaymentFlowTone({
    paymentStatus: 'confirmed',
    subscriptionStatus: 'payment_requested',
  }), 'confirmed');
  assert.equal(getProfilePaymentFlowTone({
    paymentStatus: 'confirmed',
    subscriptionStatus: 'active',
  }), 'approved');
  assert.equal(getProfilePaymentFlowTone({ paymentStatus: 'rejected' }), 'rejected');
  assert.equal(getProfilePaymentFlowTone({ paymentStatus: 'refunded' }), 'refunded');
});

test('profile recent payment cards use localized methods and highlighted flow stages', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /formatProfilePaymentMethodLabel\(payment\.method\)/);
  assert.match(panelSource, /getProfilePaymentFlowTone/);
  assert.match(panelSource, /payment-flow-steps \$\{paymentFlowTone\}/);
  assert.match(styleSource, /\.payment-flow-steps\.pending/);
  assert.match(styleSource, /\.payment-flow-steps\.confirmed/);
  assert.match(styleSource, /\.payment-flow-steps\.approved/);
  assert.match(styleSource, /\.payment-flow-steps\.rejected/);
  assert.match(styleSource, /\.payment-flow-steps\.refunded/);
  assert.match(styleSource, /\.payment-flow-steps\s*\{[\s\S]*?background: transparent/);
  assert.match(styleSource, /\.payment-flow-steps\s*\{[\s\S]*?border-top: 1px solid var\(--line\)/);
  assert.match(styleSource, /\.payment-flow-step\.current\s*\{[\s\S]*?background: var\(--payment-flow-current-bg\)/);
  assert.match(styleSource, /\.payment-flow-step\.done\s*\{[\s\S]*?background: var\(--payment-flow-done-bg\)/);
  assert.match(styleSource, /\.payment-flow-step\.blocked\s*\{[\s\S]*?background: var\(--payment-flow-blocked-bg\)/);
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
