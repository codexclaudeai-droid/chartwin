import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAsyncAdminAuditLogEntries,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const result = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(actor);
      return {
        auditLogs: await repository.listAuditLogs(),
        entries: await getAsyncAdminAuditLogEntries(repository),
      };
    });
    return NextResponse.json({
      ok: true,
      auditLogs: result.auditLogs,
      entries: result.entries,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: 401 });
  }
}
