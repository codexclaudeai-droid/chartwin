'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { dispatchAuthSessionChangedEvent, subscribeAuthSessionChangedEvent } from '../auth-events';
import { getNotificationCenterHref } from '../notifications/notification-display';
import { RefreshIconButton } from '../shared/refresh-icon-button';
import { formatSignupPhoneNumber } from '../signup/phone-format';
import {
  formatChartAccessLabel,
  formatPaymentAmountUsd,
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
  DEFAULT_PROFILE_AVATARS,
  type PaymentStatus,
  type SubscriptionStatus,
} from '../../src/domain/chart-service/index.ts';
import { createProfileImagePolicyPayload } from './profile-image-policy';
import {
  formatProfilePaymentMethodLabel,
  getProfilePaymentFlowSteps,
  getProfilePaymentFlowTone,
} from './profile-payment-flow';
import { getSubscriptionActionAvailability } from './subscription-action-policy';

type Dashboard = {
  user: {
    email: string;
    name: string;
    phoneNumber: string | null;
    profileImageDataUrl: string | null;
    referralCode: string;
    role: string;
  };
  access: {
    role: string;
    subscriptionStatus: SubscriptionStatus;
    fullChart: boolean;
    paidSignals: boolean;
  };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    startsAt: string | null;
    endsAt: string | null;
    updatedAt: string;
  } | null;
  subscriptions: Array<{
    id: string;
    planId: string | null;
    status: SubscriptionStatus;
    startsAt: string | null;
    endsAt: string | null;
    approvedAt: string | null;
    cancelledAt: string | null;
    refundedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountUsd: number;
    amountKrw: number | null;
    status: PaymentStatus;
    depositorName: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  notifications: {
    totalCount: number;
    unreadCount: number;
  };
  support: {
    visibleThreadCount: number;
    waitingThreadCount: number;
  };
  referrals: {
    rewardPercent: number;
    referredUserCount: number;
    pendingPoints: number;
    confirmedPoints: number;
    reversedPoints: number;
    totalPoints: number;
    referredUsers: Array<{
      user: {
        id: string;
        email: string;
        name: string;
        createdAt: string;
      };
      ledgerCount: number;
      pendingPoints: number;
      confirmedPoints: number;
      reversedPoints: number;
      totalPoints: number;
      latestLedger: {
        id: string;
        status: string;
        percent: number;
        points: number;
        createdAt: string;
      } | null;
      latestPayment: {
        id: string;
        status: PaymentStatus;
        amountUsd: number;
      } | null;
    }>;
  };
};

type ProfileResponse = {
  ok: boolean;
  message?: string;
  dashboard?: Dashboard;
};

