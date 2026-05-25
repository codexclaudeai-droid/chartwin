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
  type AdminDashboardSectionKey,
} from './admin-dashboard-sections.ts';

const AdminDashboardShellContext = createContext<AdminDashboardSectionKey>('overview');

export function AdminDashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const [activeSection, setActiveSection] = useState<AdminDashboardSectionKey>('overview');
  const [activeTargetId, setActiveTargetId] = useState('admin-overview');

  useEffect(() => {
    function syncActiveSection() {
      const targetId = decodeHashId(window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash);
      setActiveSection(getAdminDashboardSectionFromLocation(window.location.hash, window.location.search));
      setActiveTargetId(targetId || getDefaultTargetIdForSearch(window.location.search));
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
              const activeChildHref = getActiveChildHref(section, activeTargetId);
              return (
                <div className="admin-dashboard-menu-group" key={section.key}>
                  <a
                    aria-current={isActive ? 'page' : undefined}
                    className={`admin-dashboard-menu-item${isActive ? ' active' : ''}`}
                    href={section.href}
                  >
                    <span>{section.eyebrow}</span>
                    <strong>{section.label}</strong>
                  </a>
                  {section.children?.length && (
                  <div className="admin-dashboard-submenu">
                    {section.children.map((child) => {
                      const isChildActive = child.href === activeChildHref;
                      return (
                        <a
                          aria-current={isChildActive ? 'page' : undefined}
                          className={isChildActive ? 'active' : ''}
                          href={child.href}
                          key={child.href}
                        >
                          {child.label}
                        </a>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
        <section className="admin-dashboard-workspace" aria-label="관리자 작업 영역">
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

function getDefaultTargetIdForSearch(search: string): string {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return searchParams.has('supportThread') ? 'admin-support' : 'admin-overview';
}

function getActiveChildHref(
  section: (typeof ADMIN_DASHBOARD_SECTIONS)[number],
  activeTargetId: string,
): string | null {
  if (!section.children?.length) return null;

  const exactChild = section.children.find((child) => child.href === `#${activeTargetId}`);
  if (exactChild) return exactChild.href;

  if (section.href === `#${activeTargetId}`) return section.children[0]?.href ?? null;

  return null;
}
