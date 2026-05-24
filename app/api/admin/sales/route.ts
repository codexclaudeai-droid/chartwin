import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncAdminSalesManagementSummary,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  updateAsyncAdminSalesCommissionPercent,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  const searchParams = new URL(request.url).searchParams;

  try {
    const summary = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return getAsyncAdminSalesManagementSummary(repository, {
        salespersonId: searchParams.get('salespersonId'),
        query: searchParams.get('query'),
        from: searchParams.get('from'),
        to: searchParams.get('to'),
      });
    });

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'sales summary unavailable',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const summary = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      await updateAsyncAdminSalesCommissionPercent(repository, {
        admin,
        salespersonId: String(body.salespersonId || ''),
        commissionPercent: Number(body.commissionPercent),
        updatedAt: new Date().toISOString(),
      });
      return getAsyncAdminSalesManagementSummary(repository, {
        salespersonId: String(body.salespersonId || ''),
      });
    });

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'sales commission update failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
