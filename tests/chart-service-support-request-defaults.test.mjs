import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultSupportRequestDraft } from '../app/support/support-request-defaults.ts';

test('default support request draft provides required title and body', () => {
  const draft = getDefaultSupportRequestDraft();

  assert.match(draft.title, /문의/);
  assert.match(draft.body, /확인/);
  assert.equal(draft.title.length > 2, true);
  assert.equal(draft.body.length > 10, true);
});
