import { AdminAccessGate } from './admin-access-gate';
import { AdminDashboardPanel } from './admin-dashboard-panel';
import { AdminPanel } from './admin-panel';
import { AuditLogPanel } from './audit-log-panel';
import { SubscriptionAdminPanel } from './subscription-admin-panel';
import { SupportAdminPanel } from './support-admin-panel';
import { UserAdminPanel } from './user-admin-panel';

export default function AdminPage() {
  return (
    <main className="page">
      <h1>관리자페이지</h1>
      <p className="lede">
        관리자 세션이 있을 때만 결제 요청, 입금 확인, 구독 승인, 환불/취소 처리를 실행합니다.
      </p>
      <AdminAccessGate>
        <AdminDashboardPanel />
        <UserAdminPanel />
        <AdminPanel />
        <SubscriptionAdminPanel />
        <SupportAdminPanel />
        <AuditLogPanel />
      </AdminAccessGate>
    </main>
  );
}
