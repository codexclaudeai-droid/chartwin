import type { Metadata } from 'next';
import { ChartAccessPreview } from './chart/chart-access-preview';

export const metadata: Metadata = {
  title: 'TradingCore | Intro',
  description: 'TradingCore 메인 서비스로 이동하기 전 인트로 화면입니다.',
};

export default function IntroPage() {
  return (
    <ChartAccessPreview
      mode="landing-entry"
      mainHref="/main"
      loginHref="/login"
    />
  );
}
