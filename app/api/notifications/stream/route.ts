import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';
import { createNotificationRealtimeStream } from '../../../../src/server/chart-service/notification-realtime.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const actor = await persistence.runRead(async (repository) => (
      await getActorFromAsyncRequest(repository, request, new Date().toISOString())
    ));
    const stream = createNotificationRealtimeStream(actor.id, { signal: request.signal });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: 401 });
  }
}
