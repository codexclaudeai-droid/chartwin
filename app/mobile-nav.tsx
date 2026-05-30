'use client';

import Link from 'next/link';
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
          <Link href="/">홈</Link>
          <Link href="/chart" aria-label="TC Chart 페이지">TC차트</Link>
          <Link href="/#landing-plans">구독</Link>
          <Link href="/support">고객센터</Link>
          <ProfileNavLink />
          <NotificationNavLink />
          <AdminNavLink />
        </nav>
        <SessionNav />
      </div>
    </div>
  );
}
