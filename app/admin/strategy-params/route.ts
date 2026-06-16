import {
  readSignalAdminSettings,
  requireSignalAdmin,
  signalAdminJson,
  toStrategyParamsResponse,
  updateSignalAdminSettings,
} from '../signal-admin-settings.ts';

export async function GET() {
  try {
    return signalAdminJson(toStrategyParamsResponse(await readSignalAdminSettings()));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'load failed';
    return signalAdminJson({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return signalAdminJson({ ok: false, message: 'invalid json' }, { status: 400 });
  }
  try {
    await requireSignalAdmin(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unauthorized';
    return signalAdminJson({ ok: false, message }, { status: message.includes('Admin') ? 403 : 401 });
  }

  try {
    const settings = await updateSignalAdminSettings({
      strategyParams: (body as { strategyParams?: unknown }).strategyParams,
    });

    return signalAdminJson(toStrategyParamsResponse(settings));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'save failed';
    return signalAdminJson({ ok: false, message }, { status: 500 });
  }
}
