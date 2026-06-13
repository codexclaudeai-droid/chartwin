import Link from 'next/link';

type SiteFooterProps = Readonly<{
  className?: string;
}>;

export function SiteFooter({ className = '' }: SiteFooterProps) {
  const footerClassName = ['landing-footer', className].filter(Boolean).join(' ');

  return (
    <footer className={footerClassName} aria-label="서비스 하단 고정">
      <div className="landing-footer-grid">
        <div>
          <img className="landing-footer-logo" src="/images/TC-main-logo.png" alt="TradingCore" />
          <p>TC Chart, 유료 시그널, 수동 승인형 구독 운영을 연결하는 차트 서비스입니다.</p>
          <small>© TradingCore. All rights reserved.</small>
        </div>
        <div className="landing-footer-links">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보보호정책</Link>
          <Link href="/support">고객센터</Link>
        </div>
      </div>
    </footer>
  );
}
