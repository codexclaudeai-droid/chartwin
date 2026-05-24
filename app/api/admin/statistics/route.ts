import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAsyncAdminStatisticsSummary,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const statistics = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(actor);
      return getAsyncAdminStatisticsSummary(repository);
    });
    return NextResponse.json({
      ok: true,
      statistics,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: 401 });
  }
}
