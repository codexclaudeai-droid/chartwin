import type { NextRequest } from 'next/server.js';
import { NextResponse } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartAccessSnapshot,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  try {
    const access = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return getAsyncChartAccessSnapshot(repository, actor.id);
    });

    if (!access.fullChart) {
      return NextResponse.json({
        ok: false,
        message: '구독 승인 후 이용 가능',
        access,
      }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      ...access,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'chart access unavailable',
    }, { status: 401 });
  }
}
