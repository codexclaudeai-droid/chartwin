import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('login panel uses email and password instead of userId-only demo login', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /name="email"/);
  assert.match(source, /type="password"/);
  assert.doesNotMatch(source, /name="userId"/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ userId/);
});

test('login panel does not expose demo account shortcuts or default credentials', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /useState\(''\)/);
  assert.doesNotMatch(source, /demo/i);
  assert.doesNotMatch(source, /Demo1234!/);
  assert.doesNotMatch(source, /<select/);
});

test('login panel form does not leak credentials through a default GET fallback', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /<form className="form" method="post" onSubmit=\{login\}>/);
});

test('login panel returns users to a safe redirect after authentication', () => {
  const panelSource = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');
  const redirectSource = readFileSync(new URL('../app/auth-redirect.ts', import.meta.url), 'utf8');

  assert.match(panelSource, /navigateToSafeRedirect/);
  assert.match(panelSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(redirectSource, /redirect\.startsWith\('\/'\)/);
  assert.match(redirectSource, /redirect\.startsWith\('\/\/'\)/);
  assert.match(redirectSource, /window\.location\.assign\(redirect\)/);
});

test('login panel sends admin operators to the admin dashboard after authentication', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /isAdminRole/);
  assert.match(source, /payload\.user\?\.role/);
  assert.match(source, /window\.location\.assign\('\/admin'\)/);
});

test('login panel returns normal landing logins to the landing page', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /navigateToSafeRedirect\(new URLSearchParams\(window\.location\.search\)\)/);
  assert.match(source, /window\.location\.assign\('\/'\)/);
});
