import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const publicDir = new URL('../public/', import.meta.url);

test('legacy signal settings page does not claim the /admin route', () => {
  assert.equal(fs.existsSync(new URL('admin.html', publicDir)), false);
  assert.equal(fs.existsSync(new URL('signal.html', publicDir)), true);
});
