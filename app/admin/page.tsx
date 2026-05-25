import { AdminAccessGate } from './admin-access-gate';
import { AdminDashboardShell, AdminDashboardShellSection } from './admin-dashboard-shell';
import { AdminDashboardPanel } from './admin-dashboard-panel';
import { AdminPaymentSettingsPanel } from './admin-payment-settings-panel';
import { AdminPointSettingsPanel } from './admin-point-settings-panel';
import { AdminSalesPanel } from './admin-sales-panel';
import { AdminStatisticsPanel } from './admin-statistics-panel';
import { AdminWebInfoPanel } from './admin-web-info-panel';
import { AdminPanel } from './admin-panel';
import { AuditLogPanel } from './audit-log-panel';
import { SubscriptionAdminPanel } from './subscription-admin-panel';
import { SupportAdminPanel } from './support-admin-panel';
import { UserAdminPanel } from './user-admin-panel';

export default function AdminPage() {
  return (
    <main className="page admin-page">
      <div className="admin-page-hero">
        <span>Chart Service Operations</span>
        <h1>관리자페이지</h1>
        <p className="lede">
          관리자 세션이 있을 때만 결제 요청, 입금 확인, 구독 승인, 환불/취소 처리를 실행합니다.
        </p>
      </div>
      <AdminAccessGate>
        <AdminDashboardShell>
          <AdminDashboardShellSection sectionKey="overview">
            <div id="admin-overview">
              <AdminDashboardPanel />
            </div>
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="webInfo">
            <div className="admin-web-info-group">
              <nav className="admin-web-info-tabs" aria-label="웹정보관리 세부 메뉴">
                <a href="#admin-web-info-terms">가입약관</a>
                <a href="#admin-web-info-privacy">개인정보보호정책</a>
                <a href="#admin-payment-settings">입금정보관리</a>
                <a href="#admin-point-settings">포인트관리</a>
              </nav>
              <AdminWebInfoPanel />
              <AdminPaymentSettingsPanel />
              <AdminPointSettingsPanel />
            </div>
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="users">
            <UserAdminPanel />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="support">
            <SupportAdminPanel />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="payments">
            <AdminPanel />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="subscriptions">
            <SubscriptionAdminPanel />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="sales">
            <AdminSalesPanel />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="statistics">
            <AdminStatisticsPanel />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="audit">
            <AuditLogPanel />
          </AdminDashboardShellSection>
        </AdminDashboardShell>
      </AdminAccessGate>
    </main>
  );
}
