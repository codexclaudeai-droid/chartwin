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
  deleteAsyncAdminUserAccount,
  purgeAsyncUnverifiedUserAccount,
  updateAsyncAdminUserAccountStatus,
  updateAsyncAdminUserEmail,
  updateAsyncAdminUserFreeTrialAllowance,
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
  const email = normalizeEmailInput(body.email);
  const freeTrialAllowanceCount = normalizeFreeTrialAllowanceCount(body.freeTrialAllowanceCount);
  if (!role && !accountStatus && !email && freeTrialAllowanceCount === null) {
    return NextResponse.json({
      ok: false,
      message: 'Invalid role, account status, email, or free trial allowance',
    }, { status: 400 });
  }

  const persistence = getAsyncChartServicePersistence();
  try {
    const { id } = await context.params;
    const detail = await persistence.runMutation(async (repository) => {
      const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(admin);
      if (email) {
        return updateAsyncAdminUserEmail(repository, {
          admin,
          userId: id,
          email,
        });
      }
      if (freeTrialAllowanceCount !== null) {
        return updateAsyncAdminUserFreeTrialAllowance(repository, {
          admin,
          userId: id,
          remainingCount: freeTrialAllowanceCount,
          note: typeof body.freeTrialAllowanceNote === 'string' ? body.freeTrialAllowanceNote : '',
          updatedAt: new Date().toISOString(),
        });
      }
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

export async function DELETE(request: NextRequest, context: RouteContext) {
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

  const persistence = getAsyncChartServicePersistence();
  try {
    const { id } = await context.params;
    const result = await runUserDeleteMutationWithDeadlockRetry(persistence, request, id);
    return NextResponse.json({
      ok: true,
      deletedUserId: result.user.id,
      deletedSessionCount: result.deletedSessionCount,
      purged: Boolean('purged' in result && result.purged),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'user delete failed';
    return NextResponse.json({
      ok: false,
      message,
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

function normalizeRole(value: unknown): UserRole | null {
  return ALLOWED_ROLES.includes(value as UserRole) ? value as UserRole : null;
}

async function runUserDeleteMutationWithDeadlockRetry(
  persistence: ReturnType<typeof getAsyncChartServicePersistence>,
  request: NextRequest,
  id: string,
) {
  try {
    return await runUserDeleteMutation(persistence, request, id);
  } catch (error) {
    if (!isPostgresDeadlockError(error)) throw error;
    return await runUserDeleteMutation(persistence, request, id);
  }
}

async function runUserDeleteMutation(
  persistence: ReturnType<typeof getAsyncChartServicePersistence>,
  request: NextRequest,
  id: string,
) {
  return await persistence.runMutation(async (repository) => {
    const admin = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
    const user = await repository.getUserById(id);
    if (user) {
      try {
        const purgeResult = await purgeAsyncUnverifiedUserAccount(repository, {
          admin,
          email: user.email,
          purgedAt: new Date().toISOString(),
        });
        return {
          user: purgeResult.user,
          deletedSessionCount: purgeResult.deletedSessionCount,
          purged: true,
        };
      } catch (error) {
        if (!String(error instanceof Error ? error.message : error).includes('verified')) {
          throw error;
        }
      }
    }
    return deleteAsyncAdminUserAccount(repository, {
      admin,
      userId: id,
      deletedAt: new Date().toISOString(),
    });
  });
}

function isPostgresDeadlockError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return String(error).toLowerCase().includes('deadlock detected');
  }
  const record = error as Record<string, unknown>;
  return record.code === '40P01' ||
    String(record.message ?? '').toLowerCase().includes('deadlock detected');
}

function normalizeAccountStatus(value: unknown): UserAccountStatus | null {
  return ALLOWED_ACCOUNT_STATUSES.includes(value as UserAccountStatus) ? value as UserAccountStatus : null;
}

function normalizeEmailInput(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeFreeTrialAllowanceCount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  return Math.min(999, Math.max(0, Math.round(count)));
}
