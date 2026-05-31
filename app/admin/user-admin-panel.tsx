'use client';

import { useEffect, useState } from 'react';
import {
  formatChartAccessLabel,
  formatPaymentAmountUsd,
  type PaymentStatus,
  type SubscriptionStatus,
  type UserAccountStatus,
  type UserRole,
} from '../../src/domain/chart-service/index.ts';
import { subscribeAuthSessionChangedEvent } from '../auth-events';
import { AdminDashboardFilterNotice } from './admin-dashboard-filter-notice';
import { formatAdminDisplayId, getAdminDisplaySequence } from './admin-display-id';
import { subscribeAdminQueuePresetEvent } from './admin-queue-preset-events';
import { AdminRefreshButton } from './admin-refresh-button';
import { dispatchAdminRefreshEvent, subscribeAdminRefreshEvent } from './admin-refresh-events';
import {
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
  formatSupportStatusLabel,
  formatUserAccountStatusLabel,
  formatUserRoleLabel,
} from './admin-status-labels';
import { useAdminActionConfirmation } from './admin-action-confirmation-dialog';
import {
  canChangeAdminUserAccountStatus,
  canChangeAdminUserRole,
  getAdminUserAccountStatusPermissionNotice,
  getAdminUserPermissionNotice,
  getAssignableUserRoles,
} from './admin-user-permissions';
import { formatAuditLogSummary } from './audit-log-summary';
import { getAdminAuditTargetLink } from './audit-target-links';
import { formatAdminPlanTierLabel } from './admin-plan-labels';
import { createAdminPaymentUrl } from './payment-links';
import {
  createAdminSubscriptionUrl,
  isAdminSubscriptionQueueStatus,
} from './subscription-links';
import { createAdminSupportThreadUrl } from './support-thread-links';
import {
  getNotificationCategoryLabel,
  getNotificationLinkLabel,
} from '../notifications/notification-display';

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'member', label: formatUserRoleLabel('member') },
  { value: 'trial', label: formatUserRoleLabel('trial') },
  { value: 'subscriber', label: formatUserRoleLabel('subscriber') },
  { value: 'salesperson', label: formatUserRoleLabel('salesperson') },
  { value: 'admin', label: formatUserRoleLabel('admin') },
  { value: 'super_admin', label: formatUserRoleLabel('super_admin') },
];

type AdminUserDirectoryItem = {
  user: {
    id: string;
    email: string;
    name: string;
    phoneNumber: string | null;
    referralCode: string;
    referredByUserId: string | null;
    createdAt: string;
    role: string;
    accountStatus: UserAccountStatus;
  };
  referrer: {
    id: string;
    email: string;
    name: string;
  } | null;
  subscription: {
    id: string;
    planId: string | null;
    status: SubscriptionStatus;
    endsAt: string | null;
  } | null;
  access: {
    fullChart: boolean;
    paidSignals: boolean;
  };
  latestPayment: {
    id: string;
    status: PaymentStatus;
    amountUsd: number;
    updatedAt: string;
  } | null;
  paymentCount: number;
  supportThreadCount: number;
  unreadNotificationCount: number;
};

type AdminUsersResponse = {
  ok: boolean;
  message?: string;
  users?: AdminUserDirectoryItem[];
};

type ReferralSummary = {
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
      updatedAt: string;
    } | null;
  }>;
};

type AdminUserDetail = AdminUserDirectoryItem & {
  payments: Array<{
    id: string;
    status: PaymentStatus;
    amountUsd: number;
    updatedAt: string;
  }>;
  supportThreads: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string;
  }>;
  notifications: Array<{
    category: string;
    id: string;
    linkUrl: string | null;
    title: string;
    readAt: string | null;
    createdAt: string;
  }>;
  auditEntries: Array<{
    sequence: number;
    log: {
      actorAdminId: string;
      action: string;
      targetType: string;
      targetId: string;
      beforeJson: unknown;
      afterJson: unknown;
    };
    actor: {
      email: string;
      name: string;
      role: string;
    } | null;
  }>;
  referrals: ReferralSummary;
};

type AdminUserDetailResponse = {
  ok: boolean;
  message?: string;
  detail?: AdminUserDetail;
};

type CurrentAdmin = {
  id: string;
  role: string;
};

type AuthMeResponse = {
  authenticated?: boolean;
  actor?: CurrentAdmin;
  user?: CurrentAdmin | null;
};

type UserDirectoryFilterOverride = {
  query?: string;
  role?: string;
  accountStatus?: string;
};

type UserDirectoryRefreshOptions = UserDirectoryFilterOverride & {
  nextMessage?: string;
};

type UserDirectorySummary = {
  totalCount: number;
  activeCount: number;
  suspendedCount: number;
  salespersonCount: number;
  adminCount: number;
  withdrawnCount: number;
};

