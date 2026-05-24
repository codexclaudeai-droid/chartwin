import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartAccessSnapshot,
  getAsyncChartServicePersistence,
  parseSessionCookie,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  if (!sessionId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      const user = await repository.getUserById(actor.id);
      return {
        actor,
        user,
        access: await getAsyncChartAccessSnapshot(repository, actor.id),
      };
    });
    return NextResponse.json({
      authenticated: true,
      actor: result.actor,
      user: result.user ? {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        accountStatus: result.user.accountStatus,
      } : null,
      access: result.access,
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      message: error instanceof Error ? error.message : 'invalid session',
    }, { status: 401 });
  }
}
