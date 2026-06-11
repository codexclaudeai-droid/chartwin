import {
  getAsyncChartServicePersistence,
  sendAsyncTelegramProfileTestMessage,
} from '../../../../src/server/chart-service/index.ts';
import {
  requireSignalSuperAdmin,
  signalAdminJson,
} from '../../signal-admin-settings.ts';

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

  const profileId = String((body as { profileId?: unknown }).profileId || '').trim();
  if (!profileId) return signalAdminJson({ ok: false, message: 'profile id required' }, { status: 400 });

  try {
    const persistence = getAsyncChartServicePersistence();
    const profile = await persistence.runMutation(async (repository) => (
      await sendAsyncTelegramProfileTestMessage(repository, profileId)
    ));
    return signalAdminJson({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    return signalAdminJson({ ok: false, message }, { status: 400 });
  }
}
