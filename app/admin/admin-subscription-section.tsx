'use client';

import { useEffect, useState } from 'react';
import { AdminWebInfoPanel } from './admin-web-info-panel';
import { AdminTrialPolicyPanel } from './admin-trial-policy-panel';
import { SubscriptionAdminPanel } from './subscription-admin-panel';

type SubscriptionPageKey = 'queue' | 'planServices' | 'trialPolicy';

const SUBSCRIPTION_SUBMENU: Array<{
  key: SubscriptionPageKey;
  label: string;
  href: string;
}> = [
  { key: 'queue', label: '구독요청', href: '#admin-subscriptions' },
  { key: 'planServices', label: '플랜 제공서비스', href: '#admin-plan-services' },
  { key: 'trialPolicy', label: '무료체험정책', href: '#admin-trial-policy' },
];

export function AdminSubscriptionSection() {
  const [activePage, setActivePage] = useState<SubscriptionPageKey>(() => getInitialSubscriptionPage());

  useEffect(() => {
    function syncPageFromHash() {
      setActivePage(getSubscriptionPageFromHash(window.location.hash));
    }

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  return (
    <div className="admin-subscription-group">
      <nav className="admin-web-info-tabs subscription-submenu-tabs" aria-label="구독관리 세부 메뉴">
        {SUBSCRIPTION_SUBMENU.map((item) => (
          <a
            aria-current={activePage === item.key ? 'page' : undefined}
            className={activePage === item.key ? 'active' : ''}
            href={item.href}
            key={item.key}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {activePage === 'queue' && <SubscriptionAdminPanel />}
      {activePage === 'planServices' && <AdminWebInfoPanel mode="planServices" />}
      {activePage === 'trialPolicy' && <AdminTrialPolicyPanel />}
    </div>
  );
}

function getSubscriptionPageFromHash(hash: string): SubscriptionPageKey {
  const targetId = hash.startsWith('#') ? hash.slice(1) : hash;
  if (targetId === 'admin-plan-services') return 'planServices';
  if (targetId === 'admin-trial-policy') return 'trialPolicy';
  return 'queue';
}

function getInitialSubscriptionPage(): SubscriptionPageKey {
  if (typeof window === 'undefined') return 'queue';
  return getSubscriptionPageFromHash(window.location.hash);
}
