'use client';

import { useEffect, useState } from 'react';
import {
  formatChartAccessLabel,
  type PaymentStatus,
  type SubscriptionStatus,
  type UserAccountStatus,
  type UserRole,
} from '../../src/domain/chart-service/index.ts';
import { subscribeAuthSessionChangedEvent } from '../auth-events';
import { AdminDashboardFilterNotice } from './admin-dashboard-filter-notice';
import { subscribeAdminQueuePresetEvent } from './admin-queue-preset-events';
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

export function UserAdminPanel() {
  const [users, setUsers] = useState<AdminUserDirectoryItem[]>([]);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accountReason, setAccountReason] = useState('');
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
      const nextAccountStatus = detail.presetKey === 'suspended' ? 'suspended' : 'all';
      setAccountStatus(nextAccountStatus);
      if (nextAccountStatus === 'suspended') {
        setDashboardFilterNotice(formatUserAccountStatusLabel('suspended'));
      } else {
        setDashboardFilterNotice(null);
      }
      void refresh({ accountStatus: nextAccountStatus });
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
    setSelectedRole(payload.detail.user.role as UserRole);
    setDetailMessage(`${payload.detail.user.email} 역할을 ${formatUserRoleLabel(payload.detail.user.role)}(으)로 변경했습니다.`);
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
    setAccountReason('');
    setDetailMessage(`${payload.detail.user.email} 계정 상태를 ${formatUserAccountStatusLabel(payload.detail.user.accountStatus)}(으)로 변경했습니다.`);
    void refresh({ nextMessage: '회원 목록을 갱신했습니다.' });
    dispatchAdminRefreshEvent({ source: 'users' });
  }

  function clearDashboardFilterNotice() {
    setDashboardFilterNotice(null);
    setAccountStatus('all');
    void refresh({ accountStatus: 'all' });
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
  const rolePermissionNotice = detail && !canSubmitRole
    ? getAdminUserPermissionNotice({
      actorRole: currentAdmin?.role,
      targetRole: detail.user.role,
      nextRole: selectedRole,
    })
    : null;
  const accountPermissionNotice = detail && (!canSuspendAccount || !canActivateAccount)
    ? getAdminUserAccountStatusPermissionNotice({
      actorId: currentAdmin?.id,
      actorRole: currentAdmin?.role,
      targetUserId: detail.user.id,
      targetRole: detail.user.role,
      nextAccountStatus: canSuspendAccount ? 'active' : 'suspended',
    })
    : null;

  return (
    <>
    <section className="card wide" id="admin-users">
      <div className="toolbar">
        <h2>회원 검색</h2>
        <button className="button secondary" type="button" onClick={() => void refresh()} disabled={isBusy}>새로고침</button>
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
      <p className="notice">{message}</p>
      <table className="table">
        <thead>
          <tr>
            <th>회원</th>
            <th>권한</th>
            <th>구독</th>
            <th>차트 접근</th>
            <th>최근 결제</th>
            <th>운영 상태</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {users.map((item) => (
            <tr key={item.user.id}>
              <td className="member-directory-cell">
                <strong>{item.user.name}</strong>
                <small>{item.user.email}</small>
                <span>연락번호 {item.user.phoneNumber || '미등록'}</span>
                <span>추천인 {item.referrer?.email ?? '없음'}</span>
                <span>가입일 {formatDateTime(item.user.createdAt)}</span>
              </td>
              <td>
                <span className="badge">{formatUserRoleLabel(item.user.role)}</span><br />
                <small>{formatUserAccountStatusLabel(item.user.accountStatus)}</small>
              </td>
              <td>{item.subscription ? formatSubscriptionStatusLabel(item.subscription.status) : '구독 없음'}</td>
              <td>{formatChartAccessLabel(item.access)}</td>
              <td>
                {item.latestPayment
                  ? `${formatPaymentStatusLabel(item.latestPayment.status)} / $${item.latestPayment.amountUsd}`
                  : '결제 없음'}
              </td>
              <td>
                결제 {item.paymentCount}건<br />
                문의 {item.supportThreadCount}건<br />
                미확인 알림 {item.unreadNotificationCount}건
              </td>
              <td>
                <button className="button secondary" type="button" onClick={() => openDetail(item.user.id)} disabled={isBusy}>
                  상세
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={7}>표시할 회원이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="thread-list admin-detail-panel">
        <p className="notice">{detailMessage}</p>
        {detail && (
          <article className="thread-card">
            <div className="thread-meta">
              <span className="badge">{formatUserRoleLabel(detail.user.role)}</span>
              <span>{formatUserAccountStatusLabel(detail.user.accountStatus)}</span>
              <span>{detail.user.email}</span>
              <span>{detail.user.phoneNumber || '연락번호 미등록'}</span>
              <span>{detail.user.id}</span>
            </div>
            <h3>{detail.user.name}</h3>
            <div className="admin-filter-row">
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
            <div className="admin-filter-row">
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
            <div className="summary-grid">
              <article className="mini-card">
                <span>회원 정보</span>
                <strong>{detail.user.phoneNumber || '연락번호 미등록'}</strong>
                <p>추천인: {detail.referrer?.email ?? '없음'} / 가입일: {formatDateTime(detail.user.createdAt)}</p>
              </article>
              <article className="mini-card">
                <span>구독 상태</span>
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
              <section className="admin-history-card">
                <h4>최근 결제 내역</h4>
                {detail.payments.length > 0 ? (
                  <ul className="admin-history-list">
                    {detail.payments.map((payment) => (
                      <li key={payment.id}>
                        <div className="admin-history-row">
                          <strong>{formatPaymentStatusLabel(payment.status)}</strong>
                          <span>${payment.amountUsd}</span>
                        </div>
                        <p>{payment.id}</p>
                        <a className="text-link compact" href={createAdminPaymentUrl(payment.id)}>
                          결제 큐에서 보기
                        </a>
                        <small>{payment.updatedAt}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-history-empty">결제 내역이 없습니다.</p>
                )}
              </section>
              <section className="admin-history-card">
                <h4>최근 문의 내역</h4>
                {detail.supportThreads.length > 0 ? (
                  <ul className="admin-history-list">
                    {detail.supportThreads.map((thread) => (
                      <li key={thread.id}>
                        <div className="admin-history-row">
                          <strong>{thread.title}</strong>
                          <span>{formatSupportStatusLabel(thread.status)}</span>
                        </div>
                        <p>{thread.id}</p>
                        <a className="text-link compact" href={createAdminSupportThreadUrl(thread.id)}>
                          문의 답변 화면
                        </a>
                        <small>{thread.updatedAt}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-history-empty">문의 내역이 없습니다.</p>
                )}
              </section>
              <section className="admin-history-card">
                <h4>최근 알림 내역</h4>
                {detail.notifications.length > 0 ? (
                  <ul className="admin-history-list">
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
                  <p className="admin-history-empty">알림 내역이 없습니다.</p>
                )}
              </section>
              <section className="admin-history-card admin-history-card-wide">
                <h4>최근 관리자 조치</h4>
                {detail.auditEntries.length > 0 ? (
                  <ul className="admin-history-list admin-audit-history-list">
                    {detail.auditEntries.map((entry) => {
                      const auditTargetLink = getAdminAuditTargetLink(entry.log.targetType, entry.log.targetId);

                      return (
                        <li key={`${entry.sequence}-${entry.log.targetType}-${entry.log.targetId}`}>
                          <div className="admin-history-row">
                            <strong>{entry.log.action}</strong>
                            <span>{entry.actor?.email ?? entry.log.actorAdminId}</span>
                          </div>
                          <p>{entry.log.targetType} / {entry.log.targetId}</p>
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
                  <p className="admin-history-empty">관련 관리자 조치가 없습니다.</p>
                )}
              </section>
            </div>
          </article>
        )}
      </div>
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
