import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
  guardMutationRequest,
  updateAsyncPublicBoardPosts,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();

  try {
    const posts = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return repository.listPublicBoardPosts();
    });

    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'public board unavailable',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();

  try {
    const posts = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return updateAsyncPublicBoardPosts(repository, {
        admin,
        posts: Array.isArray(body.posts) ? body.posts : [],
        updatedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'public board update failed',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}
