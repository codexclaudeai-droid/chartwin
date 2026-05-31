import { headers } from 'next/headers';
import {
  getActorFromAsyncRequest,
  getAsyncChartAccessSnapshot,
  getAsyncChartServicePersistence,
} from '../../src/server/chart-service/index.ts';
import { ChartAccessPreview } from './chart-access-preview';
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

    return <ChartAccessPreview audience="member" />;
  } catch {
    return <ChartAccessPreview audience="guest" />;
  }
}
