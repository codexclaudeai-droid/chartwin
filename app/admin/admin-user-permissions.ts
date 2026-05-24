import type { UserAccountStatus, UserRole } from '../../src/domain/chart-service/index.ts';

const ADMIN_ROLES = new Set<string>(['admin', 'super_admin']);

type ActorPermissionInput = {
  actorRole: string | null | undefined;
};

type RolePermissionInput = ActorPermissionInput & {
  targetRole: string | null | undefined;
  nextRole: string | null | undefined;
};

type AccountStatusPermissionInput = ActorPermissionInput & {
  actorId: string | null | undefined;
  targetUserId: string | null | undefined;
  targetRole: string | null | undefined;
  nextAccountStatus: UserAccountStatus;
};

export function canChangeAdminUserRole(input: RolePermissionInput): boolean {
  if (!isAdminActor(input.actorRole)) return false;
  if (input.actorRole === 'super_admin') return true;
  return !requiresSuperAdmin(input.targetRole) && !requiresSuperAdmin(input.nextRole);
}

export function canChangeAdminUserAccountStatus(input: AccountStatusPermissionInput): boolean {
  if (!isAdminActor(input.actorRole)) return false;
  if (input.actorId === input.targetUserId && input.nextAccountStatus === 'suspended') return false;
  if (input.actorRole === 'super_admin') return true;
  return !requiresSuperAdmin(input.targetRole);
}

export function getAdminUserPermissionNotice(input: RolePermissionInput & {
  actorId?: string | null;
  targetUserId?: string | null;
}): string | null {
  if (!isAdminActor(input.actorRole)) {
    return '관리자 권한 확인이 필요합니다.';
  }
  if (input.actorId && input.actorId === input.targetUserId) {
    return '자기 자신의 계정 정지는 허용되지 않습니다.';
  }
  if (input.actorRole !== 'super_admin' && (requiresSuperAdmin(input.targetRole) || requiresSuperAdmin(input.nextRole))) {
    return '관리자 계정 수정과 관리자 권한 부여는 슈퍼 관리자만 가능합니다.';
  }
  return null;
}

export function getAdminUserAccountStatusPermissionNotice(input: AccountStatusPermissionInput): string | null {
  if (!isAdminActor(input.actorRole)) {
    return '관리자 권한 확인이 필요합니다.';
  }
  if (input.actorId === input.targetUserId && input.nextAccountStatus === 'suspended') {
    return '자기 자신의 계정 정지는 허용되지 않습니다.';
  }
  if (input.actorRole !== 'super_admin' && requiresSuperAdmin(input.targetRole)) {
    return '관리자 계정 상태 변경은 슈퍼 관리자만 가능합니다.';
  }
  return null;
}

export function getAssignableUserRoles(actorRole: string | null | undefined): UserRole[] {
  const normalRoles: UserRole[] = ['member', 'trial', 'subscriber', 'salesperson'];
  if (actorRole === 'super_admin') return [...normalRoles, 'admin', 'super_admin'];
  return normalRoles;
}

function isAdminActor(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

function requiresSuperAdmin(role: string | null | undefined): boolean {
  return ADMIN_ROLES.has(role || '');
}
