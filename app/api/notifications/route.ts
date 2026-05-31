import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAsyncNotificationSummaryForUser,
  listAsyncNotificationsForUser,
} from '../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  const summaryOnly = request.nextUrl.searchParams.get('summary') === '1';
  try {
    const result = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      if (summaryOnly) {
        const summary = await getAsyncNotificationSummaryForUser(repository, { actor });
        return { notifications: null, summary };
      }
      const notifications = await listAsyncNotificationsForUser(repository, { actor });
      const summary = {
        totalCount: notifications.length,
        unreadCount: notifications.filter((notification) => !notification.readAt).length,
      };
      return { notifications, summary };
    });

    return NextResponse.json({
      ok: true,
      ...(summaryOnly ? {} : { notifications: result.notifications }),
      summary: result.summary,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: 401 });
  }
}
