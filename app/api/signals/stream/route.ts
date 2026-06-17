import { NextResponse, type NextRequest } from 'next/server.js';
import {
  createSignalRealtimeStream,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  type SignalRealtimeFilters,
} from '../../../../src/server/chart-service/index.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    await persistence.runRead(async (repository) => (
      await getActorFromAsyncRequest(repository, request, new Date().toISOString())
    ));
    const stream = createSignalRealtimeStream(readSignalRealtimeFilters(request), { signal: request.signal });

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

function readSignalRealtimeFilters(request: NextRequest): SignalRealtimeFilters {
  const params = request.nextUrl.searchParams;
  return {
    strategyId: params.get('strategyId'),
    symbolId: params.get('symbolId'),
    timeframe: params.get('timeframe'),
  };
}
