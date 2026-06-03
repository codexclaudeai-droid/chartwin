import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('admin navigation uses the admin page label in mobile menus', () => {
  const source = fs.readFileSync(new URL('../app/admin-nav-link.tsx', import.meta.url), 'utf8');

  assert.match(source, /관리자페이지/);
  assert.doesNotMatch(source, /관리대시보드|관리자대시보드/);
});
