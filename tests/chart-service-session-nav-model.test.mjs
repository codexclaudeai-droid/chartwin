import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatSessionRoleLabel,
  formatSessionUserLabel,
  shouldShowProfileNavigation,
} from '../app/session-nav-model.ts';

test('session navigation prefers a display name and falls back to email', () => {
  assert.equal(formatSessionUserLabel({ name: 'Member', email: 'member@example.com' }), 'Member');
  assert.equal(formatSessionUserLabel({ name: '', email: 'member@example.com' }), 'member@example.com');
});

test('session navigation only shows the profile link after authentication', () => {
  assert.equal(shouldShowProfileNavigation({ authenticated: true }), true);
  assert.equal(shouldShowProfileNavigation({ authenticated: false }), false);
  assert.equal(shouldShowProfileNavigation({}), false);
});

test('session navigation formats role labels for operators and members', () => {
  assert.equal(formatSessionRoleLabel('member'), '회원');
  assert.equal(formatSessionRoleLabel('admin'), '관리자');
  assert.equal(formatSessionRoleLabel('super_admin'), '최고관리자');
  assert.equal(formatSessionRoleLabel('salesperson'), '영업');
  assert.equal(formatSessionRoleLabel('custom_role'), 'custom_role');
});
