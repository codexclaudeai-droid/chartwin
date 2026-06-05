import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('support inquiry completion message hides the internal support thread id', () => {
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(panelSource, /setMessage\(`[\s\S]*payload\.thread\.id[\s\S]*`\);/);
  assert.match(panelSource, /setMessage\('문의가 등록되었습니다\. 답변이 오면 알림으로 알려드릴게요\.'\);/);
});

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
  assert.match(pageSource, /입금 확인, 환불 요청, 사용 방법 문의를 한 곳에서 관리합니다/);
  assert.match(panelSource, /formatSupportCategoryLabel/);
  assert.match(panelSource, /formatSupportStatusLabel/);
  assert.match(panelSource, /formatSupportVisibilityLabel/);
  assert.match(panelSource, /로그인하면 1:1 문의를 남길 수 있습니다/);
  assert.match(panelSource, /aria-label="문의 대화"/);
});

test('support page uses final service-center layout structure', () => {
  const pageSource = fs.readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(pageSource, /support-route-card-title/);
  assert.doesNotMatch(pageSource, /support-route-card-body/);
  assert.doesNotMatch(pageSource, /support-route-action/);
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
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-thread-title\s*\{[\s\S]*?display: flex/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-thread-actions\s*\{[\s\S]*?margin: 0/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-deep-link-notice\s*\{[\s\S]*?rgba\(9, 19, 36, 0\.82\)/);
  assert.match(cssSource, /body:not\(:has\(\.landing-page\)\) \.support-deep-link-notice p\s*\{[\s\S]*?rgba\(216, 236, 255, 0\.72\)/);
});

test('support inquiry list uses category tabs and ten item pagination', () => {
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /SUPPORT_THREAD_CATEGORY_TABS/);
  assert.match(panelSource, /SUPPORT_THREAD_PAGE_SIZE = 10/);
  assert.match(panelSource, /SUPPORT_THREAD_PAGE_NUMBERS = \[1, 2, 3, 4, 5, 6, 7, 8, 9\]/);
  assert.match(panelSource, /activeCategoryTab/);
  assert.match(panelSource, /categoryFilteredThreads/);
  assert.match(panelSource, /paginatedThreads/);
  assert.match(panelSource, /support-category-tabs/);
  assert.match(panelSource, /support-pagination/);
  assert.doesNotMatch(panelSource, /key: 'signal'/);
  assert.doesNotMatch(panelSource, /key: 'trial'/);
  assert.doesNotMatch(panelSource, /key: 'partnership'/);
  assert.doesNotMatch(panelSource, /<option value="signal">/);
  assert.doesNotMatch(panelSource, /<option value="trial">/);
  assert.doesNotMatch(panelSource, /<option value="partnership">/);
  assert.doesNotMatch(panelSource, /<span>\{formatSupportCategoryLabel\(item\.thread\.category\)\}<\/span>/);
  assert.doesNotMatch(panelSource, /<span>\{formatSupportVisibilityLabel\(item\.thread\.visibility\)\}<\/span>/);
  assert.match(cssSource, /\.support-category-tabs/);
  assert.match(cssSource, /\.support-pagination/);
});
