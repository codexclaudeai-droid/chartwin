import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('forgot password page wires request and confirm endpoints', () => {
  const page = fs.readFileSync(new URL('../app/forgot-password/page.tsx', import.meta.url), 'utf8');
  const panel = fs.readFileSync(new URL('../app/forgot-password/forgot-password-panel.tsx', import.meta.url), 'utf8');

  assert.match(page, /ForgotPasswordPanel/);
  assert.match(panel, /\/api\/auth\/password-reset\/request/);
  assert.match(panel, /\/api\/auth\/password-reset\/confirm/);
  assert.match(panel, /resetTokenPreview/);
});

test('login page links users to password recovery', () => {
  const page = fs.readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');

  assert.match(page, /\/forgot-password/);
});

