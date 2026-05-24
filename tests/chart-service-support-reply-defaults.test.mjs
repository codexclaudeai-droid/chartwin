import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultSupportReplyBody } from '../app/admin/support-reply-defaults.ts';

test('default support reply gives admins a safe quick response', () => {
  const reply = getDefaultSupportReplyBody();

  assert.match(reply, /문의/);
  assert.match(reply, /확인/);
  assert.equal(reply.length > 10, true);
});
