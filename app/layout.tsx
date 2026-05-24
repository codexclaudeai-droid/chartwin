import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNavLink } from './admin-nav-link';
import { NotificationNavLink } from './notification-nav-link';
import { SessionNav } from './session-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'TC Chart',
  description: '구독형 차트 시그널 서비스',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">TC Chart</Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/">홈</Link>
              <Link href="/chart">차트</Link>
              <Link href="/pricing">구독</Link>
              <Link href="/support">고객센터</Link>
              <Link href="/profile">내 계정</Link>
              <NotificationNavLink />
              <AdminNavLink />
            </nav>
            <SessionNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
