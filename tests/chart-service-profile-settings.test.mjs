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
import { DEFAULT_PROFILE_AVATARS } from '../src/domain/chart-service/index.ts';
import {
  createProfileImagePolicyPayload,
  getProfileImageWebpFilename,
  PROFILE_IMAGE_CANVAS_MAX_SIZE,
  PROFILE_IMAGE_UPLOAD_MAX_BYTES,
  PROFILE_IMAGE_WEBP_MIME_TYPE,
  PROFILE_IMAGE_WEBP_QUALITIES,
} from '../app/profile/profile-image-policy.ts';
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

test('profile image upload policy converts browser files to bounded webp assets', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.equal(PROFILE_IMAGE_UPLOAD_MAX_BYTES, 300_000);
  assert.equal(PROFILE_IMAGE_CANVAS_MAX_SIZE, 512);
  assert.equal(PROFILE_IMAGE_WEBP_MIME_TYPE, 'image/webp');
  assert.deepEqual([...PROFILE_IMAGE_WEBP_QUALITIES], [0.88, 0.82, 0.76, 0.7, 0.64]);
  assert.equal(getProfileImageWebpFilename('avatar.png'), 'avatar.webp');
  assert.equal(getProfileImageWebpFilename('family.photo.jpeg'), 'family.photo.webp');
  assert.equal(getProfileImageWebpFilename(''), 'profile-image.webp');
  assert.match(panelSource, /createCompressedProfileImageUpload/);
  assert.match(panelSource, /PROFILE_IMAGE_CANVAS_MAX_SIZE/);
  assert.match(panelSource, /PROFILE_IMAGE_WEBP_QUALITIES/);
  assert.match(panelSource, /PROFILE_IMAGE_UPLOAD_MAX_BYTES/);
  assert.match(panelSource, /canvas\.toBlob/);
  assert.match(panelSource, /createProfileImagePolicyPayload\(compressedImage\.file\)/);
  assert.match(panelSource, /dataUrl: compressedImage\.dataUrl/);
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

test('profile avatar route stores a selected default avatar path', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { POST } = await import('../app/api/profile/avatar/route.ts');
  const avatarPath = DEFAULT_PROFILE_AVATARS.find((avatar) => avatar.id === 'female-1')?.path;

  const response = await POST(new Request('http://localhost/api/profile/avatar', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ avatarPath }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.dashboard.user.profileImageDataUrl, avatarPath);
  assert.equal(repository.getUserById('user_member')?.profileImageDataUrl, avatarPath);
});

test('profile avatar route rejects paths outside the default avatar set', async () => {
  const repository = getChartServiceRepository();
  const { session } = createSessionForUser(repository, {
    userId: 'user_member',
    createdAt: new Date().toISOString(),
    ttlSeconds: 60 * 60,
  });
  const { POST } = await import('../app/api/profile/avatar/route.ts');

  const response = await POST(new Request('http://localhost/api/profile/avatar', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ avatarPath: '/avatars/unknown.png' }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.message, /Default profile avatar path invalid/);
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

test('profile page shows subscription history beside recent payments', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /subscriptions: Array/);
  assert.match(panelSource, /profile-subscription-history-card/);
  assert.match(panelSource, /구독내역/);
  assert.match(panelSource, /dashboard\.subscriptions\.slice\(0, 5\)\.map/);
  assert.match(panelSource, /subscription-history-list/);
  assert.match(panelSource, /subscription-history-meta/);
  assert.match(panelSource, /formatSubscriptionResolutionDate/);
  assert.match(styleSource, /\.subscription-history-item/);
  assert.match(styleSource, /\.subscription-history-meta/);
  assert.match(styleSource, /body:not\(:has\(\.landing-page\)\) \.profile-page \.subscription-history-item/);
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
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /import \{ Eye, EyeOff \} from 'lucide-react'/);
  assert.match(panelSource, /formatSignupPhoneNumber/);
  assert.match(panelSource, /handleProfilePhoneNumberChange/);
  assert.match(panelSource, /inputMode="numeric"/);
  assert.match(panelSource, /maxLength=\{13\}/);
  assert.match(panelSource, /isCurrentPasswordVisible/);
  assert.match(panelSource, /isNewPasswordVisible/);
  assert.match(panelSource, /isNewPasswordConfirmVisible/);
  assert.match(panelSource, /type=\{isCurrentPasswordVisible \? 'text' : 'password'\}/);
  assert.match(panelSource, /type=\{isNewPasswordVisible \? 'text' : 'password'\}/);
  assert.match(panelSource, /type=\{isNewPasswordConfirmVisible \? 'text' : 'password'\}/);
  assert.match(panelSource, /aria-label=\{isCurrentPasswordVisible \? '현재 비밀번호 숨기기' : '현재 비밀번호 보기'\}/);
  assert.match(panelSource, /aria-label=\{isNewPasswordVisible \? '새 비밀번호 숨기기' : '새 비밀번호 보기'\}/);
  assert.match(panelSource, /aria-label=\{isNewPasswordConfirmVisible \? '새 비밀번호 확인 숨기기' : '새 비밀번호 확인 보기'\}/);
  assert.match(panelSource, /className="password-input-shell"/);
  assert.match(panelSource, /className="password-visibility-toggle"/);
  assert.match(styleSource, /\.password-input-shell/);
  assert.match(styleSource, /\.password-visibility-toggle/);
  assert.match(panelSource, /8자리 이상, 대문자, 숫자, 특수문자/);
});

