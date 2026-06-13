import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ChartAccessPreview } from './chart/chart-access-preview';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
} from '../src/server/chart-service/index.ts';

export const metadata: Metadata = {
  title: 'TradingCore | Intro',
  description: 'TradingCore 메인 서비스로 이동하기 전 인트로 화면입니다.',
};

export const dynamic = 'force-dynamic';

export default async function IntroPage() {
  const requestHeaders = await headers();
  const persistence = getAsyncChartServicePersistence();
  let hasActiveSession = false;

  try {
    await persistence.runRead((repository) => getActorFromAsyncRequest(
      repository,
      { headers: new Headers({ cookie: requestHeaders.get('cookie') ?? '' }) },
      new Date().toISOString(),
    ));
    hasActiveSession = true;
  } catch {
    // Guests should see the intro. Invalid or expired sessions are ignored here.
  }

  if (hasActiveSession) redirect('/main');

  return (
    <ChartAccessPreview
      mode="landing-entry"
      mainHref="/main"
      loginHref="/login?redirect=/main"
    />
  );
}
