import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  notifyUserPushSubscriptions,
} from '../../../../src/server/chart-service/index.ts';
import type { NotificationRecord } from '../../../../src/domain/chart-service/index.ts';

export async function POST(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const result = await persistence.runMutation(async (repository) => {
      const createdAt = new Date().toISOString();
      const actor = await getActorFromAsyncRequest(repository, request, createdAt);
      const notification: NotificationRecord = {
        id: await repository.nextId('notification'),
        userId: actor.id,
        category: 'notice',
        title: '푸시 알림 테스트',
        body: '브라우저 푸시 알림 테스트입니다.',
        linkUrl: '/notifications?tab=unread',
        readAt: null,
        archivedAt: null,
        createdAt,
      };

      await repository.saveNotification(notification);
      const delivery = await notifyUserPushSubscriptions(repository, notification);
      return { notification, delivery };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'push test failed',
    }, { status: 401 });
  }
}
