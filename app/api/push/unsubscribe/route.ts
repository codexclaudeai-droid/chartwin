import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  unregisterPushSubscriptionForUserAsync,
} from '../../../../src/server/chart-service/index.ts';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const removed = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return unregisterPushSubscriptionForUserAsync(repository, {
        actor,
        endpoint: readEndpointBody(body),
      });
    });

    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'push unsubscribe failed',
    }, { status: 401 });
  }
}

function readEndpointBody(body: unknown): string {
  if (!body || typeof body !== 'object' || typeof (body as { endpoint?: unknown }).endpoint !== 'string') {
    throw new Error('Missing push endpoint');
  }
  return (body as { endpoint: string }).endpoint;
}
