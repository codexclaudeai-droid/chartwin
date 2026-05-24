import type { NextRequest } from 'next/server.js';
import { NextResponse } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartAccessSnapshot,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  const result = await persistence.runRead(async (repository) => {
    let userId = request.nextUrl.searchParams.get('userId') || 'user_member';
    try {
      userId = (await getActorFromAsyncRequest(repository, request, new Date().toISOString())).id;
    } catch {
      // Keep the mock preview fallback until real auth persistence is wired.
    }

    return {
      access: await getAsyncChartAccessSnapshot(repository, userId),
      subscription: await repository.getSubscriptionByUserId(userId),
    };
  });

  return NextResponse.json(result);
}
