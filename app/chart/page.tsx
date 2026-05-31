import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getActorFromAsyncRequest,
  getAsyncChartAccessSnapshot,
  getAsyncChartServicePersistence,
} from '../../src/server/chart-service/index.ts';
import { FreeTrialRequestButton } from '../shared/free-trial-request-button';
import { ChartRuntime } from './chart-runtime';

export const dynamic = 'force-dynamic';

export default async function ChartPage() {
  const requestHeaders = await headers();
  const persistence = getAsyncChartServicePersistence();

  try {
    const access = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(
        repository,
        { headers: new Headers({ cookie: requestHeaders.get('cookie') ?? '' }) },
        new Date().toISOString(),
      );
      return getAsyncChartAccessSnapshot(repository, actor.id);
    });

    if (access.fullChart) {
      return <ChartRuntime accessVerified />;
    }

    return (
      <main className="chart-runtime-page chart-runtime-blocked" aria-label="TC Chart 접근 제한">
        <section className="chart-access-gate" role="status">
          <span className="eyebrow">TC Chart Access</span>
          <h1>차트 이용 권한이 필요합니다</h1>
          <p>구독 승인 후 TC Chart를 이용할 수 있습니다.</p>
          <div className="chart-access-actions">
            <a className="button" href="/pricing">구독하기</a>
            <FreeTrialRequestButton className="button secondary">무료체험 신청</FreeTrialRequestButton>
          </div>
        </section>
      </main>
    );
  } catch {
    redirect('/login?redirect=/chart');
  }
}
