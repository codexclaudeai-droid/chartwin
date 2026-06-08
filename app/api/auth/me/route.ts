import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  parseSessionCookie,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  if (!sessionId) {
    return createSignedOutAuthResponse();
  }

  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      const user = await repository.getUserById(actor.id);
      return {
        actor,
        user,
      };
    });
    return NextResponse.json({
      authenticated: true,
      actor: result.actor,
      user: result.user ? {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        profileImageDataUrl: result.user.profileImageDataUrl,
        role: result.user.role,
        accountStatus: result.user.accountStatus,
      } : null,
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      message: error instanceof Error ? error.message : 'invalid session',
      user: null,
    });
  }
}

function createSignedOutAuthResponse() {
  return NextResponse.json({
    authenticated: false,
    user: null,
  });
}
