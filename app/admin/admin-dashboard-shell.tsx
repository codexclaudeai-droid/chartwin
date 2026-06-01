'use client';

import {
  BarChart3,
  Briefcase,
  ClipboardList,
  CreditCard,
  Globe,
  LayoutDashboard,
  List,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Users,
  type LucideIcon,
} from 'lucide-react';
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

const ADMIN_DASHBOARD_SECTION_ICONS: Record<AdminDashboardSectionKey, LucideIcon> = {
  overview: LayoutDashboard,
  webInfo: Globe,
  symbols: List,
  users: Users,
  support: MessageCircle,
  payments: CreditCard,
  subscriptions: Repeat,
  sales: Briefcase,
  statistics: BarChart3,
  audit: ClipboardList,
};

export function AdminDashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const [activeSection, setActiveSection] = useState<AdminDashboardSectionKey>(() => getInitialAdminDashboardState().activeSection);
  const [activeTargetId, setActiveTargetId] = useState(() => getInitialAdminDashboardState().activeTargetId);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    const targetId = activeTargetId;
    if (!targetId) return;

    window.requestAnimationFrame(() => {
      document.getElementById(decodeHashId(targetId))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [activeTargetId]);

  return (
    <AdminDashboardShellContext.Provider value={activeSection}>
      <div
        className="admin-dashboard-shell"
        data-active-admin-section={activeSection}
        data-sidebar-collapsed={isSidebarCollapsed}
      >
        <aside className="admin-dashboard-sidebar" aria-label="관리자 메뉴">
          <div className="admin-dashboard-sidebar-header">
            <div className="admin-dashboard-sidebar-heading">
              <span>Admin Console</span>
              <strong>운영 대시보드</strong>
            </div>
            <button
              aria-label={isSidebarCollapsed ? '관리자 메뉴 펼치기' : '관리자 메뉴 접기'}
              aria-pressed={isSidebarCollapsed}
              className="admin-dashboard-sidebar-toggle"
              onClick={() => setSidebarCollapsed((current) => !current)}
              type="button"
            >
              {isSidebarCollapsed
                ? <PanelLeftOpen aria-hidden="true" />
                : <PanelLeftClose aria-hidden="true" />}
            </button>
          </div>
          <nav className="admin-dashboard-menu" aria-label="관리자 카테고리">
            {ADMIN_DASHBOARD_SECTIONS.map((section) => {
              const isActive = section.key === activeSection;
              const activeChildHref = getActiveChildHref(section, activeTargetId);
              const SectionIcon = ADMIN_DASHBOARD_SECTION_ICONS[section.key];
              return (
                <div className="admin-dashboard-menu-group" key={section.key}>
                  <a
                    aria-label={isSidebarCollapsed ? section.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`admin-dashboard-menu-item${isActive ? ' active' : ''}`}
                    href={section.href}
                    title={isSidebarCollapsed ? section.label : undefined}
                  >
                    <SectionIcon aria-hidden="true" className="admin-dashboard-menu-icon" />
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

function getInitialAdminDashboardState(): {
  activeSection: AdminDashboardSectionKey;
  activeTargetId: string;
} {
  if (typeof window === 'undefined') {
    return { activeSection: 'overview', activeTargetId: 'admin-overview' };
  }

  const targetId = decodeHashId(window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash);
  return {
    activeSection: getAdminDashboardSectionFromLocation(window.location.hash, window.location.search),
    activeTargetId: targetId || getDefaultTargetIdForSearch(window.location.search),
  };
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