export function ProfilePanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedAvatarPath, setSelectedAvatarPath] = useState('');
  const [message, setMessage] = useState('마이프로필 정보를 불러오는 중입니다.');
  const [settingsMessage, setSettingsMessage] = useState('연락번호, 비밀번호, 추천 정보를 관리할 수 있습니다.');
  const [referralCopyMessage, setReferralCopyMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [targetPaymentId, setTargetPaymentId] = useState(() => getTargetPaymentIdFromHash());
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const profileNameInputRef = useRef<HTMLInputElement | null>(null);
  const profileImageFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeAuthSessionChangedEvent(() => {
      void refresh();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const updateTargetPaymentId = () => setTargetPaymentId(getTargetPaymentIdFromHash());

    updateTargetPaymentId();
    window.addEventListener('hashchange', updateTargetPaymentId);

    return () => window.removeEventListener('hashchange', updateTargetPaymentId);
  }, []);

  useEffect(() => {
    if (!targetPaymentId) return;

    const target = document.getElementById(`payment-${targetPaymentId}`);
    target?.scrollIntoView({ block: 'center' });
  }, [dashboard, targetPaymentId]);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/profile', { cache: 'no-store' });
    const payload = await response.json() as ProfileResponse;
    setIsBusy(false);

    if (!response.ok || !payload.dashboard) {
      setDashboard(null);
      setMessage(payload.message || '로그인 후 마이프로필을 확인할 수 있습니다.');
      return;
    }

    setDashboard(payload.dashboard);
    setNameDraft(payload.dashboard.user.name);
    setPhoneDraft(payload.dashboard.user.phoneNumber ?? '');
    setSelectedAvatarPath(resolveDefaultProfileAvatarPath(payload.dashboard.user.profileImageDataUrl));
    setMessage('최신 계정 상태를 불러왔습니다.');
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword && newPassword !== newPasswordConfirm) {
      setSettingsMessage('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nameDraft,
        phoneNumber: phoneDraft,
        currentPassword,
        newPassword,
      }),
    });
    const payload = await response.json() as ProfileResponse;
    setIsBusy(false);

    if (!response.ok || !payload.dashboard) {
      setSettingsMessage(payload.message || '프로필 수정에 실패했습니다.');
      return;
    }

    setDashboard(payload.dashboard);
    setNameDraft(payload.dashboard.user.name);
    setPhoneDraft(payload.dashboard.user.phoneNumber ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setIsProfileEditOpen(false);
    setSettingsMessage('마이프로필 정보를 저장했습니다.');
  }

  function openProfileEditModal() {
    if (dashboard) {
      setNameDraft(dashboard.user.name);
      setPhoneDraft(dashboard.user.phoneNumber ?? '');
    }
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setIsProfileEditOpen(true);
    setSettingsMessage('프로필 팝업에서 이름, 연락번호, 비밀번호를 수정할 수 있습니다.');
    window.requestAnimationFrame(() => {
      profileNameInputRef.current?.focus();
    });
  }

  function closeProfileEditModal() {
    if (dashboard) {
      setNameDraft(dashboard.user.name);
      setPhoneDraft(dashboard.user.phoneNumber ?? '');
    }
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setIsProfileEditOpen(false);
  }

  function handleProfileEditModalBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.currentTarget === event.target) {
      closeProfileEditModal();
    }
  }

  function handleProfileEditModalKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      closeProfileEditModal();
    }
  }

  async function copyReferralValue(label: string, value: string, successMessage?: string) {
    if (await copyTextToClipboard(value)) {
      const nextMessage = successMessage ?? `${label}를 복사했습니다.`;
      setReferralCopyMessage(nextMessage);
      setSettingsMessage(nextMessage);
      window.alert(getReferralCopyAlertMessage(label));
      return;
    }

    const nextMessage = `${label} 복사에 실패했습니다. 직접 선택해서 복사해주세요.`;
    setReferralCopyMessage(nextMessage);
    setSettingsMessage(nextMessage);
  }

  async function shareReferralLink() {
    const sharePayload = {
      title: '추천링크',
      text: '추천링크를 공유합니다.',
      url: referralLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(sharePayload);
        setReferralCopyMessage(getReferralLinkGuideMessage());
        setSettingsMessage(getReferralLinkGuideMessage());
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    await copyReferralValue('추천링크', referralLink, getReferralLinkGuideMessage());
  }

  function handleProfilePhoneNumberChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPhoneDraft(formatSignupPhoneNumber(event.currentTarget.value));
  }

  async function uploadProfileImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedImageFile && !selectedAvatarPath) {
      setSettingsMessage('프로필 이미지 파일을 먼저 선택해주세요.');
      return;
    }

    setIsBusy(true);
    const requestBody = selectedImageFile
      ? {
          ...createProfileImagePolicyPayload(selectedImageFile),
          dataUrl: await readFileAsDataUrl(selectedImageFile),
        }
      : { avatarPath: selectedAvatarPath };
    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json() as ProfileResponse;
    setIsBusy(false);

    if (!response.ok || !payload.dashboard) {
      setSettingsMessage(payload.message || '프로필 이미지 저장에 실패했습니다.');
      return;
    }

    setDashboard(payload.dashboard);
    setSelectedImageFile(null);
    setSelectedAvatarPath(resolveDefaultProfileAvatarPath(payload.dashboard.user.profileImageDataUrl));
    if (profileImageFileInputRef.current) profileImageFileInputRef.current.value = '';
    setSettingsMessage('프로필 이미지가 저장되었습니다.');
    dispatchAuthSessionChangedEvent();
  }

  async function requestSubscriptionAction(action: 'cancel' | 'refund') {
    setIsBusy(true);
    const endpoint = action === 'cancel'
      ? '/api/subscription/cancel-request'
      : '/api/subscription/refund-request';
    const response = await fetch(endpoint, { method: 'POST' });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok || !payload.subscription) {
      setMessage(payload.message || '구독 요청 처리에 실패했습니다.');
      return;
    }
    setDashboard((currentDashboard) => currentDashboard
      ? { ...currentDashboard, subscription: payload.subscription }
      : currentDashboard);
    setMessage(action === 'cancel'
      ? '구독 취소 요청이 관리자 확인 대기 상태로 접수되었습니다.'
      : '환불 요청이 관리자 확인 대기 상태로 접수되었습니다.');
  }

  async function withdrawAccount() {
    if (!canWithdrawAccount(dashboard?.user.role)) {
      setSettingsMessage('회원탈퇴를 사용할 수 없는 계정입니다.');
      return;
    }
    if (!window.confirm('회원탈퇴 후 현재 계정으로 로그인할 수 없습니다. 계속 진행할까요?')) {
      return;
    }

    setIsBusy(true);
    const response = await fetch('/api/profile', { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    setIsBusy(false);

    if (!response.ok) {
      setSettingsMessage(payload.message || '회원탈퇴 처리에 실패했습니다.');
      return;
    }

    setDashboard(null);
    setMessage('회원탈퇴가 완료되었습니다. 홈으로 이동합니다.');
    setSettingsMessage('회원탈퇴가 완료되었습니다.');
    dispatchAuthSessionChangedEvent();
    window.setTimeout(() => {
      window.location.assign('/');
    }, 600);
  }

  if (!dashboard) {
    return (
      <section className="card wide">
        <div className="toolbar">
          <h2>계정 확인 필요</h2>
          <RefreshIconButton onClick={refresh} disabled={isBusy} />
        </div>
        <p className="notice">{message}</p>
        <div className="actions">
          <Link className="button" href="/login">로그인</Link>
          <Link className="button secondary" href="/signup">회원가입</Link>
        </div>
      </section>
    );
  }

  const subscriptionStatus = dashboard.subscription?.status ?? dashboard.access.subscriptionStatus;
  const subscriptionActionAvailability = getSubscriptionActionAvailability(subscriptionStatus);
  const latestPayment = dashboard.payments[0] ?? null;
  const notificationCenterHref = getNotificationCenterHref(dashboard.notifications.unreadCount);
  const referralLink = getReferralLink(dashboard.user.referralCode);
  const canWithdraw = canWithdrawAccount(dashboard.user.role);

  return (
    <section className="profile-layout">
      <div className="card">
        <div className="profile-card-header">
          <div className="profile-avatar-preview">
            {dashboard.user.profileImageDataUrl ? (
              <img alt={`${dashboard.user.name} 프로필 이미지`} src={dashboard.user.profileImageDataUrl} />
            ) : (
              <DefaultProfileIcon />
            )}
          </div>
          <div className="toolbar-actions">
            <button className="button" type="button" onClick={openProfileEditModal}>프로필수정</button>
            <RefreshIconButton onClick={refresh} disabled={isBusy} />
          </div>
        </div>
        <div className="status-list">
          <div className="status-row">
            <span>이름</span>
            <strong>{dashboard.user.name}</strong>
          </div>
          <div className="status-row">
            <span>이메일</span>
            <strong>{dashboard.user.email}</strong>
          </div>
          <div className="status-row">
            <span>연락번호</span>
            <strong>{dashboard.user.phoneNumber || '미등록'}</strong>
          </div>
          <div className="status-row">
            <span>회원레벨</span>
            <strong>{dashboard.user.role}</strong>
          </div>
        </div>
        {isProfileEditOpen && (
          <div
            className="profile-edit-modal-backdrop"
            onClick={handleProfileEditModalBackdropClick}
            role="presentation"
          >
            <form
              aria-labelledby="profileEditTitle"
              aria-modal="true"
              className="profile-edit-modal"
              onKeyDown={handleProfileEditModalKeyDown}
              onSubmit={submitProfile}
              role="dialog"
            >
              <div className="toolbar compact">
                <div>
                  <span>마이프로필</span>
                  <h3 id="profileEditTitle">프로필 수정</h3>
                </div>
                <button
                  aria-label="닫기"
                  className="mobile-nav-panel-close profile-edit-close"
                  type="button"
                  onClick={closeProfileEditModal}
                >
                  <span />
                  <span />
                  <span />
                </button>
              </div>
              <label htmlFor="profileName">이름</label>
              <input
                id="profileName"
                ref={profileNameInputRef}
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="이름"
              />
              <label htmlFor="profilePhoneNumber">연락번호</label>
              <input
                id="profilePhoneNumber"
                value={phoneDraft}
                onChange={handleProfilePhoneNumberChange}
                placeholder="010-0000-0000"
                inputMode="numeric"
                maxLength={13}
              />
              <label htmlFor="profileCurrentPassword">현재 비밀번호</label>
              <input
                autoComplete="current-password"
                id="profileCurrentPassword"
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="비밀번호 변경 시 입력"
                type="password"
                value={currentPassword}
              />
              <label htmlFor="profileNewPassword">새 비밀번호</label>
              <input
                autoComplete="new-password"
                id="profileNewPassword"
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="새 비밀번호"
                type="password"
                value={newPassword}
              />
              <p className="profile-password-rule">8자리 이상, 대문자, 숫자, 특수문자를 포함해 주세요.</p>
              <label htmlFor="profileNewPasswordConfirm">새 비밀번호 확인</label>
              <input
                autoComplete="new-password"
                id="profileNewPasswordConfirm"
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                placeholder="새 비밀번호 확인"
                type="password"
                value={newPasswordConfirm}
              />
              <div className="actions compact">
                <button className="button" type="submit" disabled={isBusy}>프로필 저장</button>
                <button className="button secondary" type="button" onClick={closeProfileEditModal}>취소</button>
              </div>
            </form>
          </div>
        )}
        <div className="referral-card">
          <span>추천 정보</span>
          <div className="referral-copy-row">
            <strong>{dashboard.user.referralCode}</strong>
            <button
              aria-label="추천코드 복사"
              className="referral-icon-button"
              onClick={() => void copyReferralValue('추천코드', dashboard.user.referralCode, getReferralCodeGuideMessage())}
              title="추천코드 복사"
              type="button"
            >
              <CopyIcon />
              <span className="screen-reader-only">추천코드 복사</span>
            </button>
          </div>
          <div className="referral-copy-row referral-link-row">
            <p>{referralLink}</p>
            <div className="referral-icon-actions">
              <button
                aria-label="추천링크 복사"
                className="referral-icon-button"
                onClick={() => void copyReferralValue('추천링크', referralLink, getReferralLinkGuideMessage())}
                title="추천링크 복사"
                type="button"
              >
                <CopyIcon />
                <span className="screen-reader-only">추천링크 복사</span>
              </button>
              <button
                aria-label="추천링크 공유"
                className="referral-icon-button"
                onClick={() => void shareReferralLink()}
                title="추천링크 공유"
                type="button"
              >
                <ShareIcon />
                <span className="screen-reader-only">추천링크 공유</span>
              </button>
            </div>
          </div>
          {referralCopyMessage && (
            <p className="referral-copy-message" role="status">{referralCopyMessage}</p>
          )}
        </div>
        <div className="referral-card referral-list-card">
          <span>나의 추천리스트</span>
          <strong>{formatReferralPoints(dashboard.referrals.totalPoints)}</strong>
          <p>
            추천회원 {dashboard.referrals.referredUserCount}명 · 기본 적립률 {dashboard.referrals.rewardPercent}%
          </p>
          <div className="summary-grid compact-summary-grid">
            <article className="mini-card">
              <span>적립 예정</span>
              <strong>{formatReferralPoints(dashboard.referrals.pendingPoints)}</strong>
            </article>
            <article className="mini-card">
              <span>확정 포인트</span>
              <strong>{formatReferralPoints(dashboard.referrals.confirmedPoints)}</strong>
            </article>
          </div>
          {dashboard.referrals.referredUsers.length > 0 ? (
            <ul className="admin-history-list referral-member-list">
              {dashboard.referrals.referredUsers.map((item) => (
                <li key={item.user.id}>
                  <div className="admin-history-row">
                    <strong>{item.user.name}</strong>
                    <span>{formatReferralPoints(item.totalPoints)}</span>
                  </div>
                  <p>{item.user.email}</p>
                  <small>
                    추천개별포인트 예정 {formatReferralPoints(item.pendingPoints)}
                    {' / '}
                    확정 {formatReferralPoints(item.confirmedPoints)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <small>아직 추천 가입 회원이 없습니다. 추천링크를 공유하면 이곳에 집계됩니다.</small>
          )}
        </div>
        <form className="form profile-settings-form" onSubmit={uploadProfileImage}>
          <span className="form-section-label">기본 아바타 선택</span>
          <div className="profile-avatar-option-groups">
            <ProfileAvatarOptionGroup
              gender="male"
              label="남성"
              selectedAvatarPath={selectedAvatarPath}
              onSelect={(avatarPath) => {
                setSelectedAvatarPath(avatarPath);
                setSelectedImageFile(null);
                if (profileImageFileInputRef.current) profileImageFileInputRef.current.value = '';
              }}
            />
            <ProfileAvatarOptionGroup
              gender="female"
              label="여성"
              selectedAvatarPath={selectedAvatarPath}
              onSelect={(avatarPath) => {
                setSelectedAvatarPath(avatarPath);
                setSelectedImageFile(null);
                if (profileImageFileInputRef.current) profileImageFileInputRef.current.value = '';
              }}
            />
          </div>
          <label htmlFor="profileImageFile">프로필 이미지 파일</label>
          <div className="profile-image-file-row">
            <input
              accept="image/png,image/jpeg,image/webp"
              id="profileImageFile"
              ref={profileImageFileInputRef}
              onChange={(event) => {
                setSelectedImageFile(event.target.files?.[0] ?? null);
                setSelectedAvatarPath('');
              }}
              type="file"
            />
          </div>
          <p className="profile-image-file-help">PNG, JPG, WEBP 파일만 등록할 수 있습니다.</p>
          {selectedImageFile && (
            <p className="notice profile-image-file-selection">
              선택 파일: {selectedImageFile.name} / {selectedImageFile.type || 'unknown'} / {selectedImageFile.size} bytes
            </p>
          )}
          <button className="button secondary profile-image-save-button" type="submit" disabled={isBusy}>프로필 이미지 저장</button>
        </form>
        {canWithdraw && (
          <div className="profile-danger-zone">
            <div>
              <strong>회원탈퇴</strong>
              <p>탈퇴시 세션이 종료되고 로그인이 차단됩니다.</p>
            </div>
            <button
              className="button danger"
              disabled={isBusy}
              onClick={() => void withdrawAccount()}
              type="button"
            >
              회원탈퇴
            </button>
          </div>
        )}
      </div>

      <div className="profile-service-column">
        <div className="card wide">
          <h2>서비스 상태</h2>
          <div className="summary-grid">
            <article className="mini-card">
              <span>구독</span>
              <strong>{formatSubscriptionStatusLabel(subscriptionStatus)}</strong>
              {dashboard.subscription?.startsAt && (
                <p>시작일 {formatDateTime(dashboard.subscription.startsAt)}</p>
              )}
              <p>{dashboard.subscription?.endsAt ? `만료일 ${formatDateTime(dashboard.subscription.endsAt)}` : '승인 전 구독은 관리자 확인 후 활성화됩니다.'}</p>
            </article>
            <article className="mini-card">
              <span>차트 접근</span>
              <strong>{formatChartAccessLabel(dashboard.access)}</strong>
              <p>차트: {dashboard.access.fullChart ? '허용' : '제한'} / 시그널: {dashboard.access.paidSignals ? '허용' : '제한'}</p>
            </article>
            <article className="mini-card">
              <span>알림</span>
              <strong>읽지 않음 {dashboard.notifications.unreadCount}건</strong>
              <p>총 {dashboard.notifications.totalCount}건의 처리 알림이 있습니다.</p>
            </article>
            <article className="mini-card">
              <span>고객센터</span>
              <strong>대기 {dashboard.support.waitingThreadCount}건</strong>
              <p>확인 가능한 문의 {dashboard.support.visibleThreadCount}건</p>
            </article>
          </div>
          <div className="actions">
            <Link className="button" href="/pricing">구독 관리</Link>
            <Link className="button secondary" href={notificationCenterHref}>알림 보기</Link>
            <Link className="button secondary" href="/support">고객센터</Link>
          </div>
          <div className="actions compact subscription-actions-inline">
            <button
              className="button secondary"
              disabled={isBusy || !subscriptionActionAvailability.canCancel}
              onClick={() => void requestSubscriptionAction('cancel')}
              type="button"
            >
              취소 요청
            </button>
            <button
              className="button danger"
              disabled={isBusy || !subscriptionActionAvailability.canRefund}
              onClick={() => void requestSubscriptionAction('refund')}
              type="button"
            >
              환불 요청
            </button>
          </div>
          <p className="notice compact">{subscriptionActionAvailability.reason}</p>
        </div>

        <div className="card wide profile-subscription-history-card">
          <h2>구독내역</h2>
          {dashboard.subscriptions.length > 0 ? (
            <div className="subscription-history-list">
              {dashboard.subscriptions.slice(0, 5).map((subscription, subscriptionIndex) => (
                <article className="subscription-history-item" key={subscription.id}>
                  <div className="subscription-history-summary">
                    <div>
                      <strong>구독 {subscriptionIndex + 1}</strong>
                      <p>{subscription.planId ?? '무료체험/수동 구독'}</p>
                    </div>
                    <div>
                      <span className="badge">{formatSubscriptionStatusLabel(subscription.status)}</span>
                      <p>{formatDateTime(subscription.updatedAt)}</p>
                    </div>
                  </div>
                  <dl className="subscription-history-meta">
                    <div>
                      <dt>시작일</dt>
                      <dd>{subscription.startsAt ? formatDateTime(subscription.startsAt) : '승인 전'}</dd>
                    </div>
                    <div>
                      <dt>종료일</dt>
                      <dd>{subscription.endsAt ? formatDateTime(subscription.endsAt) : '미정'}</dd>
                    </div>
                    <div>
                      <dt>승인일</dt>
                      <dd>{subscription.approvedAt ? formatDateTime(subscription.approvedAt) : '대기'}</dd>
                    </div>
                    <div>
                      <dt>처리일</dt>
                      <dd>{formatSubscriptionResolutionDate(subscription)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className="notice">확인 가능한 구독내역이 없습니다. 구독 신청 후 처리 상태가 이곳에 표시됩니다.</p>
          )}
        </div>

        <div className="card wide profile-payment-summary-card">
          <h2>최근 결제 요청</h2>
          {latestPayment ? (
            <div className="payment-list">
              {dashboard.payments.slice(0, 3).map((payment, paymentIndex) => {
                const paymentFlowTone = getProfilePaymentFlowTone({
                  paymentStatus: payment.status,
                  subscriptionStatus,
                });

                return (
                  <article
                    className={`payment-card${targetPaymentId === payment.id ? ' payment-card-target' : ''}`}
                    id={`payment-${payment.id}`}
                    key={payment.id}
                  >
                    <div className="payment-card-summary">
                      <div>
                        <strong>결제 요청 {paymentIndex + 1}</strong>
                        <p>{formatPaymentAmountUsd(payment.amountUsd)} / {formatProfilePaymentMethodLabel(payment.method)}</p>
                      </div>
                      <div>
                        <span className="badge">{formatPaymentStatusLabel(payment.status)}</span>
                        <p>{formatDateTime(payment.updatedAt)}</p>
                      </div>
                    </div>
                    <ol className={`payment-flow-steps ${paymentFlowTone}`} aria-label={`결제 요청 ${paymentIndex + 1} 진행 단계`}>
                      {getProfilePaymentFlowSteps({
                        paymentStatus: payment.status,
                        subscriptionStatus,
                      }).map((step) => (
                        <li className={`payment-flow-step ${step.state}`} key={step.key}>
                          <span>{step.label}</span>
                          <small>{step.description}</small>
                        </li>
                      ))}
                    </ol>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="notice">아직 결제 요청이 없습니다. 구독 페이지에서 입금 확인 요청을 접수할 수 있습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function getTargetPaymentIdFromHash(): string | null {
  if (typeof window === 'undefined') return null;

  const prefix = '#payment-';
  const hash = window.location.hash;
  if (!hash.startsWith(prefix)) return null;

  return decodeURIComponent(hash.slice(prefix.length));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatSubscriptionResolutionDate(subscription: Dashboard['subscriptions'][number]): string {
  const value = subscription.cancelledAt ?? subscription.refundedAt ?? subscription.updatedAt;
  return value ? formatDateTime(value) : '진행 중';
}

function getReferralLink(referralCode: string): string {
  const path = `/signup?ref=${encodeURIComponent(referralCode)}`;
  if (typeof window === 'undefined') return path;

  return `${window.location.origin}${path}`;
}

function getReferralCodeGuideMessage(): string {
  return '회원 초대 시 이 코드를 입력하면 추천인 정보가 입력됩니다.';
}

function getReferralLinkGuideMessage(): string {
  return '회원 초대 시 이 링크를 전달하면 추천인 정보가 자동입력됩니다.';
}

function getReferralCopyAlertMessage(label: string): string {
  return label === '추천코드' ? '추천코드가 카피되었습니다' : '추천링크가 카피되었습니다';
}

function resolveDefaultProfileAvatarPath(value: string | null): string {
  return DEFAULT_PROFILE_AVATARS.some((avatar) => avatar.path === value) ? String(value) : '';
}

function ProfileAvatarOptionGroup({
  gender,
  label,
  selectedAvatarPath,
  onSelect,
}: {
  gender: 'male' | 'female';
  label: string;
  selectedAvatarPath: string;
  onSelect: (avatarPath: string) => void;
}) {
  const avatars = DEFAULT_PROFILE_AVATARS.filter((avatar) => avatar.gender === gender);

  return (
    <fieldset className="profile-avatar-option-group">
      <legend>{label}</legend>
      <div className="profile-avatar-option-list">
        {avatars.map((avatar) => {
          const isSelected = selectedAvatarPath === avatar.path;
          return (
            <button
              aria-pressed={isSelected}
              className={`profile-avatar-option${isSelected ? ' selected' : ''}`}
              key={avatar.id}
              onClick={() => onSelect(avatar.path)}
              type="button"
            >
              <img alt="" src={avatar.path} />
              <span>{avatar.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('file read failed')));
    reader.readAsDataURL(file);
  });
}

function DefaultProfileIcon() {
  return (
    <svg aria-hidden="true" className="profile-avatar-default-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.8 20c1.15-4.35 3.55-6.5 7.2-6.5s6.05 2.15 7.2 6.5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="5.5" y="8.5" width="10" height="10" rx="2" />
      <rect x="9" y="5" width="10" height="10" rx="2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="7" cy="12" r="2.6" />
      <circle cx="17" cy="7" r="2.6" />
      <circle cx="17" cy="17" r="2.6" />
      <path d="M9.35 10.85 14.65 8.2" />
      <path d="M9.35 13.15 14.65 15.8" />
    </svg>
  );
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to textarea-based copy for browsers that block Clipboard API.
  }

  return copyTextWithHiddenTextarea(value);
}

function copyTextWithHiddenTextarea(value: string): boolean {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function canWithdrawAccount(role: string | undefined): boolean {
  return role !== 'admin' && role !== 'super_admin';
}

function formatReferralPoints(value: number): string {
  return `${value.toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  })}P`;
}
