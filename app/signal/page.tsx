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
        <h1>시그널 정책 관리</h1>
        <p>슈퍼관리자 권한으로 차트전략, EA전략, 실제체결 기준을 전체 종목 또는 특정 종목별로 관리합니다.</p>
      </div>
      <SignalAdminPanel />
    </main>
  );
}
