import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('login panel uses email and password instead of userId-only demo login', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /name="email"/);
  assert.match(source, /type="password"/);
  assert.match(source, /Demo1234!/);
  assert.doesNotMatch(source, /name="userId"/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ userId/);
});

test('login panel form does not leak credentials through a default GET fallback', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /<form className="form" method="post" onSubmit=\{login\}>/);
});
