import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canChangeAdminUserAccountStatus,
  canChangeAdminUserRole,
  getAdminUserAccountStatusPermissionNotice,
  getAdminUserPermissionNotice,
  getAssignableUserRoles,
} from '../app/admin/admin-user-permissions.ts';

test('normal admins can change non-admin member roles but cannot grant admin roles', () => {
  assert.equal(canChangeAdminUserRole({
    actorRole: 'admin',
    targetRole: 'member',
    nextRole: 'subscriber',
  }), true);
  assert.equal(canChangeAdminUserRole({
    actorRole: 'admin',
    targetRole: 'member',
    nextRole: 'admin',
  }), false);
});

test('normal admins cannot modify admin accounts', () => {
  assert.equal(canChangeAdminUserRole({
    actorRole: 'admin',
    targetRole: 'admin',
    nextRole: 'member',
  }), false);
  assert.equal(canChangeAdminUserAccountStatus({
    actorId: 'admin_1',
    actorRole: 'admin',
    targetUserId: 'super_1',
    targetRole: 'super_admin',
    nextAccountStatus: 'suspended',
  }), false);
});

test('super admins can change admin roles and account status', () => {
  assert.equal(canChangeAdminUserRole({
    actorRole: 'super_admin',
    targetRole: 'admin',
    nextRole: 'member',
  }), true);
  assert.equal(canChangeAdminUserAccountStatus({
    actorId: 'super_1',
    actorRole: 'super_admin',
    targetUserId: 'admin_1',
    targetRole: 'admin',
    nextAccountStatus: 'suspended',
  }), true);
});

test('admins cannot suspend their own account from the UI', () => {
  assert.equal(canChangeAdminUserAccountStatus({
    actorId: 'admin_1',
    actorRole: 'admin',
    targetUserId: 'admin_1',
    targetRole: 'admin',
    nextAccountStatus: 'suspended',
  }), false);
});

test('permission notice explains why sensitive controls are locked', () => {
  assert.match(getAdminUserPermissionNotice({
    actorId: 'admin_1',
    actorRole: 'admin',
    targetUserId: 'super_1',
    targetRole: 'super_admin',
    nextRole: 'member',
  }), /슈퍼 관리자/);
});

test('assignable roles hide admin roles from normal admins', () => {
  assert.deepEqual(getAssignableUserRoles('admin'), ['member', 'trial', 'subscriber', 'salesperson']);
  assert.deepEqual(getAssignableUserRoles('super_admin'), [
    'member',
    'trial',
    'subscriber',
    'salesperson',
    'admin',
    'super_admin',
  ]);
});

test('account status notice explains self-suspension and admin-account locks', () => {
  assert.match(getAdminUserAccountStatusPermissionNotice({
    actorId: 'admin_1',
    actorRole: 'admin',
    targetUserId: 'admin_1',
    targetRole: 'admin',
    nextAccountStatus: 'suspended',
  }), /자기 자신/);
  assert.match(getAdminUserAccountStatusPermissionNotice({
    actorId: 'admin_1',
    actorRole: 'admin',
    targetUserId: 'super_1',
    targetRole: 'super_admin',
    nextAccountStatus: 'active',
  }), /슈퍼 관리자/);
});
