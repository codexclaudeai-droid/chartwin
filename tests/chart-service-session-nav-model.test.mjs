import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('session navigation source renders avatar name and role badge together', () => {
  const source = fs.readFileSync(new URL('../app/session-nav.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /className="session-avatar"/);
  assert.match(source, /user\.profileImageDataUrl/);
  assert.match(source, /DefaultSessionAvatarIcon/);
  assert.match(source, /LogoutIcon/);
  assert.match(source, /className="session-button session-logout-button"/);
  assert.match(source, /aria-label=\{isBusy \? '로그아웃 처리 중' : '로그아웃'\}/);
  assert.match(source, /className="session-user-name"/);
  assert.match(source, /className="session-role"/);
  assert.match(cssSource, /\.session-avatar/);
  assert.match(cssSource, /\.session-avatar\s*\{[\s\S]*?color: var\(--accent\)/);
  assert.match(cssSource, /\.session-avatar\s*\{[\s\S]*?border: 1px solid rgba\(255, 255, 255, 0\.42\)/);
  assert.match(cssSource, /\.session-avatar svg\s*\{[\s\S]*?stroke: currentColor/);
  assert.match(cssSource, /\.session-user-name/);
  assert.match(cssSource, /\.session-logout-button/);
  assert.match(cssSource, /\.session-logout-button svg\s*\{[\s\S]*?stroke: currentColor/);
  assert.match(cssSource, /\.mobile-nav-panel \.session \.session-logout-button/);
});
