import { AdminAccessGate } from './admin-access-gate';
import { AdminDashboardShell, AdminDashboardShellSection } from './admin-dashboard-shell';
import { AdminDashboardPanel } from './admin-dashboard-panel';
import { AdminSalesPanel } from './admin-sales-panel';
import { AdminStatisticsPanel } from './admin-statistics-panel';
import { AdminSubscriptionSection } from './admin-subscription-section';
import { AdminSymbolsPanel } from './admin-symbols-panel';
import { AdminTelegramAlertsPanel } from './admin-telegram-alerts-panel';
import { AdminWebInfoSection } from './admin-web-info-section';
import { AdminPanel } from './admin-panel';
import { AuditLogPanel } from './audit-log-panel';
import { SupportAdminPanel } from './support-admin-panel';
import { UserAdminPanel } from './user-admin-panel';

export default function AdminPage() {
  return (
    <main className="page admin-page">
      <div className="admin-page-hero">
        <span>Chart Service Operations</span>
        <h1>관리자페이지</h1>
        <p className="lede">
          관리자 세션이 있을 때 결제 요청, 입금 확인, 구독 승인, 환불과 취소 처리를 실행합니다.
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
            <AdminWebInfoSection />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="symbols">
            <AdminSymbolsPanel />
          </AdminDashboardShellSection>
          <AdminDashboardShellSection sectionKey="telegramAlerts">
            <AdminTelegramAlertsPanel />
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
            <AdminSubscriptionSection />
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