test('profile panel exposes a member withdrawal danger action', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /withdrawAccount/);
  assert.match(panelSource, /method: 'DELETE'/);
  assert.match(panelSource, /회원탈퇴/);
  assert.match(panelSource, /탈퇴시 세션이 종료되고 로그인이 차단됩니다\./);
  assert.doesNotMatch(panelSource, /탈퇴하면 현재 세션이 종료되고 계정 로그인이 차단됩니다\./);
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
  assert.match(panelSource, /DEFAULT_PROFILE_AVATARS/);
  assert.match(panelSource, /ProfileAvatarPicker/);
  assert.match(panelSource, /selectedAvatarPath/);
  assert.match(panelSource, /profileImageMode/);
  assert.match(panelSource, /profileImageUploadProgress/);
  assert.match(panelSource, /isProfileImageUploading/);
  assert.match(panelSource, /profileImageConvertedFileSizeBytes/);
  assert.match(panelSource, /formatProfileImageFileSize\(profileImageConvertedFileSizeBytes\)/);
  assert.match(panelSource, /setProfileImageConvertedFileSizeBytes\(compressedImage\.file\.size\)/);
  assert.match(panelSource, /PROFILE_IMAGE_UPLOAD_PROGRESS_MIN_DURATION_MS = 1400/);
  assert.match(panelSource, /profileImageUploadStartedAtRef/);
  assert.match(panelSource, /startProfileImageUploadProgress/);
  assert.match(panelSource, /finishProfileImageUploadProgress/);
  assert.match(panelSource, /Date\.now\(\) - profileImageUploadStartedAtRef\.current/);
  assert.match(panelSource, /Math\.max\(0, PROFILE_IMAGE_UPLOAD_PROGRESS_MIN_DURATION_MS - elapsedMs\)/);
  assert.match(panelSource, /if \(!shouldShowUploadProgress\) \{[\s\S]*?setSelectedImageFile\(null\);[\s\S]*?profileImageFileInputRef\.current\.value = ''/);
  assert.match(panelSource, /shouldShowUploadProgress\s*\?\s*'프로필 이미지가 WebP로 변환되어 업로드되었습니다\.'\s*:\s*'프로필 이미지가 적용되었습니다\.'/);
  assert.match(panelSource, /profile-image-section/);
  assert.match(panelSource, /profile-image-mode-tabs/);
  assert.match(panelSource, /role="tablist"/);
  assert.match(panelSource, /aria-selected=\{profileImageMode === 'avatar'\}/);
  assert.match(panelSource, /aria-selected=\{profileImageMode === 'upload'\}/);
  assert.match(panelSource, /profileImageMode === 'avatar'/);
  assert.match(panelSource, /profileImageMode === 'upload'/);
  assert.match(panelSource, /avatarPath: selectedAvatarPath/);
  assert.doesNotMatch(panelSource, /name="profileAvatarPath"/);
  assert.doesNotMatch(panelSource, /type="radio"/);
  assert.match(panelSource, /aria-pressed=\{isSelected\}/);
  assert.match(panelSource, /기본 아바타 선택/);
  assert.doesNotMatch(panelSource, /gender="male"|gender="female"/);
  assert.match(panelSource, /프로필 이미지 적용/);
  assert.match(panelSource, /profile-image-save-button/);
  assert.match(panelSource, /profile-image-file-row/);
  assert.match(panelSource, /profile-image-file-help/);
  assert.match(panelSource, /role="progressbar"/);
  assert.match(panelSource, /aria-valuenow=\{Math\.round\(profileImageUploadProgress\)\}/);
  assert.match(panelSource, /profile-image-upload-progress-fill/);
  assert.match(panelSource, /profile-image-converted-size/);
  assert.match(panelSource, /<\/div>\s*<p className="profile-image-file-help">/);
  assert.match(styleSource, /\.profile-avatar-preview/);
  assert.match(styleSource, /\.profile-image-section/);
  assert.match(styleSource, /\.profile-image-mode-tabs/);
  assert.match(styleSource, /\.profile-image-mode-tab/);
  assert.match(styleSource, /\.profile-image-mode-panel/);
  assert.match(styleSource, /--profile-image-picker-height: 128px/);
  assert.match(styleSource, /\.profile-image-mode-panel\s*\{[\s\S]*?align-content: center/);
  assert.match(styleSource, /\.profile-image-mode-panel\s*\{[\s\S]*?min-height: var\(--profile-image-picker-height\)/);
  assert.match(styleSource, /\.profile-avatar-option-list/);
  assert.match(styleSource, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styleSource, /\.profile-avatar-option input\[type="radio"\]/);
  assert.match(styleSource, /\.profile-avatar-option\s*\{[\s\S]*?appearance: none/);
  assert.match(styleSource, /\.profile-avatar-option\s*\{[\s\S]*?color: var\(--muted\)/);
  assert.match(styleSource, /\.profile-avatar-option\.selected img/);
  assert.match(styleSource, /0 0 24px/);
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
  assert.match(styleSource, /\.profile-image-upload-progress/);
  assert.match(styleSource, /\.profile-image-upload-progress-fill/);
  assert.match(styleSource, /transition: width 180ms ease/);
  assert.match(styleSource, /\.profile-image-converted-size/);
});

test('profile image size labels format converted upload sizes clearly', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /function formatProfileImageFileSize\(sizeBytes: number\): string/);
  assert.match(panelSource, /if \(sizeBytes < 1024\) return `\$\{Math\.round\(sizeBytes\)\} B`/);
  assert.match(panelSource, /return `\$\{formatCompactDecimal\(sizeBytes \/ 1024\)\} KB`/);
  assert.match(panelSource, /function formatCompactDecimal\(value: number\): string/);
  assert.match(panelSource, /\.toFixed\(1\)\.replace/);
});

test('profile image editing lives inside the profile edit modal with neutral avatar choices', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const modalSource = panelSource.slice(
    panelSource.indexOf('className="profile-edit-modal"'),
    panelSource.indexOf('<div className="referral-card">'),
  );
  const openModalSource = panelSource.slice(
    panelSource.indexOf('function openProfileEditModal'),
    panelSource.indexOf('function closeProfileEditModal'),
  );

  assert.match(modalSource, /profile-edit-image-form/);
  assert.match(modalSource, /uploadProfileImage/);
  assert.match(modalSource, /profileImageFile/);
  assert.match(modalSource, /ProfileAvatarPicker/);
  assert.match(modalSource, /profile-image-mode-tabs/);
  assert.doesNotMatch(modalSource, /gender="male"|gender="female"/);
  assert.doesNotMatch(modalSource, /label="남성"|label="여성"|<legend>/);
  assert.match(panelSource, /function ProfileAvatarPicker/);
  assert.match(panelSource, /DEFAULT_PROFILE_AVATARS\.map/);
  assert.match(openModalSource, /setProfileImageMode\('avatar'\)/);
  assert.doesNotMatch(openModalSource, /currentAvatarPath \? 'avatar' : 'upload'/);
  assert.match(panelSource, /<button[\s\S]*?aria-pressed=\{isSelected\}[\s\S]*?<img alt=\{avatarLabel\} src=\{avatar\.path\} \/>/);
  assert.doesNotMatch(panelSource, /<span>\{avatar\.label\}<\/span>/);
  assert.match(styleSource, /\.profile-edit-image-form/);
  assert.match(styleSource, /:focus:not\(:focus-visible\)/);
  assert.match(styleSource, /-webkit-tap-highlight-color: transparent/);
});

test('profile avatar selection waits for the shared apply button', () => {
  const panelSource = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(panelSource, /async function selectProfileAvatar\(avatarPath: string\)/);
  assert.match(panelSource, /requestBody = \{ avatarPath: selectedAvatarPath \}/);
  assert.match(panelSource, /body: JSON\.stringify\(requestBody\)/);
  assert.match(panelSource, /setSelectedAvatarPath\(avatarPath\)/);
  assert.match(panelSource, /primeAuthSession/);
  assert.match(panelSource, /dispatchAuthSessionChangedEvent/);
});

test('profile avatar image buttons suppress native click highlight boxes', () => {
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(styleSource, /\.profile-avatar-option\s*\{[\s\S]*?appearance: none/);
  assert.match(styleSource, /\.profile-avatar-option:focus/);
  assert.match(styleSource, /\.profile-avatar-option:focus-visible/);
  assert.match(styleSource, /box-shadow: none/);
  assert.match(styleSource, /outline: 0/);
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
