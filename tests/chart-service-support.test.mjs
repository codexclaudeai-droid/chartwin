import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSupportThread,
  listVisibleSupportThreads,
  replyToSupportThreadAsAdmin,
} from '../src/server/chart-service/index.ts';

test('member can create a private support thread with an initial message', () => {
  const repository = createMockChartServiceRepository();

  const result = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'deposit',
    title: '입금 확인 부탁드립니다',
    body: '방금 입금했습니다.',
    visibility: 'private',
    createdAt: '2026-05-23T11:00:00.000Z',
  });

  assert.equal(result.thread.authorUserId, 'user_member');
  assert.equal(result.thread.status, 'waiting');
  assert.equal(result.thread.visibility, 'private');
  assert.equal(result.message.threadId, result.thread.id);
  assert.equal(result.message.isAdminReply, false);
});

test('support visibility exposes public threads to guests and private threads only to owner or admin', () => {
  const repository = createMockChartServiceRepository();
  createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'usage',
    title: '개인 문의',
    body: '내 문의입니다.',
    visibility: 'private',
    createdAt: '2026-05-23T11:00:00.000Z',
  });

  const guestThreads = listVisibleSupportThreads(repository, { actor: null });
  const ownerThreads = listVisibleSupportThreads(repository, { actor: { id: 'user_member', role: 'member' } });
  const adminThreads = listVisibleSupportThreads(repository, { actor: { id: 'admin_1', role: 'admin' } });

  assert.equal(guestThreads.some((item) => item.thread.title === '개인 문의'), false);
  assert.equal(ownerThreads.some((item) => item.thread.title === '개인 문의'), true);
  assert.equal(adminThreads.some((item) => item.thread.title === '개인 문의'), true);
});

test('admin reply marks support thread answered and records an audit log', () => {
  const repository = createMockChartServiceRepository();
  const { thread } = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'signal',
    title: '시그널 질문',
    body: '시그널 표시가 궁금합니다.',
    visibility: 'private',
    createdAt: '2026-05-23T11:00:00.000Z',
  });

  const result = replyToSupportThreadAsAdmin(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    threadId: thread.id,
    body: '확인 후 답변드립니다.',
    createdAt: '2026-05-23T11:10:00.000Z',
  });

  assert.equal(result.thread.status, 'answered');
  assert.equal(result.message.isAdminReply, true);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'support.reply.created');
});

test('admin support panel disables blank manual replies before posting', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /canSubmitSupportReply/);
  assert.match(source, /normalizeSupportReply/);
  assert.match(source, /disabled=\{isBusy \|\| !canSubmitSupportReply\(replyByThreadId\[item\.thread\.id\] \|\| ''\)\}/);
});

test('admin support panel renders quick filters before the thread list', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /SUPPORT_THREAD_FILTER_PRESETS/);
  assert.match(source, /aria-label="고객센터 빠른 필터"/);
  assert.match(source, /filteredThreads\.map/);
});

test('admin support panel applies dashboard queue preset events', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /subscribeAdminQueuePresetEvent/);
  assert.match(source, /detail\.panel !== 'support'/);
  assert.match(source, /const dashboardFilter = getSupportThreadFilterPreset\(detail\.presetKey\)/);
  assert.match(source, /setActiveFilterKey\(dashboardFilter\.key\)/);
});

test('admin support panel renders operator-friendly support status labels', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatSupportStatusLabel/);
  assert.match(source, /formatSupportVisibilityLabel/);
});

test('admin support panel refreshes its filtered queue after local replies without overwriting success context', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /type SupportAdminPanelRefreshOptions = \{/);
  assert.match(source, /nextMessage\?: string/);
  assert.match(source, /detail\.source === 'support'/);
  assert.match(source, /void refresh\(\{ nextMessage: `\$\{threadId\} 문의에 답변했습니다\. 목록을 갱신했습니다\.` \}\)/);
  assert.match(source, /dispatchAdminRefreshEvent\(\{ source: 'support' \}\)/);
});

test('member support panel supports notification deep links to a thread', () => {
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const pageSource = fs.readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /useSearchParams/);
  assert.match(panelSource, /targetThreadId/);
  assert.match(panelSource, /targetThread/);
  assert.match(panelSource, /latestAdminReply/);
  assert.match(panelSource, /support-deep-link-notice/);
  assert.match(panelSource, /답변 확인 대상 문의/);
  assert.match(panelSource, /최근 관리자 답변/);
  assert.match(panelSource, /문의 카드로 이동/);
  assert.match(panelSource, /id=\{`support-\$\{item\.thread\.id\}`\}/);
  assert.match(panelSource, /support-thread-target/);
  assert.match(pageSource, /import \{ Suspense \} from 'react'/);
  assert.match(pageSource, /<Suspense fallback=/);
  assert.match(styleSource, /\.thread-card\.support-thread-target/);
  assert.match(styleSource, /\.support-deep-link-notice/);
});
