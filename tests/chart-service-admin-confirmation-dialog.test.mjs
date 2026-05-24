import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('admin confirmation dialog exposes accessible modal controls', () => {
  const source = readFileSync(new URL('../app/admin/admin-action-confirmation-dialog.tsx', import.meta.url), 'utf8');

  assert.match(source, /useAdminActionConfirmation/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /data-admin-action-confirmation/);
  assert.match(source, /관리자 작업 확인/);
  assert.match(source, /작업 진행/);
  assert.match(source, /취소/);
});

test('admin confirmation dialog resolves true for approve and false for cancel', () => {
  const source = readFileSync(new URL('../app/admin/admin-action-confirmation-dialog.tsx', import.meta.url), 'utf8');

  assert.match(source, /resolve\(true\)/);
  assert.match(source, /resolve\(false\)/);
  assert.match(source, /Promise<boolean>/);
});

test('admin confirmation dialog supports keyboard cancellation and safe default focus', () => {
  const source = readFileSync(new URL('../app/admin/admin-action-confirmation-dialog.tsx', import.meta.url), 'utf8');

  assert.match(source, /onKeyDown/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /onCancel\(\)/);
  assert.match(source, /autoFocus/);
  assert.match(source, /취소/);
});
