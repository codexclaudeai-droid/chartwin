import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSubmitAdminOperationNote,
  normalizeAdminOperationNote,
} from '../app/admin/admin-operation-note.ts';

test('admin operation notes must contain visible non-whitespace text', () => {
  assert.equal(canSubmitAdminOperationNote(''), false);
  assert.equal(canSubmitAdminOperationNote('   '), false);
  assert.equal(canSubmitAdminOperationNote('입금 내역 확인 완료'), true);
});

test('admin operation note payloads are trimmed before submission', () => {
  assert.equal(normalizeAdminOperationNote('  환불 사유 확인  '), '환불 사유 확인');
});
