'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
  getAdminDashboardSectionMeta,
  type AdminDashboardSectionKey,
} from './admin-dashboard-sections.ts';

const AdminDashboardShellContext = createContext<AdminDashboardSectionKey>('overview');

export function AdminDashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const [activeSection, setActiveSection] = useState<AdminDashboardSectionKey>('overview');
  const activeSectionMeta = getAdminDashboardSectionMeta(activeSection);

  useEffect(() => {
    function syncActiveSection() {
      setActiveSection(getAdminDashboardSectionFromLocation(window.location.hash, window.location.search));
    }

    syncActiveSection();
    window.addEventListener('hashchange', syncActiveSection);
    window.addEventListener('popstate', syncActiveSection);
    return () => {
      window.removeEventListener('hashchange', syncActiveSection);
      window.removeEventListener('popstate', syncActiveSection);
    };
  }, []);

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;

    window.requestAnimationFrame(() => {
      document.getElementById(decodeHashId(targetId))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [activeSection]);

  return (
    <AdminDashboardShellContext.Provider value={activeSection}>
      <div className="admin-dashboard-shell" data-active-admin-section={activeSection}>
        <aside className="admin-dashboard-sidebar" aria-label="관리자 메뉴">
          <div className="admin-dashboard-sidebar-header">
            <span>Admin Console</span>
            <strong>운영 대시보드</strong>
          </div>
          <nav className="admin-dashboard-menu" aria-label="관리자 카테고리">
            {ADMIN_DASHBOARD_SECTIONS.map((section) => {
              const isActive = section.key === activeSection;
              return (
                <a
                  aria-current={isActive ? 'page' : undefined}
                  className={`admin-dashboard-menu-item${isActive ? ' active' : ''}`}
                  href={section.href}
                  key={section.key}
                >
                  <span>{section.eyebrow}</span>
                  <strong>{section.label}</strong>
                </a>
              );
            })}
          </nav>
        </aside>
        <section className="admin-dashboard-workspace" aria-label="관리자 작업 영역">
          <header className="admin-dashboard-workspace-header">
            <span>{activeSectionMeta.eyebrow}</span>
            <div>
              <h2>{activeSectionMeta.label}</h2>
              <p>{activeSectionMeta.description}</p>
            </div>
          </header>
          {children}
        </section>
      </div>
    </AdminDashboardShellContext.Provider>
  );
}

export function AdminDashboardShellSection({
  children,
  sectionKey,
}: Readonly<{
  children: ReactNode;
  sectionKey: AdminDashboardSectionKey;
}>) {
  const activeSection = useContext(AdminDashboardShellContext);
  const isActive = activeSection === sectionKey;

  return (
    <div
      className={`admin-dashboard-section${isActive ? ' active' : ''}`}
      data-admin-section={sectionKey}
      hidden={!isActive}
      id={`admin-section-${sectionKey}`}
    >
      {children}
    </div>
  );
}

function decodeHashId(targetId: string): string {
  try {
    return decodeURIComponent(targetId);
  } catch {
    return targetId;
  }
}