export function UserAdminPanel() {
  const [users, setUsers] = useState<AdminUserDirectoryItem[]>([]);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accountReason, setAccountReason] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('member');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [accountStatus, setAccountStatus] = useState('all');
  const [dashboardFilterNotice, setDashboardFilterNotice] = useState<string | null>(null);
  const [message, setMessage] = useState('관리자 로그인 후 회원 목록을 조회할 수 있습니다.');
  const [detailMessage, setDetailMessage] = useState('회원을 선택하면 상세 운영 상태를 볼 수 있습니다.');
  const [isBusy, setIsBusy] = useState(false);
  const { confirmAdminAction, confirmationDialog } = useAdminActionConfirmation();

  useEffect(() => {
    void refresh();
    void refreshCurrentAdmin();
    const unsubscribeAdmin = subscribeAdminRefreshEvent((detail) => {
      if (detail.source === 'users') return;
      void refresh();
    });
    const unsubscribeQueuePreset = subscribeAdminQueuePresetEvent((detail) => {
      if (detail.panel !== 'users') return;
      const nextRole = detail.presetKey === 'salesperson' ? 'salesperson' : 'all';
      const nextAccountStatus = detail.presetKey === 'suspended' ? 'suspended' : 'all';
      const nextFilterLabel = nextRole !== 'all'
        ? formatUserRoleLabel(nextRole)
        : nextAccountStatus !== 'all'
          ? formatUserAccountStatusLabel(nextAccountStatus)
          : null;
      const nextMessage = getUserDirectoryPresetMessage({
        role: nextRole,
        accountStatus: nextAccountStatus,
      });
      setRole(nextRole);
      setAccountStatus(nextAccountStatus);
      setDashboardFilterNotice(nextFilterLabel);
      void refresh({ role: nextRole, accountStatus: nextAccountStatus, nextMessage });
    });
    const unsubscribeAuth = subscribeAuthSessionChangedEvent(() => {
      void refresh();
      void refreshCurrentAdmin();
    });

    return () => {
      unsubscribeAdmin();
      unsubscribeQueuePreset();
      unsubscribeAuth();
    };
  }, []);

  async function refreshCurrentAdmin() {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) {
      setCurrentAdmin(null);
      return;
    }

    const payload = await response.json() as AuthMeResponse;
    const actor = payload.actor ?? payload.user ?? null;
    setCurrentAdmin(payload.authenticated && actor ? actor : null);
  }

  async function refresh(filterOverride: UserDirectoryRefreshOptions = {}) {
    setIsBusy(true);
    const nextQuery = filterOverride.query ?? query;
    const nextRole = filterOverride.role ?? role;
    const nextAccountStatus = filterOverride.accountStatus ?? accountStatus;
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set('query', nextQuery.trim());
    if (nextRole !== 'all') params.set('role', nextRole);
    if (nextAccountStatus !== 'all') params.set('accountStatus', nextAccountStatus);

    const endpoint = params.toString() ? `/api/admin/users?${params}` : '/api/admin/users';
    const response = await fetch(endpoint, { cache: 'no-store' });
    const payload = await response.json() as AdminUsersResponse;
    setIsBusy(false);

    if (!response.ok || !payload.users) {
      setUsers([]);
      setMessage(payload.message || '관리자 권한이 필요합니다.');
      return;
    }

    setUsers(payload.users);
    setMessage(filterOverride.nextMessage ?? `회원 ${payload.users.length}명을 불러왔습니다.`);
  }

  async function openDetail(userId: string) {
    setIsBusy(true);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: 'no-store' });
    const payload = await response.json() as AdminUserDetailResponse;
    setIsBusy(false);

    if (!response.ok || !payload.detail) {
      setDetail(null);
      setDetailMessage(payload.message || '회원 상세 조회에 실패했습니다.');
      return;
    }

    setDetail(payload.detail);
    setNewEmail(payload.detail.user.email);
    setSelectedRole(payload.detail.user.role as UserRole);
    setDetailMessage(`${payload.detail.user.email} 상세 정보를 불러왔습니다.`);
  }

  async function updateRole() {
    if (!detail) return;
    if (!canChangeAdminUserRole({
      actorRole: currentAdmin?.role,
      targetRole: detail.user.role,
      nextRole: selectedRole,
    })) {
      setDetailMessage(getAdminUserPermissionNotice({
        actorRole: currentAdmin?.role,
        targetRole: detail.user.role,
        nextRole: selectedRole,
      }) || '현재 관리자 권한으로는 역할을 변경할 수 없습니다.');
      return;
    }
    if (!await confirmAdminAction(
      'admin.user.role.update',
      `${detail.user.email} -> ${formatUserRoleLabel(selectedRole)}`,
    )) {
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(detail.user.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selectedRole }),
    });
    const payload = await response.json() as AdminUserDetailResponse;
    setIsBusy(false);

    if (!response.ok || !payload.detail) {
      setDetailMessage(payload.message || '회원 역할 변경에 실패했습니다.');
      return;
    }

    setDetail(payload.detail);
    setNewEmail(payload.detail.user.email);
    setSelectedRole(payload.detail.user.role as UserRole);
    setDetailMessage(payload.detail.user.role === 'salesperson'
      ? `${payload.detail.user.email} 회원을 영업자로 지정했습니다. 영업관리에서 회원 배정을 이어가세요.`
      : `${payload.detail.user.email} 역할을 ${formatUserRoleLabel(payload.detail.user.role)}(으)로 변경했습니다.`);
    void refresh({ nextMessage: '회원 목록을 갱신했습니다.' });
    dispatchAdminRefreshEvent({ source: 'users' });
  }

  async function updateAccountStatus(accountStatus: UserAccountStatus) {
    if (!detail) return;
    if (!canChangeAdminUserAccountStatus({
      actorId: currentAdmin?.id,
      actorRole: currentAdmin?.role,
      targetUserId: detail.user.id,
      targetRole: detail.user.role,
      nextAccountStatus: accountStatus,
    })) {
      setDetailMessage(getAdminUserAccountStatusPermissionNotice({
        actorId: currentAdmin?.id,
        actorRole: currentAdmin?.role,
        targetUserId: detail.user.id,
        targetRole: detail.user.role,
        nextAccountStatus: accountStatus,
      }) || '현재 관리자 권한으로는 계정 상태를 변경할 수 없습니다.');
      return;
    }
    if (!await confirmAdminAction(
      accountStatus === 'suspended' ? 'admin.user.account.suspend' : 'admin.user.account.activate',
      `${detail.user.email} -> ${formatUserAccountStatusLabel(accountStatus)}`,
    )) {
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(detail.user.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountStatus, reason: accountReason }),
    });
    const payload = await response.json() as AdminUserDetailResponse;
    setIsBusy(false);

    if (!response.ok || !payload.detail) {
      setDetailMessage(payload.message || '계정 상태 변경에 실패했습니다.');
      return;
    }

    setDetail(payload.detail);
    setNewEmail(payload.detail.user.email);
    setAccountReason('');
    setDetailMessage(`${payload.detail.user.email} 계정 상태를 ${formatUserAccountStatusLabel(payload.detail.user.accountStatus)}(으)로 변경했습니다.`);
    void refresh({ nextMessage: '회원 목록을 갱신했습니다.' });
    dispatchAdminRefreshEvent({ source: 'users' });
  }

  async function updateEmail() {
    if (!detail) return;
    if (currentAdmin?.role !== 'super_admin') {
      setDetailMessage('로그인 이메일 변경은 슈퍼관리자만 가능합니다.');
      return;
    }
    if (!newEmail.trim()) {
      setDetailMessage('변경할 로그인 이메일을 입력해 주세요.');
      return;
    }
    if (!await confirmAdminAction(
      'admin.user.email.update',
      `${detail.user.email} -> ${newEmail.trim()}`,
    )) {
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(detail.user.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    });
    const payload = await response.json() as AdminUserDetailResponse;
    setIsBusy(false);

    if (!response.ok || !payload.detail) {
      setDetailMessage(payload.message || '로그인 이메일 변경에 실패했습니다.');
      return;
    }

    setDetail(payload.detail);
    setNewEmail(payload.detail.user.email);
    setDetailMessage(`로그인 이메일을 ${payload.detail.user.email}(으)로 변경했습니다.`);
    void refresh({ nextMessage: '회원 목록을 갱신했습니다.' });
    dispatchAdminRefreshEvent({ source: 'users' });
  }

  function clearDashboardFilterNotice() {
    setDashboardFilterNotice(null);
    setRole('all');
    setAccountStatus('all');
    void refresh({ role: 'all', accountStatus: 'all' });
  }

  function showAllMembersForSalespersonAssignment() {
    setDashboardFilterNotice(null);
    setRole('all');
    setAccountStatus('all');
    void refresh({
      role: 'all',
      accountStatus: 'all',
      nextMessage: '전체 회원 목록입니다. 상세를 열어 역할을 영업자로 변경하세요.',
    });
  }

  const assignableRoles = getAssignableUserRoles(currentAdmin?.role);
  const canSubmitRole = detail
    ? canChangeAdminUserRole({
      actorRole: currentAdmin?.role,
      targetRole: detail.user.role,
      nextRole: selectedRole,
    })
    : false;
  const canSuspendAccount = detail
    ? canChangeAdminUserAccountStatus({
      actorId: currentAdmin?.id,
      actorRole: currentAdmin?.role,
      targetUserId: detail.user.id,
      targetRole: detail.user.role,
      nextAccountStatus: 'suspended',
    })
    : false;
  const canActivateAccount = detail
    ? canChangeAdminUserAccountStatus({
      actorId: currentAdmin?.id,
      actorRole: currentAdmin?.role,
      targetUserId: detail.user.id,
      targetRole: detail.user.role,
      nextAccountStatus: 'active',
    })
    : false;
  const canChangeEmail = currentAdmin?.role === 'super_admin';
  const rolePermissionNotice = detail && !canSubmitRole
    ? getAdminUserPermissionNotice({
      actorRole: currentAdmin?.role,
      targetRole: detail.user.role,
      nextRole: selectedRole,
    })
    : null;
  const showSalespersonHandoff = detail?.user.role === 'salesperson';
  const accountPermissionNotice = detail && (!canSuspendAccount || !canActivateAccount)
    ? getAdminUserAccountStatusPermissionNotice({
      actorId: currentAdmin?.id,
      actorRole: currentAdmin?.role,
      targetUserId: detail.user.id,
      targetRole: detail.user.role,
      nextAccountStatus: canSuspendAccount ? 'active' : 'suspended',
    })
    : null;
  const userDirectorySummary = getUserDirectorySummary(users);
  const isDetailMode = detail !== null;
  const detailUserSequence = detail
    ? getAdminDisplaySequence(users, (item) => item.user.id === detail.user.id)
    : 0;
  const detailUserDisplayId = detail && detailUserSequence > 0
    ? formatAdminDisplayId('회원', detailUserSequence)
    : detail?.user.id;

  function closeDetail() {
    setDetail(null);
    setAccountReason('');
    setDetailMessage('회원을 선택하면 상세 운영 상태를 볼 수 있습니다.');
  }

  return (
    <>
    <section className={`card wide${isDetailMode ? ' admin-user-detail-mode' : ''}`} id="admin-users">
      {!isDetailMode && (
      <>
      <div className="toolbar">
        <h2>회원 검색</h2>
        <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
      </div>
      <div className="admin-filter-row">
        <input
          aria-label="회원 검색어"
          value={query}
          onChange={(event) => {
            setDashboardFilterNotice(null);
            setQuery(event.target.value);
          }}
          placeholder="이메일, 이름, 회원 ID 검색"
        />
        <select
          aria-label="회원 권한"
          value={role}
          onChange={(event) => {
            setDashboardFilterNotice(null);
            setRole(event.target.value);
          }}
        >
          <option value="all">전체 권한</option>
          <option value="member">{formatUserRoleLabel('member')}</option>
          <option value="trial">{formatUserRoleLabel('trial')}</option>
          <option value="subscriber">{formatUserRoleLabel('subscriber')}</option>
          <option value="salesperson">{formatUserRoleLabel('salesperson')}</option>
          <option value="admin">{formatUserRoleLabel('admin')}</option>
          <option value="super_admin">{formatUserRoleLabel('super_admin')}</option>
        </select>
        <select
          aria-label="계정 상태"
          value={accountStatus}
          onChange={(event) => {
            setDashboardFilterNotice(null);
            setAccountStatus(event.target.value);
          }}
        >
          <option value="all">전체 상태</option>
          <option value="active">{formatUserAccountStatusLabel('active')}</option>
          <option value="suspended">{formatUserAccountStatusLabel('suspended')}</option>
        </select>
        <button className="button" type="button" onClick={() => void refresh()} disabled={isBusy}>검색</button>
      </div>
      <AdminDashboardFilterNotice
        label={dashboardFilterNotice}
        onClear={clearDashboardFilterNotice}
      />
      <div className="admin-user-summary-strip" aria-label="현재 표시 회원 요약">
        <span className="admin-user-summary-pill">
          전체 <strong>{userDirectorySummary.totalCount.toLocaleString('ko-KR')}</strong>
        </span>
        <span className="admin-user-summary-pill">
          정상 <strong>{userDirectorySummary.activeCount.toLocaleString('ko-KR')}</strong>
        </span>
        <span className="admin-user-summary-pill">
          영업자 <strong>{userDirectorySummary.salespersonCount.toLocaleString('ko-KR')}</strong>
        </span>
        <span className="admin-user-summary-pill">
          관리자 <strong>{userDirectorySummary.adminCount.toLocaleString('ko-KR')}</strong>
        </span>
        <span className="admin-user-summary-pill warning">
          정지 <strong>{userDirectorySummary.suspendedCount.toLocaleString('ko-KR')}</strong>
        </span>
        <span className="admin-user-summary-pill muted">
          탈퇴 <strong>{userDirectorySummary.withdrawnCount.toLocaleString('ko-KR')}</strong>
        </span>
      </div>
      {dashboardFilterNotice === formatUserRoleLabel('salesperson') && (
        <div className="notice compact admin-user-preset-guide" role="status">
          <strong>영업자 역할 변경이 필요하신가요?</strong>
          <span>기존 회원을 영업자로 바꾸려면 전체 회원 목록에서 상세를 열고 역할을 변경하세요.</span>
          <button className="button secondary" type="button" onClick={showAllMembersForSalespersonAssignment} disabled={isBusy}>
            전체 회원 보기
          </button>
        </div>
      )}
      <p className="notice">{message}</p>
      <div className="admin-user-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>회원</th>
              <th>권한</th>
              <th>구독</th>
              <th>차트 접근</th>
              <th>최근 결제</th>
              <th>운영 상태</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => {
              const userDisplayId = formatAdminDisplayId(
                '회원',
                getAdminDisplaySequence(users, (userItem) => userItem.user.id === item.user.id),
              );

              return (
              <tr className="admin-user-row" key={item.user.id}>
                <td className="member-directory-cell">
                  <div className="member-directory-title-row">
                    <strong>{item.user.name}</strong>
                    <div className="member-directory-actions">
                      <button className="button secondary" type="button" onClick={() => openDetail(item.user.id)} disabled={isBusy}>
                        상세
                      </button>
                    </div>
                  </div>
                  <small title={item.user.id}>{userDisplayId}</small>
                  <small>{item.user.email}</small>
                  <div className="member-directory-meta-grid">
                    <span>연락번호 {item.user.phoneNumber || '미등록'}</span>
                    <span>추천인 {item.referrer?.email ?? '없음'}</span>
                    <span>가입일 {formatDateTime(item.user.createdAt)}</span>
                  </div>
                </td>
                <td className="admin-user-role-cell">
                  <span className="badge admin-user-role-badge">{formatUserRoleLabel(item.user.role)}</span>
                  <span className={getAccountStatusClassName(item.user.accountStatus)}>
                    {formatUserAccountStatusLabel(item.user.accountStatus)}
                  </span>
                </td>
                <td className="admin-user-subscription-cell">
                  {item.subscription ? (
                    <>
                      <span className="badge admin-user-plan-badge">{formatAdminPlanTierLabel(item.subscription)}</span>
                      <strong>{formatSubscriptionStatusLabel(item.subscription.status)}</strong>
                      {item.subscription.endsAt && <small>만료 {formatDateTime(item.subscription.endsAt)}</small>}
                    </>
                  ) : (
                    <span className="admin-user-empty-text">구독 없음</span>
                  )}
                </td>
                <td className="admin-user-access-cell">
                  <span>{formatChartAccessLabel(item.access)}</span>
                </td>
                <td className="admin-user-payment-cell">
                  {item.latestPayment ? (
                    <>
                      <strong>{formatPaymentStatusLabel(item.latestPayment.status)}</strong>
                      <small>
                        {formatPaymentAmountUsd(item.latestPayment.amountUsd)} / {formatDateTime(item.latestPayment.updatedAt)}
                      </small>
                    </>
                  ) : (
                    <span className="admin-user-empty-text">결제 없음</span>
                  )}
                </td>
                <td className="admin-user-ops-cell">
                  <div className="admin-user-ops-grid" aria-label="운영 상태 요약">
                    <span>결제 <strong>{item.paymentCount}</strong></span>
                    <span>문의 <strong>{item.supportThreadCount}</strong></span>
                    <span>알림 <strong>{item.unreadNotificationCount}</strong></span>
                  </div>
                </td>
              </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6}>표시할 회원이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-user-mobile-list" aria-label="모바일 회원 카드 목록">
        {users.map((item) => {
          const userDisplayId = formatAdminDisplayId(
            '회원',
            getAdminDisplaySequence(users, (userItem) => userItem.user.id === item.user.id),
          );

          return (
          <article className="admin-user-mobile-card" key={`mobile-${item.user.id}`}>
            <div className="admin-user-mobile-card-title-row">
              <div>
                <strong>{item.user.name}</strong>
                <small title={item.user.id}>{userDisplayId}</small>
                <small>{item.user.email}</small>
              </div>
              <button className="button secondary" type="button" onClick={() => openDetail(item.user.id)} disabled={isBusy}>
                상세 보기
              </button>
            </div>
            <div className="admin-user-mobile-card-status-row">
              <span className={getAccountStatusClassName(item.user.accountStatus)}>
                {formatUserAccountStatusLabel(item.user.accountStatus)}
              </span>
              <span className="badge admin-user-role-badge">{formatUserRoleLabel(item.user.role)}</span>
            </div>
            <dl className="admin-user-mobile-card-info-grid">
              <div>
                <dt>연락번호</dt>
                <dd>{item.user.phoneNumber || '미등록'}</dd>
              </div>
              <div>
                <dt>가입일</dt>
                <dd>{formatDateTime(item.user.createdAt)}</dd>
              </div>
              <div>
                <dt>추천인</dt>
                <dd>{item.referrer?.email ?? '없음'}</dd>
              </div>
              <div>
                <dt>구독여부</dt>
                <dd>{item.subscription ? formatSubscriptionStatusLabel(item.subscription.status) : '구독 없음'}</dd>
              </div>
              <div>
                <dt>차트접근</dt>
                <dd>{formatChartAccessLabel(item.access)}</dd>
              </div>
              <div>
                <dt>최근결제</dt>
                <dd>
                  {item.latestPayment
                    ? `${formatPaymentStatusLabel(item.latestPayment.status)} · ${formatPaymentAmountUsd(item.latestPayment.amountUsd)}`
                    : '결제 없음'}
                </dd>
              </div>
            </dl>
            <div className="admin-user-mobile-card-ops-grid" aria-label="운영 상태 요약">
              <span>결제 <strong>{item.paymentCount}</strong></span>
              <span>문의 <strong>{item.supportThreadCount}</strong></span>
              <span>알림 <strong>{item.unreadNotificationCount}</strong></span>
            </div>
          </article>
          );
        })}
        {users.length === 0 && (
          <p className="admin-user-mobile-empty">표시할 회원이 없습니다.</p>
        )}
      </div>
      </>
      )}
      {detail && (
      <div className="admin-user-detail-screen">
        <button
          aria-label="회원 목록으로 돌아가기"
          className="button secondary admin-user-detail-back"
          onClick={closeDetail}
          type="button"
        >
          목록으로
        </button>
      <div className="thread-list admin-detail-panel">
        <p className="notice">{detailMessage}</p>
          <article className="thread-card admin-user-detail-card">
            <div className="admin-user-detail-header">
              <div>
                <div className="thread-meta admin-user-detail-meta">
                  <span className="badge">{formatUserRoleLabel(detail.user.role)}</span>
                  <span>{detail.user.email}</span>
                  <span>{detail.user.phoneNumber || '연락번호 미등록'}</span>
                  <span title={detail.user.id}>{detailUserDisplayId}</span>
                </div>
                <h3 className="admin-user-detail-title">{detail.user.name}</h3>
              </div>
              <span className={getAccountStatusClassName(detail.user.accountStatus)}>
                {formatUserAccountStatusLabel(detail.user.accountStatus)}
              </span>
            </div>
            <div className="admin-filter-row admin-user-detail-control-grid">
              <input
                aria-label="로그인 이메일 변경"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="새 로그인 이메일"
                disabled={!canChangeEmail}
              />
              <button
                className="button secondary"
                type="button"
                onClick={updateEmail}
                disabled={
                  isBusy ||
                  !canChangeEmail ||
                  !newEmail.trim() ||
                  newEmail.trim().toLowerCase() === detail.user.email.toLowerCase()
                }
              >
                로그인 이메일 변경
              </button>
            </div>
            <p className="notice compact admin-user-detail-control-note">슈퍼관리자 전용: 이메일은 로그인 ID로 사용되며 변경 시 감사로그에 기록됩니다.</p>
            <div className="admin-filter-row admin-user-detail-control-grid">
              <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as UserRole)}>
                {ROLE_OPTIONS.map((roleOption) => (
                  <option
                    disabled={!assignableRoles.includes(roleOption.value)}
                    key={roleOption.value}
                    value={roleOption.value}
                  >
                    {roleOption.label}
                  </option>
                ))}
              </select>
              <button className="button" type="button" onClick={updateRole} disabled={isBusy || !canSubmitRole}>역할 변경</button>
            </div>
            {rolePermissionNotice && <p className="notice">{rolePermissionNotice}</p>}
            {showSalespersonHandoff && (
              <div className="notice compact admin-user-sales-handoff" role="status">
                <strong>영업자 지정 완료</strong>
                <span>이제 영업관리에서 담당 회원 배정과 매출 집계를 이어갈 수 있습니다.</span>
                <a className="button secondary" href={`/admin?salespersonId=${encodeURIComponent(detail.user.id)}#admin-sales-assignments`}>
                  영업관리 회원배정으로 이동
                </a>
              </div>
            )}
            <div className="admin-filter-row admin-user-detail-control-grid account-status">
              <input
                aria-label="계정 상태 변경 사유"
                value={accountReason}
                onChange={(event) => setAccountReason(event.target.value)}
                placeholder="정지/해제 사유"
              />
              <button className="button danger" type="button" onClick={() => updateAccountStatus('suspended')} disabled={isBusy || !canSuspendAccount}>
                계정 정지
              </button>
              <button className="button secondary" type="button" onClick={() => updateAccountStatus('active')} disabled={isBusy || !canActivateAccount}>
                정지 해제
              </button>
            </div>
            {accountPermissionNotice && <p className="notice">{accountPermissionNotice}</p>}
            <div className="summary-grid admin-user-detail-summary-grid">
              <article className="mini-card">
                <span>회원 정보</span>
                <strong>{detail.user.phoneNumber || '연락번호 미등록'}</strong>
                <p>추천인: {detail.referrer?.email ?? '없음'} / 가입일: {formatDateTime(detail.user.createdAt)}</p>
              </article>
              <article className="mini-card">
                <span>구독 상태</span>
                {detail.subscription && (
                  <span className="badge admin-user-plan-badge">{formatAdminPlanTierLabel(detail.subscription)}</span>
                )}
                <strong>{detail.subscription ? formatSubscriptionStatusLabel(detail.subscription.status) : '구독 없음'}</strong>
                <p>{formatChartAccessLabel(detail.access)}</p>
                {detail.subscription && isAdminSubscriptionQueueStatus(detail.subscription.status) && (
                  <a className="text-link compact" href={createAdminSubscriptionUrl(detail.subscription.id)}>
                    구독 큐에서 보기
                  </a>
                )}
              </article>
              <article className="mini-card">
                <span>결제</span>
                <strong>{detail.payments.length}건</strong>
                <p>{detail.latestPayment ? formatPaymentStatusLabel(detail.latestPayment.status) : '최근 결제 없음'}</p>
              </article>
              <article className="mini-card">
                <span>추천포인트</span>
                <strong>{formatReferralPoints(detail.referrals.totalPoints)}</strong>
                <p>추천회원 {detail.referrals.referredUserCount}명 / 적립 예정 {formatReferralPoints(detail.referrals.pendingPoints)}</p>
              </article>
              <article className="mini-card">
                <span>고객센터</span>
                <strong>{detail.supportThreads.length}건</strong>
                <p>
                  {detail.supportThreads[0]
                    ? `최근 문의: ${detail.supportThreads[0].title} (${formatSupportStatusLabel(detail.supportThreads[0]?.status ?? '')})`
                    : '최근 문의: 없음'}
                </p>
              </article>
              <article className="mini-card">
                <span>알림</span>
                <strong>{detail.unreadNotificationCount}건 미확인</strong>
                <p>전체 알림 {detail.notifications.length}건</p>
              </article>
            </div>
            <div className="admin-history-grid">
              <section className="admin-history-card admin-user-history-card">
                <h4>추천회원 목록</h4>
                {detail.referrals.referredUsers.length > 0 ? (
                  <ul className="admin-history-list admin-user-history-list referral-member-list">
                    {detail.referrals.referredUsers.map((referral) => (
                      <li key={referral.user.id}>
                        <div className="admin-history-row">
                          <strong>{referral.user.name}</strong>
                          <span>{formatReferralPoints(referral.totalPoints)}</span>
                        </div>
                        <p>{referral.user.email}</p>
                        <small>
                          추천개별포인트 예정 {formatReferralPoints(referral.pendingPoints)}
                          {' / '}
                          확정 {formatReferralPoints(referral.confirmedPoints)}
                        </small>
                        {referral.latestPayment && (
                          <a className="text-link compact" href={createAdminPaymentUrl(referral.latestPayment.id)}>
                            최근 추천 결제 보기
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-history-empty admin-user-history-empty">추천회원 목록이 없습니다.</p>
                )}
              </section>
              <section className="admin-history-card admin-user-history-card">
                <h4>최근 결제 내역</h4>
                {detail.payments.length > 0 ? (
                  <ul className="admin-history-list admin-user-history-list">
                    {detail.payments.map((payment, paymentIndex) => (
                      <li key={payment.id}>
                        <div className="admin-history-row">
                          <strong>{formatPaymentStatusLabel(payment.status)}</strong>
                          <span>${payment.amountUsd}</span>
                        </div>
                        <p title={payment.id}>{formatAdminDisplayId('결제', paymentIndex + 1)}</p>
                        <a className="text-link compact" href={createAdminPaymentUrl(payment.id)}>
                          결제 큐에서 보기
                        </a>
                        <small>{payment.updatedAt}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-history-empty admin-user-history-empty">결제 내역이 없습니다.</p>
                )}
              </section>
              <section className="admin-history-card admin-user-history-card">
                <h4>최근 문의 내역</h4>
                {detail.supportThreads.length > 0 ? (
                  <ul className="admin-history-list admin-user-history-list">
                    {detail.supportThreads.map((thread, threadIndex) => (
                      <li key={thread.id}>
                        <div className="admin-history-row">
                          <strong>{thread.title}</strong>
                          <span>{formatSupportStatusLabel(thread.status)}</span>
                        </div>
                        <p title={thread.id}>{formatAdminDisplayId('문의', threadIndex + 1)}</p>
                        <a className="text-link compact" href={createAdminSupportThreadUrl(thread.id)}>
                          문의 답변 화면
                        </a>
                        <small>{thread.updatedAt}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-history-empty admin-user-history-empty">문의 내역이 없습니다.</p>
                )}
              </section>
              <section className="admin-history-card admin-user-history-card">
                <h4>최근 알림 내역</h4>
                {detail.notifications.length > 0 ? (
                  <ul className="admin-history-list admin-user-history-list">
                    {detail.notifications.map((notification) => (
                      <li key={notification.id}>
                        <div className="admin-history-row">
                          <strong>{notification.title}</strong>
                          <span>{notification.readAt ? '읽음' : '미확인'}</span>
                        </div>
                        <span className="badge">{getNotificationCategoryLabel(notification.category)}</span>
                        <p>{notification.id}</p>
                        {notification.linkUrl && (
                          <a className="text-link compact" href={notification.linkUrl}>
                            {getNotificationLinkLabel(notification)}
                          </a>
                        )}
                        <small>{notification.createdAt}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-history-empty admin-user-history-empty">알림 내역이 없습니다.</p>
                )}
              </section>
              <section className="admin-history-card admin-history-card-wide admin-user-history-card">
                <h4>최근 관리자 조치</h4>
                {detail.auditEntries.length > 0 ? (
                  <ul className="admin-history-list admin-user-history-list admin-user-audit-history-list admin-audit-history-list">
                    {detail.auditEntries.map((entry) => {
                      const auditTargetLink = getAdminAuditTargetLink(entry.log.targetType, entry.log.targetId);

                      return (
                        <li key={`${entry.sequence}-${entry.log.targetType}-${entry.log.targetId}`}>
                          <div className="admin-history-row">
                            <strong>{entry.log.action}</strong>
                            <span>{entry.actor?.email ?? entry.log.actorAdminId}</span>
                          </div>
                          <p title={entry.log.targetId}>
                            {formatAdminDisplayId('작업', entry.sequence)} / {entry.log.targetType}
                          </p>
                          {auditTargetLink && (
                            <a className="text-link compact" href={auditTargetLink.href}>
                              {auditTargetLink.label}
                            </a>
                          )}
                          <ul className="audit-summary">
                            {formatAuditLogSummary({
                              action: entry.log.action,
                              targetType: entry.log.targetType,
                              targetId: entry.log.targetId,
                              beforeJson: entry.log.beforeJson,
                              afterJson: entry.log.afterJson,
                            }).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="admin-history-empty admin-user-history-empty">관련 관리자 조치가 없습니다.</p>
                )}
              </section>
            </div>
          </article>
        </div>
      </div>
      )}
    </section>
    {confirmationDialog}
    </>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getAccountStatusClassName(accountStatus: UserAccountStatus): string {
  return `admin-user-account-status ${accountStatus}`;
}

function formatReferralPoints(value: number): string {
  return `${value.toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  })}P`;
}

function getUserDirectoryPresetMessage(input: { role: string; accountStatus: string }): string | undefined {
  if (input.role === 'salesperson') {
    return '영업 역할 필터를 적용했습니다. 영업자 회원만 표시합니다.';
  }

  if (input.accountStatus === 'suspended') {
    return '정지 계정 필터를 적용했습니다. 정지 회원만 표시합니다.';
  }

  return undefined;
}

function getUserDirectorySummary(items: AdminUserDirectoryItem[]): UserDirectorySummary {
  return items.reduce<UserDirectorySummary>((summary, item) => {
    summary.totalCount += 1;
    if (item.user.accountStatus === 'active') summary.activeCount += 1;
    if (item.user.accountStatus === 'suspended') summary.suspendedCount += 1;
    if (item.user.role === 'salesperson') summary.salespersonCount += 1;
    if (item.user.role === 'admin' || item.user.role === 'super_admin') summary.adminCount += 1;
    if (isWithdrawnUser(item.user)) summary.withdrawnCount += 1;
    return summary;
  }, {
    totalCount: 0,
    activeCount: 0,
    suspendedCount: 0,
    salespersonCount: 0,
    adminCount: 0,
    withdrawnCount: 0,
  });
}

function isWithdrawnUser(user: AdminUserDirectoryItem['user']): boolean {
  return user.accountStatus === 'suspended' &&
    user.phoneNumber === null &&
    user.role !== 'admin' &&
    user.role !== 'super_admin';
}
