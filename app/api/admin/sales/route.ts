import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  assignAsyncAdminSalespersonToTeam,
  createAsyncAdminSalesTeam,
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncAdminSalesManagementSummary,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  updateAsyncAdminCustomerSalesperson,
  updateAsyncAdminSalesCommissionPercent,
  updateAsyncAdminSalesTeamCommissionPercent,
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
        teamId: searchParams.get('teamId'),
        query: searchParams.get('query'),
        customerQuery: searchParams.get('customerQuery'),
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
      if (body.action === 'assignCustomerSalesperson') {
        await updateAsyncAdminCustomerSalesperson(repository, {
          admin,
          customerId: String(body.customerId || ''),
          salespersonId: body.salespersonId ? String(body.salespersonId) : null,
        });
        return getAsyncAdminSalesManagementSummary(repository, {
          salespersonId: body.salespersonId ? String(body.salespersonId) : null,
          customerQuery: typeof body.customerQuery === 'string' ? body.customerQuery : null,
        });
      }
      if (body.action === 'createSalesTeam') {
        const team = await createAsyncAdminSalesTeam(repository, {
          admin,
          name: String(body.teamName || ''),
          createdAt: new Date().toISOString(),
        });
        return getAsyncAdminSalesManagementSummary(repository, {
          teamId: team.id,
        });
      }
      if (body.action === 'assignSalespersonTeam') {
        await assignAsyncAdminSalespersonToTeam(repository, {
          admin,
          salespersonId: String(body.salespersonId || ''),
          teamId: String(body.teamId || ''),
          updatedAt: new Date().toISOString(),
        });
        return getAsyncAdminSalesManagementSummary(repository, {
          salespersonId: String(body.salespersonId || ''),
          teamId: String(body.teamId || ''),
        });
      }
      if (body.action === 'updateSalesTeamCommission') {
        await updateAsyncAdminSalesTeamCommissionPercent(repository, {
          admin,
          teamId: String(body.teamId || ''),
          commissionPercent: Number(body.commissionPercent),
          updatedAt: new Date().toISOString(),
        });
        return getAsyncAdminSalesManagementSummary(repository, {
          teamId: String(body.teamId || ''),
        });
      }

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
