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

test('support page uses final service-center layout structure', () => {
  const pageSource = fs.readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /support-route-card-title/);
  assert.match(pageSource, /support-route-card-body/);
  assert.match(pageSource, /support-route-action/);
  assert.match(pageSource, /support-board-section-title/);
  assert.match(pageSource, /support-board-empty/);
  assert.match(panelSource, /support-panel-frame/);
  assert.match(panelSource, /support-compose-header/);
  assert.match(panelSource, /support-compose-intro/);
  assert.match(panelSource, /support-form-grid/);
  assert.match(panelSource, /support-submit-row/);
  assert.match(panelSource, /support-thread-toolbar/);
  assert.match(panelSource, /support-filter-summary/);
  assert.match(panelSource, /support-empty-card/);
  assert.match(panelSource, /support-thread-title/);
});

test('support page final pass uses dark operational styling without nested generic cards', () => {
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.doesNotMatch(panelSource, /className="card support-compose-card"/);
  assert.doesNotMatch(panelSource, /className="card wide support-thread-card"/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-panel-frame\s*\{[\s\S]*?border: 1px solid rgba\(125, 183, 255, 0\.16\)/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-form-grid\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-filter-summary\s*\{[\s\S]*?background: transparent/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-empty-card\s*\{[\s\S]*?text-align: center/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-thread-title\s*\{[\s\S]*?color: #ffffff/);
});
