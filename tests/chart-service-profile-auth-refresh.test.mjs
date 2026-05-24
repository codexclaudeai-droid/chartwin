import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../app/profile/profile-panel.tsx', import.meta.url), 'utf8');

test('profile panel refreshes account data when the auth session changes', () => {
  assert.match(source, /subscribeAuthSessionChangedEvent/);
  assert.match(source, /const unsubscribe = subscribeAuthSessionChangedEvent/);
});
