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

  assert.match(source, /createAdminSupportThreadUrl/);
  assert.match(source, /getAdminSupportThreadDomId/);
  assert.match(source, /getAdminSupportReplyInputId/);
  assert.match(source, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /scrollIntoView\(\{ block: 'center'/);
  assert.match(source, /\.focus\(\)/);
  assert.match(source, /replyInputRefs/);
  assert.match(source, /상세 답변 링크/);
  assert.match(source, /바로 답변/);
  assert.match(source, /thread-card highlighted/);
});
