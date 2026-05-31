import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
const gateSource = fs.readFileSync(new URL('../app/admin/admin-access-gate.tsx', import.meta.url), 'utf8');

test('admin page wraps operations panels in the access gate', () => {
  assert.match(pageSource, /import \{ AdminAccessGate \}/);
  assert.match(pageSource, /<AdminAccessGate>/);
  assert.match(pageSource, /<\/AdminAccessGate>/);
});

test('admin access gate redirects unauthenticated visitors to login entry', () => {
  assert.match(gateSource, /useRouter/);
  assert.match(gateSource, /router\.replace\('\/login\?redirect=\/admin'\)/);
  assert.match(gateSource, /state === 'login_required'/);
});

test('admin access gate can authorize from actor role fallback', () => {
  assert.match(gateSource, /actor\?: \{/);
  assert.match(gateSource, /payload\.user\?\.role \?\? payload\.actor\?\.role/);
});
