import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor } from '../../../../../src/domain/chart-service/index.ts';
import type { UserAccountStatus, UserRole } from '../../../../../src/domain/chart-service/index.ts';
import {
  assertSameOriginMutationRequest,
  getActorFromAsyncRequest,
  getAsyncAdminUserDetail,
  getAsyncChartServicePersistence,
  getAdminMutationErrorStatus,
  guardMutationRequest,
  updateAsyncAdminUserAccountStatus,
  updateAsyncAdminUserRole,
} from '../../../../../src/server/chart-service/index.ts';

const ALLOWED_ROLES: UserRole[] = [
  'member',
  'trial',
  'subscriber',
  'salesperson',
  'admin',
  'super_admin',
];

const ALLOWED_ACCOUNT_STATUSES: UserAccountStatus[] = ['active', 'suspended'];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const persistence = getAsyncChartServicePersistence();
  let userId;
  try {
    const detail = await persistence.runRead(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      userId = (await context.params).id;
      return getAsyncAdminUserDetail(repository, userId as string);
    });
    return NextResponse.json({
      ok: true,
      detail,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'user detail unavailable',
    }, { status: userId ? 404 : 401 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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
  const role = normalizeRole(body.role);
  const accountStatus = normalizeAccountStatus(body.accountStatus);
  if (!role && !accountStatus) {
    return NextResponse.json({
      ok: false,
      message: 'Invalid role or account status',
    }, { status: 400 });
  }

  const persistence = getAsyncChartServicePersistence();
  try {
    const { id } = await context.params;
    const detail = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      return accountStatus
        ? updateAsyncAdminUserAccountStatus(repository, {
          admin,
          userId: id,
          accountStatus,
          reason: String(body.reason || ''),
        })
        : updateAsyncAdminUserRole(repository, {
          admin,
          userId: id,
          role: role as UserRole,
        });
    });
    return NextResponse.json({
      ok: true,
      detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'user update failed';
    return NextResponse.json({
      ok: false,
      message,
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

function normalizeRole(value: unknown): UserRole | null {
  return ALLOWED_ROLES.includes(value as UserRole) ? value as UserRole : null;
}

function normalizeAccountStatus(value: unknown): UserAccountStatus | null {
  return ALLOWED_ACCOUNT_STATUSES.includes(value as UserAccountStatus) ? value as UserAccountStatus : null;
}
