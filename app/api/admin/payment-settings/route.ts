import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
  getAsyncPaymentTransferSettingsForDisplay,
  guardMutationRequest,
  updateAsyncPaymentTransferSettings,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const settings = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return getAsyncPaymentTransferSettingsForDisplay(repository);
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'payment settings unavailable',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const settings = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return updateAsyncPaymentTransferSettings(repository, {
        admin,
        bankName: String(body.bankName || ''),
        bankAccountNumber: String(body.bankAccountNumber || ''),
        bankAccountHolder: String(body.bankAccountHolder || ''),
        bankLogoUrl: String(body.bankLogoUrl || ''),
        usdtAddress: String(body.usdtAddress || ''),
        usdtNetwork: String(body.usdtNetwork || ''),
        updatedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'payment settings update failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
