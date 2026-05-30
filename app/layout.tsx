import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AdminNavLink } from './admin-nav-link';
import { MobileNav } from './mobile-nav';
import { NotificationNavLink } from './notification-nav-link';
import { ProfileNavLink } from './profile-nav-link';
import { SessionNav } from './session-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradingCore',
  description: 'TC Chart 기반 실시간 알고리즘 트레이딩 시그널 서비스',
  applicationName: 'TradingCore',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    title: 'TradingCore',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#020713',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/" aria-label="TradingCore 홈">
              {/* Legacy text logo backup:
              <span className="brand-mark" aria-hidden="true">TC</span>
              <span className="brand-wordmark">
                <strong>TradingCore</strong>
                <small>Signal Operations</small>
              </span>
              */}
              <img
                src="/images/TC-main-logo.png"
                alt="TradingCore"
                style={{ height: '34px', width: 'auto', display: 'block', objectFit: 'contain' }}
              />
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/">홈</Link>
              <Link href="/chart" aria-label="TC Chart 페이지">TC차트</Link>
              <Link href="/#landing-plans">구독</Link>
              <Link href="/support">고객센터</Link>
              <ProfileNavLink />
              <NotificationNavLink />
              <AdminNavLink />
            </nav>
            <SessionNav />
            <MobileNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
