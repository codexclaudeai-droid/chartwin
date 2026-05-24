import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');

test('admin page wraps operations panels in the access gate', () => {
  assert.match(pageSource, /import \{ AdminAccessGate \}/);
  assert.match(pageSource, /<AdminAccessGate>/);
  assert.match(pageSource, /<\/AdminAccessGate>/);
});
