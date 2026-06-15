import {
  readSignalAdminSettings,
  requireSignalSuperAdmin,
  signalAdminJson,
  toStrategiesResponse,
  updateSignalAdminSettings,
} from '../signal-admin-settings.ts';

export async function GET() {
  try {
    return signalAdminJson(toStrategiesResponse(await readSignalAdminSettings()));
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
    await requireSignalSuperAdmin(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unauthorized';
    return signalAdminJson({ ok: false, message }, { status: message.includes('Super admin') ? 403 : 401 });
  }

  try {
    const settings = await updateSignalAdminSettings({
      hiddenStrategies: (body as { hidden?: unknown }).hidden as string[],
      mgmtVisible: (body as { mgmtVisible?: unknown }).mgmtVisible === true,
      selectedStrategyId: String((body as { selectedStrategyId?: unknown }).selectedStrategyId || ''),
    });

    return signalAdminJson(toStrategiesResponse(settings));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'save failed';
    return signalAdminJson({ ok: false, message }, { status: 500 });
  }
}
