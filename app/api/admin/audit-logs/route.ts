import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAsyncAdminAuditLogEntries,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  const url = new URL(request.url);

  try {
    const entries = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(actor);
      return getAsyncAdminAuditLogEntries(repository, {
        action: url.searchParams.get('action') ?? '',
        targetType: url.searchParams.get('targetType') ?? '',
        targetId: url.searchParams.get('targetId') ?? '',
      });
    });
    return NextResponse.json({
      ok: true,
      entries,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: 401 });
  }
}
