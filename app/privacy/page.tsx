import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAsyncChartServicePersistence,
  getAsyncWebInfoSettingsForDisplay,
} from '../../src/server/chart-service/index.ts';

export const metadata: Metadata = {
  title: '개인정보보호정책 | TradingCore',
  description: 'TradingCore 개인정보 수집 및 처리 방침을 확인하세요.',
};

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const persistence = getAsyncChartServicePersistence();
  const webInfoSettings = await persistence.runRead((repository) => (
    getAsyncWebInfoSettingsForDisplay(repository)
  ));

  return (
    <main className="page legal-page">
      <section className="legal-page-hero">
        <span className="eyebrow">Privacy</span>
        <h1>개인정보보호정책</h1>
        <p className="lede">
          TradingCore가 회원가입, 구독 신청, 고객센터 응대를 위해 처리하는 개인정보 기준을 안내합니다.
        </p>
      </section>

      <section className="legal-document" aria-label="개인정보보호정책 본문">
        {renderPolicyContent(webInfoSettings.privacyContent)}
      </section>

      <nav className="legal-page-links" aria-label="관련 링크">
        <Link className="text-link compact" href="/terms">이용약관</Link>
        <Link className="text-link compact" href="/support">고객센터</Link>
      </nav>
    </main>
  );
}

function renderPolicyContent(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => (
      <p key={paragraph}>{paragraph}</p>
    ));
}
