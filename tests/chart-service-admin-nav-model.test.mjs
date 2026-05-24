import assert from 'node:assert/strict';
import test from 'node:test';
import { canShowAdminNavigation } from '../app/admin-nav-model.ts';

test('admin navigation is visible only to admin operators', () => {
  assert.equal(canShowAdminNavigation('admin'), true);
  assert.equal(canShowAdminNavigation('super_admin'), true);
  assert.equal(canShowAdminNavigation('member'), false);
  assert.equal(canShowAdminNavigation('subscriber'), false);
  assert.equal(canShowAdminNavigation(null), false);
  assert.equal(canShowAdminNavigation(undefined), false);
});
