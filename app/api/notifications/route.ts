import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAsyncNotificationSummaryForUser,
  listAsyncNotificationsForUser,
} from '../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      const [notifications, summary] = await Promise.all([
        listAsyncNotificationsForUser(repository, { actor }),
        getAsyncNotificationSummaryForUser(repository, { actor }),
      ]);
      return { notifications, summary };
    });

    return NextResponse.json({
      ok: true,
      notifications: result.notifications,
      summary: result.summary,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: 401 });
  }
}
