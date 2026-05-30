import {
  readSignalAdminSettings,
  requireSignalSuperAdmin,
  signalAdminJson,
  toStrategiesResponse,
  updateSignalAdminSettings,
} from '../signal-admin-settings.ts';

export async function GET() {
  return signalAdminJson(toStrategiesResponse(await readSignalAdminSettings()));
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

  const settings = await updateSignalAdminSettings({
    hiddenStrategies: (body as { hidden?: unknown }).hidden as string[],
    mgmtVisible: (body as { mgmtVisible?: unknown }).mgmtVisible === true,
    selectedStrategyId: String((body as { selectedStrategyId?: unknown }).selectedStrategyId || ''),
  });

  return signalAdminJson(toStrategiesResponse(settings));
}
