import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminAccessState } from '../app/admin/admin-access-model.ts';

test('admin access state asks guests to log in before rendering operations panels', () => {
  assert.equal(getAdminAccessState({ authenticated: false, role: null }), 'login_required');
  assert.equal(getAdminAccessState({ authenticated: true, role: null }), 'login_required');
});

test('admin access state blocks non-admin members with a clear forbidden state', () => {
  assert.equal(getAdminAccessState({ authenticated: true, role: 'member' }), 'forbidden');
  assert.equal(getAdminAccessState({ authenticated: true, role: 'subscriber' }), 'forbidden');
});

test('admin access state allows admin operators', () => {
  assert.equal(getAdminAccessState({ authenticated: true, role: 'admin' }), 'allowed');
  assert.equal(getAdminAccessState({ authenticated: true, role: 'super_admin' }), 'allowed');
});
