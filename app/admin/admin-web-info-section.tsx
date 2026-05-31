'use client';

import { useEffect, useState } from 'react';
import { AdminPaymentSettingsPanel } from './admin-payment-settings-panel';
import { AdminPointSettingsPanel } from './admin-point-settings-panel';
import { AdminNoticePopupPanel } from './admin-notice-popup-panel';
import { AdminPublicBoardPanel } from './admin-public-board-panel';
import { AdminWebInfoPanel } from './admin-web-info-panel';

type WebInfoPageKey = 'terms' | 'privacy' | 'planServices' | 'publicBoard' | 'noticePopup' | 'payments' | 'points';

const WEB_INFO_SUBMENU: Array<{
  key: WebInfoPageKey;
  label: string;
  href: string;
}> = [
  { key: 'terms', label: '가입약관', href: '#admin-web-info-terms' },
  { key: 'privacy', label: '개인정보보호정책', href: '#admin-web-info-privacy' },
  { key: 'planServices', label: '플랜 제공서비스', href: '#admin-plan-services' },
  { key: 'publicBoard', label: '공개게시판', href: '#admin-public-board' },
  { key: 'noticePopup', label: '공지팝업', href: '#admin-notice-popup' },
  { key: 'payments', label: '입금정보관리', href: '#admin-payment-settings' },
  { key: 'points', label: '포인트관리', href: '#admin-point-settings' },
];

export function AdminWebInfoSection() {
  const [activePage, setActivePage] = useState<WebInfoPageKey>('terms');

  useEffect(() => {
    function syncPageFromHash() {
      setActivePage(getWebInfoPageFromHash(window.location.hash));
    }

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  return (
    <div className="admin-web-info-group">
      <nav className="admin-web-info-tabs" aria-label="웹정보관리 세부 메뉴">
        {WEB_INFO_SUBMENU.map((item) => (
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

      {activePage === 'terms' && <AdminWebInfoPanel mode="terms" />}
      {activePage === 'privacy' && <AdminWebInfoPanel mode="privacy" />}
      {activePage === 'planServices' && <AdminWebInfoPanel mode="planServices" />}
      {activePage === 'publicBoard' && <AdminPublicBoardPanel />}
      {activePage === 'noticePopup' && <AdminNoticePopupPanel />}
      {activePage === 'payments' && <AdminPaymentSettingsPanel />}
      {activePage === 'points' && <AdminPointSettingsPanel />}
    </div>
  );
}

function getWebInfoPageFromHash(hash: string): WebInfoPageKey {
  const targetId = hash.startsWith('#') ? hash.slice(1) : hash;
  if (targetId === 'admin-web-info-privacy') return 'privacy';
  if (targetId === 'admin-plan-services') return 'planServices';
  if (targetId === 'admin-public-board') return 'publicBoard';
  if (targetId === 'admin-notice-popup') return 'noticePopup';
  if (targetId === 'admin-payment-settings') return 'payments';
  if (targetId === 'admin-point-settings') return 'points';
  return 'terms';
}
