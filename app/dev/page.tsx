import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertAdminActor } from '../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
} from '../../src/server/chart-service/index.ts';
import { ChartRuntime } from '../chart/chart-runtime';
import { DevStrategyParamsPanel } from './strategy-params-panel';

export const dynamic = 'force-dynamic';

export default async function DevChartPage() {
  const requestHeaders = await headers();
  const persistence = getAsyncChartServicePersistence();

  try {
    await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(
        repository,
        { headers: new Headers({ cookie: requestHeaders.get('cookie') ?? '' }) },
        new Date().toISOString(),
      );
      assertAdminActor(actor);
    });
  } catch {
    redirect('/login?redirect=/dev');
  }

  return (
    <>
      <DevStrategyParamsPanel />
      <ChartRuntime accessVerified />
    </>
  );
}
