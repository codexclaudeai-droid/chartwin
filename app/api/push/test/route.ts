import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  notifyUserPushSubscriptions,
} from '../../../../src/server/chart-service/index.ts';
import {
  USER_ROLES,
  type Actor,
  type NotificationRecord,
} from '../../../../src/domain/chart-service/index.ts';

class PushTestForbiddenError extends Error {}

function isPushTestAllowed(actor: Actor): boolean {
  return actor.role === USER_ROLES.admin ||
    actor.role === USER_ROLES.superAdmin ||
    process.env.NODE_ENV !== 'production';
}

export async function POST(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const result = await persistence.runMutation(async (repository) => {
      const createdAt = new Date().toISOString();
      const actor = await getActorFromAsyncRequest(repository, request, createdAt);
      if (!isPushTestAllowed(actor)) {
        throw new PushTestForbiddenError('테스트 푸시 알림은 관리자 또는 개발 환경에서만 발송할 수 있습니다.');
      }

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
    }, { status: error instanceof PushTestForbiddenError ? 403 : 401 });
  }
}
