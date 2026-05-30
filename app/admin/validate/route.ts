import {
  requireSignalSuperAdmin,
  signalAdminJson,
} from '../signal-admin-settings.ts';

export async function POST(request: Request) {
  try {
    await requireSignalSuperAdmin(request);
    return signalAdminJson({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unauthorized';
    return signalAdminJson({ ok: false, message }, { status: message.includes('Super admin') ? 403 : 401 });
  }
}
