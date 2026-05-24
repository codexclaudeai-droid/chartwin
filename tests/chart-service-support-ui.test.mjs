import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('support display labels translate customer-facing states', async () => {
  const {
    formatSupportCategoryLabel,
    formatSupportStatusLabel,
    formatSupportVisibilityLabel,
  } = await import('../app/support/support-display-labels.ts');

  assert.equal(formatSupportCategoryLabel('deposit'), '입금/결제');
  assert.equal(formatSupportCategoryLabel('cancel'), '취소/환불');
  assert.equal(formatSupportCategoryLabel('usage'), '사용 방법');
  assert.equal(formatSupportStatusLabel('waiting'), '답변 대기');
  assert.equal(formatSupportStatusLabel('answered'), '답변 완료');
  assert.equal(formatSupportVisibilityLabel('private'), '비공개');
  assert.equal(formatSupportVisibilityLabel('public'), '공개');
  assert.equal(formatSupportStatusLabel('custom'), 'custom');
});

test('support page and panel use readable Korean copy and status labels', () => {
  const pageSource = fs.readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /고객센터/);
  assert.match(pageSource, /입금 확인, 환불 요청, 시그널 이용 문의를 한 곳에서 관리합니다/);
  assert.match(panelSource, /formatSupportCategoryLabel/);
  assert.match(panelSource, /formatSupportStatusLabel/);
  assert.match(panelSource, /formatSupportVisibilityLabel/);
  assert.match(panelSource, /로그인하면 1:1 문의를 남길 수 있습니다/);
  assert.match(panelSource, /aria-label="문의 대화"/);
});
