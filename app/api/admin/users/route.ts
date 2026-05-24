import { NextResponse, type NextRequest } from 'next/server.js';
import { assertAdminActor, type UserAccountStatus, type UserRole } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAsyncAdminUserDirectory,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';

const ALLOWED_ROLES: Array<UserRole | 'all'> = [
  'all',
  'member',
  'trial',
  'subscriber',
  'salesperson',
  'admin',
  'super_admin',
];

const ALLOWED_ACCOUNT_STATUSES: Array<UserAccountStatus | 'all'> = [
  'all',
  'active',
  'suspended',
];

export async function GET(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  const url = new URL(request.url);
  const role = normalizeRole(url.searchParams.get('role'));
  const accountStatus = normalizeAccountStatus(url.searchParams.get('accountStatus'));
  const query = url.searchParams.get('query') ?? '';

  try {
    const users = await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertAdminActor(actor);
      return getAsyncAdminUserDirectory(repository, { query, role, accountStatus });
    });
    return NextResponse.json({
      ok: true,
      users,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: 401 });
  }
}

function normalizeRole(value: string | null): UserRole | 'all' {
  return ALLOWED_ROLES.includes(value as UserRole | 'all')
    ? value as UserRole | 'all'
    : 'all';
}

function normalizeAccountStatus(value: string | null): UserAccountStatus | 'all' {
  return ALLOWED_ACCOUNT_STATUSES.includes(value as UserAccountStatus | 'all')
    ? value as UserAccountStatus | 'all'
    : 'all';
}
