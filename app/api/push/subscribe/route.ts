import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  registerPushSubscriptionForUserAsync,
  type BrowserPushSubscriptionInput,
} from '../../../../src/server/chart-service/index.ts';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const subscription = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return registerPushSubscriptionForUserAsync(repository, {
        actor,
        subscription: readSubscriptionBody(body),
        userAgent: request.headers.get('user-agent'),
      });
    });

    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'push subscription failed',
    }, { status: 401 });
  }
}

function readSubscriptionBody(body: unknown): BrowserPushSubscriptionInput {
  if (!body || typeof body !== 'object' || !('subscription' in body)) {
    throw new Error('Missing push subscription');
  }
  return (body as { subscription: BrowserPushSubscriptionInput }).subscription;
}
