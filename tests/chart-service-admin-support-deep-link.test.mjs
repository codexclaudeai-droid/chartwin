import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('admin support thread links create direct reply URLs', async () => {
  const {
    ADMIN_SUPPORT_THREAD_QUERY_PARAM,
    createAdminSupportThreadUrl,
    getAdminSupportThreadDomId,
    getAdminSupportReplyInputId,
  } = await import('../app/admin/support-thread-links.ts');

  assert.equal(ADMIN_SUPPORT_THREAD_QUERY_PARAM, 'supportThread');
  assert.equal(createAdminSupportThreadUrl('support_123'), '/admin?supportThread=support_123#admin-support');
  assert.equal(createAdminSupportThreadUrl('support 123'), '/admin?supportThread=support%20123#admin-support');
  assert.equal(getAdminSupportThreadDomId('support_123'), 'admin-support-thread-support_123');
  assert.equal(getAdminSupportReplyInputId('support_123'), 'admin-support-reply-support_123');
});

test('admin support panel supports deep links that focus the reply field', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /dispatchAdminAuditLogPresetEvent/);
  assert.match(source, /createAdminSupportThreadUrl/);
  assert.match(source, /deepLinkedThreadId/);
  assert.match(source, /deepLinkedThread/);
  assert.match(source, /getAdminSupportThreadDomId/);
  assert.match(source, /getAdminSupportReplyInputId/);
  assert.match(source, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /scrollIntoView\(\{ block: 'center'/);
  assert.match(source, /\.focus\(\)/);
  assert.match(source, /replyInputRefs/);
  assert.match(source, /admin-deep-link-notice/);
  assert.match(source, /답변 대상 문의/);
  assert.match(source, /formatSupportStatusLabel\(deepLinkedThread\.thread\.status\)/);
  assert.match(source, /deepLinkedThread\.thread\.status === 'answered'/);
  assert.match(source, /이미 답변 완료된 문의입니다/);
  assert.match(source, /이 문의에 바로 답변할 수 있습니다/);
  assert.match(source, /href="#admin-audit-logs"/);
  assert.match(source, /presetKey: 'support', targetId: deepLinkedThread\.thread\.id/);
  assert.match(source, /이 문의 감사로그 보기/);
  assert.match(source, /상세 답변 링크/);
  assert.match(source, /바로 답변/);
  assert.match(source, /thread-card highlighted/);
});

test('admin support deep link notice exposes target context and actions', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /admin-deep-link-card/);
  assert.match(source, /admin-deep-link-title/);
  assert.match(source, /admin-deep-link-context/);
  assert.match(source, /admin-deep-link-meta/);
  assert.match(source, /admin-deep-link-target-id/);
  assert.match(source, /admin-deep-link-actions/);
  assert.match(source, /admin-deep-link-action-primary/);
  assert.match(source, /admin-deep-link-action-secondary/);
  assert.match(source, /admin-deep-link-missing/);
});

test('admin support deep link notice has focused operational styling', () => {
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(styleSource, /#admin-support \.admin-deep-link-notice\s*\{[\s\S]*?display: grid/);
  assert.match(styleSource, /#admin-support \.admin-deep-link-meta\s*\{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(160px, 1fr\)\)/);
  assert.match(styleSource, /#admin-support \.admin-deep-link-target-id\s*\{[\s\S]*?border: 1px solid rgba\(125, 183, 255, 0\.16\)/);
  assert.match(styleSource, /#admin-support \.admin-deep-link-actions\s*\{[\s\S]*?display: flex/);
  assert.match(styleSource, /#admin-support \.admin-deep-link-missing\s*\{[\s\S]*?text-align: center/);
});
