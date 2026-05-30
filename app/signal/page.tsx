import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertSuperAdminActor } from '../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
} from '../../src/server/chart-service/index.ts';
import { SignalAdminPanel } from './signal-admin-panel';

export const dynamic = 'force-dynamic';

export default async function SignalPage() {
  const requestHeaders = await headers();
  const persistence = getAsyncChartServicePersistence();

  try {
    await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(
        repository,
        { headers: new Headers({ cookie: requestHeaders.get('cookie') ?? '' }) },
        new Date().toISOString(),
      );
      assertSuperAdminActor(actor);
    });
  } catch {
    redirect('/login?redirect=/signal');
  }

  return (
    <main className="signal-admin-page">
      <div className="signal-admin-hero">
        <span>TRADINGCORE SIGNAL</span>
        <h1>전략시그널 관리</h1>
        <p>슈퍼관리자 권한으로 종목 노출, 웹훅 수신, 사용자용 전략 표시를 관리합니다.</p>
      </div>
      <SignalAdminPanel />
    </main>
  );
}
