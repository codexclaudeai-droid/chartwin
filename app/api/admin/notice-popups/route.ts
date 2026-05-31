import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  sortNoticePopups,
  upsertAsyncNoticePopup,
  deleteAsyncNoticePopup,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const popups = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return sortNoticePopups(await repository.listNoticePopups());
    });

    return NextResponse.json({ ok: true, popups });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'notice popups unavailable',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

export async function POST(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const popup = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return upsertAsyncNoticePopup(repository, {
        admin,
        popup: {
          id: typeof body.id === 'string' && body.id ? body.id : undefined,
          title: typeof body.title === 'string' ? body.title : '',
          bodyHtml: typeof body.bodyHtml === 'string' ? body.bodyHtml : '',
          isActive: Boolean(body.isActive),
          sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
          startAt: normalizeOptionalDateString(body.startAt),
          endAt: normalizeOptionalDateString(body.endAt),
        },
        updatedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, popup });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'notice popup save failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

function normalizeOptionalDateString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}

export async function DELETE(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const deletedId = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return deleteAsyncNoticePopup(repository, {
        admin,
        popupId: typeof body.id === 'string' ? body.id : '',
      });
    });

    return NextResponse.json({ ok: true, deletedId });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'notice popup delete failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
