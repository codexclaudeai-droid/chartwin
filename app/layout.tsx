import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { AdminNavLink } from './admin-nav-link';
import { MobileNav } from './mobile-nav';
import { NotificationNavLink } from './notification-nav-link';
import { NoticePopupViewer } from './notice-popup-viewer';
import { SessionNav } from './session-nav';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.CF_PAGES_URL || 'http://localhost:3000';
const ethereumExtensionErrorGuardScript = `
(function () {
  function describeUnknown(value, depth, seen) {
    if (value == null) return String(value);
    var type = typeof value;
    if (type !== 'object' && type !== 'function') return String(value);
    if (depth > 2) return Object.prototype.toString.call(value);
    if (seen.indexOf(value) !== -1) return '[Circular]';
    seen.push(value);

    var parts = [];
    try { parts.push(Object.prototype.toString.call(value)); } catch {}
    try { parts.push(String(value)); } catch {}

    var keys = [];
    try { keys = Object.getOwnPropertyNames(value).slice(0, 20); } catch {}
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      try {
        var child = value[key];
        if (child == null || typeof child !== 'object') {
          parts.push(key + ':' + String(child));
        } else if (key === 'error' || key === 'reason' || key === 'cause') {
          parts.push(key + ':' + describeUnknown(child, depth + 1, seen));
        }
      } catch {}
    }

    return parts.join(' ');
  }

  function rememberIgnoredError(kind, detail) {
    var entry = {
      kind: kind,
      detail: String(detail || '').slice(0, 1200),
      at: new Date().toISOString()
    };
    window.__tcIgnoredExternalErrors = window.__tcIgnoredExternalErrors || [];
    window.__tcIgnoredExternalErrors.push(entry);
    if (window.__tcIgnoredExternalErrors.length > 10) {
      window.__tcIgnoredExternalErrors.shift();
    }
    console.warn('[TradingCore] ignored external browser extension error', entry);
  }

  function isExternalExtensionText(text) {
    return text.indexOf('chrome-extension://') !== -1
      || text.indexOf('moz-extension://') !== -1
      || text.indexOf('safari-web-extension://') !== -1
      || text.indexOf('mfgccjchihfkkindfppnaooecgfneiii') !== -1;
  }

  function isWalletExtensionNoise(text) {
    return text.indexOf('Cannot redefine property: ethereum') !== -1
      || text.indexOf('ethereum') !== -1
      || text.indexOf('inpage.js') !== -1
      || text.indexOf('mfgccjchihfkkindfppnaooecgfneiii') !== -1;
  }

  function rememberWalletExtensionSignal(detail) {
    window.__tcWalletExtensionSeen = {
      detail: String(detail || '').slice(0, 1200),
      at: Date.now()
    };
  }

  function hasRecentWalletExtensionSignal() {
    var seen = window.__tcWalletExtensionSeen;
    if (!seen) return false;
    return Date.now() - Number(seen.at || 0) < 5000;
  }

  function isLocalDevHost() {
    return /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(window.location.hostname);
  }

  function isOpaqueWalletObjectRejection(value, text) {
    if (!value || typeof value !== 'object') return false;
    if (!isLocalDevHost()) return false;
    var keys = [];
    try { keys = Object.getOwnPropertyNames(value); } catch {}
    return keys.length === 0
      && String(value) === '[object Object]'
      && text.indexOf('app/') === -1
      && (typeof window.ethereum !== 'undefined' || hasRecentWalletExtensionSignal());
  }

  function getOverlayText(node) {
    var text = '';
    try { text += node.textContent || ''; } catch {}
    try {
      if (node.shadowRoot) text += ' ' + (node.shadowRoot.textContent || '');
    } catch {}
    return text;
  }

  function shouldDismissExternalObjectOverlay(text) {
    if (!isLocalDevHost()) return false;
    if (text.indexOf('[object Object]') === -1) return false;
    if (text.indexOf('Runtime Error') === -1) return false;
    if (text.indexOf('coerceError') === -1 && text.indexOf('onUnhandledRejection') === -1) return false;
    if (text.indexOf('/src/') !== -1 || text.indexOf('src/') !== -1) return false;
    return true;
  }

  function hideOverlayNode(node, text) {
    rememberIgnoredError('next-dev-overlay', text);
    try {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
        return;
      }
    } catch {}
    try {
      if (node && node.style) node.style.display = 'none';
    } catch {}
  }

  function dismissExternalObjectDevOverlay() {
    if (!isLocalDevHost() || typeof document === 'undefined') return;
    var selectors = 'nextjs-portal,[data-nextjs-dialog-overlay],[data-nextjs-toast],[role="alert"],[role="dialog"]';
    var candidates = [];
    try { candidates = Array.prototype.slice.call(document.querySelectorAll(selectors)); } catch {}
    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = candidates[i];
      var text = getOverlayText(candidate);
      if (shouldDismissExternalObjectOverlay(text)) {
        hideOverlayNode(candidate, text);
        return;
      }
    }
    var body = document.body;
    if (!body) return;
    var children = [];
    try { children = Array.prototype.slice.call(body.children); } catch {}
    for (var j = 0; j < children.length; j += 1) {
      var child = children[j];
      var childText = getOverlayText(child);
      if (shouldDismissExternalObjectOverlay(childText)) {
        hideOverlayNode(child, childText);
        return;
      }
    }
  }

  function startExternalObjectOverlayDismissal() {
    if (!isLocalDevHost() || typeof document === 'undefined') return;
    var attempts = 0;
    var observer = null;
    var tick = function () {
      attempts += 1;
      dismissExternalObjectDevOverlay();
      if (attempts >= 40) {
        try { if (observer) observer.disconnect(); } catch {}
        try { window.clearInterval(timer); } catch {}
      }
    };
    var timer = window.setInterval(tick, 250);
    try {
      observer = new MutationObserver(function () {
        dismissExternalObjectDevOverlay();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
    tick();
  }

  function shouldIgnoreErrorEvent(event) {
    var detail = [
      event.message || '',
      event.filename || '',
      describeUnknown(event.error, 0, [])
    ].join(' ');
    if (isExternalExtensionText(detail) && isWalletExtensionNoise(detail)) {
      rememberWalletExtensionSignal(detail);
      return detail;
    }
    return '';
  }

  function shouldIgnoreUnhandledRejection(event) {
    var detail = describeUnknown(event.reason, 0, []);
    if (isExternalExtensionText(detail) && isWalletExtensionNoise(detail)) {
      rememberWalletExtensionSignal(detail);
      return detail;
    }
    if (isOpaqueWalletObjectRejection(event.reason, detail)) return detail || '[object Object]';
    return '';
  }

  window.addEventListener('error', function (event) {
    var ignoredDetail = shouldIgnoreErrorEvent(event);
    if (ignoredDetail) {
      event.preventDefault();
      event.stopImmediatePropagation();
      rememberIgnoredError('error', ignoredDetail);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var ignoredDetail = shouldIgnoreUnhandledRejection(event);
    if (ignoredDetail) {
      event.preventDefault();
      event.stopImmediatePropagation();
      rememberIgnoredError('unhandledrejection', ignoredDetail);
      dismissExternalObjectDevOverlay();
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExternalObjectOverlayDismissal, { once: true });
  } else {
    startExternalObjectOverlayDismissal();
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'TradingCore',
  description: 'TC Chart 기반 실시간 알고리즘 트레이딩 시그널 서비스',
  applicationName: 'TradingCore',
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'TradingCore',
    description: 'TC Chart 기반 실시간 알고리즘 트레이딩 시그널 서비스',
    siteName: 'TradingCore',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TradingCore',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradingCore',
    description: 'TC Chart 기반 실시간 알고리즘 트레이딩 시그널 서비스',
    images: ['/og-image.png'],
  },
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
      <head>
        <Script
          id="tc-extension-error-guard"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: ethereumExtensionErrorGuardScript }}
        />
      </head>
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
                className="brand-logo-image"
                src="/images/TC-main-logo.png"
                alt="TradingCore"
              />
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/">홈</Link>
              <Link href="/chart" aria-label="TC Chart 페이지">TC차트</Link>
              <Link href="/#landing-plans">구독플랜</Link>
              <Link href="/support">고객센터</Link>
              <AdminNavLink />
            </nav>
            <NotificationNavLink />
            <SessionNav />
            <MobileNav />
          </header>
          {children}
          <NoticePopupViewer />
        </div>
      </body>
    </html>
  );
}
