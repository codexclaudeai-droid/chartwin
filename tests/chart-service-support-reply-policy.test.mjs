import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSubmitSupportReply,
  normalizeSupportReply,
} from '../app/admin/support-reply-policy.ts';

test('support reply policy trims body before submission', () => {
  assert.equal(normalizeSupportReply('  확인 후 안내드리겠습니다.  '), '확인 후 안내드리겠습니다.');
});

test('support reply policy blocks blank manual replies', () => {
  assert.equal(canSubmitSupportReply(''), false);
  assert.equal(canSubmitSupportReply('   '), false);
  assert.equal(canSubmitSupportReply('확인했습니다.'), true);
});
