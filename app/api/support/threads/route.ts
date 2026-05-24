import { NextResponse, type NextRequest } from 'next/server.js';
import {
  assertSameOriginMutationRequest,
  createAsyncSupportThread,
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  getAuthenticatedMutationErrorStatus,
  guardMutationRequest,
  listAsyncVisibleSupportThreads,
} from '../../../../src/server/chart-service/index.ts';
import type { SupportCategory, SupportVisibility } from '../../../../src/domain/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  const threads = await persistence.runRead(async (repository) => {
    let actor = null;
    try {
      actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
    } catch {
      actor = null;
    }

    return listAsyncVisibleSupportThreads(repository, { actor });
  });

  return NextResponse.json({ ok: true, threads });
}

export async function POST(request: NextRequest) {
  const mutationGuard = guardMutationRequest(request);
  if (mutationGuard) return mutationGuard;

  try {
    assertSameOriginMutationRequest(request);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'cross-site request blocked',
    }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runMutation(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      return createAsyncSupportThread(repository, {
        actor,
        category: normalizeCategory(body.category),
        title: String(body.title || ''),
        body: String(body.body || ''),
        visibility: normalizeVisibility(body.visibility),
        createdAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'support request failed',
    }, { status: getAuthenticatedMutationErrorStatus(error) });
  }
}

function normalizeCategory(value: unknown): SupportCategory {
  const allowed: SupportCategory[] = ['deposit', 'cancel', 'partnership', 'usage', 'signal', 'general'];
  return allowed.includes(value as SupportCategory) ? value as SupportCategory : 'general';
}

function normalizeVisibility(value: unknown): SupportVisibility {
  return value === 'public' ? 'public' : 'private';
}
