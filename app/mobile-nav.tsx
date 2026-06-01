'use client';

import Link from 'next/link';
import {
  ChartCandlestick,
  Headset,
  Home,
  ReceiptText,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { AdminNavLink } from './admin-nav-link';
import { NotificationNavLink } from './notification-nav-link';
import { ProfileNavLink } from './profile-nav-link';
import { SessionNav } from './session-nav';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  function handlePanelClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('a, button')) setIsOpen(false);
  }

  return (
    <div className={`mobile-nav ${isOpen ? 'open' : ''}`.trim()}>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-label={isOpen ? '모바일 메뉴 닫기' : '모바일 메뉴 열기'}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {isOpen ? (
        <button
          className="mobile-nav-backdrop"
          type="button"
          aria-label="모바일 메뉴 닫기"
          onClick={() => setIsOpen(false)}
        />
      ) : null}
      <div
        className="mobile-nav-panel"
        id="mobile-nav-panel"
        onClick={handlePanelClick}
      >
        <button
          className="mobile-nav-panel-close"
          type="button"
          aria-label="모바일 메뉴 닫기"
          onClick={() => setIsOpen(false)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <nav className="mobile-nav-links" aria-label="모바일 메뉴">
          <Link href="/">
            <span className="mobile-nav-link-icon" aria-hidden="true"><Home /></span>
            <span className="mobile-nav-link-label">홈</span>
          </Link>
          <Link href="/chart" aria-label="TC Chart 페이지">
            <span className="mobile-nav-link-icon" aria-hidden="true"><ChartCandlestick /></span>
            <span className="mobile-nav-link-label">TC차트</span>
          </Link>
          <Link href="/#landing-plans">
            <span className="mobile-nav-link-icon" aria-hidden="true"><ReceiptText /></span>
            <span className="mobile-nav-link-label">구독</span>
          </Link>
          <Link href="/support">
            <span className="mobile-nav-link-icon" aria-hidden="true"><Headset /></span>
            <span className="mobile-nav-link-label">고객센터</span>
          </Link>
          <ProfileNavLink />
          <NotificationNavLink />
          <AdminNavLink />
        </nav>
        <SessionNav />
      </div>
    </div>
  );
}
