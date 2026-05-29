import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSupportThread,
  deleteSupportMessageAsAdmin,
  deleteSupportThread,
  listPublishedPublicBoardPosts,
  listVisibleSupportThreads,
  replyToSupportThreadAsAdmin,
  updateSupportMessageAsAdmin,
  updateSupportThread,
  updatePublicBoardPosts,
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

test('free trial support requests require a normal member account', () => {
  const repository = createMockChartServiceRepository();

  const result = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'trial',
    title: '무료체험 신청',
    body: '무료체험을 신청합니다.',
    visibility: 'private',
    createdAt: '2026-05-23T11:00:00.000Z',
  });

  assert.equal(result.thread.category, 'trial');
  assert.throws(() => createSupportThread(repository, {
    actor: { id: 'admin_1', role: 'admin' },
    category: 'trial',
    title: '무료체험 신청',
    body: '관리자 계정 신청',
    visibility: 'private',
    createdAt: '2026-05-23T11:00:00.000Z',
  }), /Trial request requires a member account/);
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

test('support thread owners and admins can update and delete customer posts', () => {
  const repository = createMockChartServiceRepository();
  const { thread } = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'usage',
    title: 'Original support title',
    body: 'Original support body',
    visibility: 'private',
    createdAt: '2026-05-23T11:00:00.000Z',
  });

  assert.throws(() => updateSupportThread(repository, {
    actor: { id: 'user_subscriber', role: 'member' },
    threadId: thread.id,
    title: 'Blocked title',
    body: 'Blocked body',
    updatedAt: '2026-05-23T11:05:00.000Z',
  }), /not allowed/);

  const updated = updateSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    threadId: thread.id,
    title: 'Updated support title',
    body: 'Updated support body',
    updatedAt: '2026-05-23T11:10:00.000Z',
  });

  assert.equal(updated.thread.title, 'Updated support title');
  assert.equal(updated.thread.updatedAt, '2026-05-23T11:10:00.000Z');
  assert.equal(updated.message.body, 'Updated support body');

  deleteSupportThread(repository, {
    actor: { id: 'admin_1', role: 'admin' },
    threadId: thread.id,
    deletedAt: '2026-05-23T11:20:00.000Z',
  });

  assert.equal(repository.getSupportThreadById(thread.id), null);
  assert.equal(repository.listSupportMessagesByThreadId(thread.id).length, 0);
  assert.equal(
    listVisibleSupportThreads(repository, { actor: { id: 'user_member', role: 'member' } })
      .some((item) => item.thread.id === thread.id),
    false,
  );
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'support.thread.deleted');
});

test('admin can update and delete support replies with audit evidence', () => {
  const repository = createMockChartServiceRepository();
  const { thread } = createSupportThread(repository, {
    actor: { id: 'user_member', role: 'member' },
    category: 'signal',
    title: 'Signal support title',
    body: 'Signal support body',
    visibility: 'private',
    createdAt: '2026-05-23T11:00:00.000Z',
  });
  const { message } = replyToSupportThreadAsAdmin(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    threadId: thread.id,
    body: 'Original admin reply',
    createdAt: '2026-05-23T11:10:00.000Z',
  });

  const updated = updateSupportMessageAsAdmin(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    messageId: message.id,
    body: 'Updated admin reply',
    updatedAt: '2026-05-23T11:20:00.000Z',
  });

  assert.equal(updated.message.body, 'Updated admin reply');
  assert.equal(updated.thread.updatedAt, '2026-05-23T11:20:00.000Z');
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'support.reply.updated');

  const deleted = deleteSupportMessageAsAdmin(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    messageId: message.id,
    deletedAt: '2026-05-23T11:30:00.000Z',
  });

  assert.equal(deleted.thread.status, 'waiting');
  assert.equal(repository.listSupportMessagesByThreadId(thread.id).some((item) => item.id === message.id), false);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'support.reply.deleted');
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
  assert.match(source, /getSupportThreadFilterCount/);
  assert.match(source, /quick-filter-count/);
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

test('admin support panel groups thread details for readable operations', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatDateTime/);
  assert.match(source, /admin-support-thread-card/);
  assert.match(source, /admin-support-thread-header/);
  assert.match(source, /admin-support-meta-bar/);
  assert.match(source, /admin-support-author-cell/);
  assert.match(source, /admin-support-message-list/);
  assert.match(source, /admin-support-message admin-support-admin-reply/);
  assert.match(source, /admin-support-reply-actions/);
  assert.match(source, /aria-label=\{`\$\{item\.thread\.id\} 문의 답변 입력`\}/);
});

test('admin support panel uses a dark operational queue finish', () => {
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(styleSource, /#admin-support\s*\{[\s\S]*?linear-gradient/);
  assert.match(styleSource, /#admin-support \.quick-filter-row\s*\{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(154px, 1fr\)\)/);
  assert.match(styleSource, /#admin-support \.admin-support-thread-card\s*\{[\s\S]*?border:/);
  assert.match(styleSource, /#admin-support \.admin-support-message-list\s*\{[\s\S]*?display: grid/);
  assert.match(styleSource, /#admin-support \.reply-row\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(styleSource, /#admin-support \.admin-support-reply-actions\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('admin support panel separates queue controls and reply surfaces for final operations', () => {
  const source = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /card wide admin-support-panel/);
  assert.match(source, /toolbar admin-support-toolbar/);
  assert.match(source, /notice admin-support-status-notice/);
  assert.match(source, /quick-filter-row admin-support-filter-row/);
  assert.match(source, /admin-support-filter-summary/);
  assert.match(source, /thread-list admin-support-thread-list/);
  assert.match(source, /admin-support-empty-state/);
  assert.match(source, /admin-support-thread-title/);
  assert.match(source, /admin-support-meta-chip/);
  assert.match(source, /admin-support-detail-link/);
  assert.match(source, /reply-row admin-support-reply-row/);
});

test('admin support panel final pass styles status filter and reply controls', () => {
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(styleSource, /#admin-support\.admin-support-panel\s*\{[\s\S]*?display: grid/);
  assert.match(styleSource, /#admin-support \.admin-support-status-notice\s*\{[\s\S]*?border-color: transparent/);
  assert.match(styleSource, /#admin-support \.admin-support-filter-summary\s*\{[\s\S]*?background: transparent/);
  assert.match(styleSource, /#admin-support \.admin-support-meta-chip\s*\{[\s\S]*?border: 1px solid rgba\(125, 183, 255, 0\.14\)/);
  assert.match(styleSource, /#admin-support \.admin-support-reply-row\s*\{[\s\S]*?background: rgba\(2, 7, 19, 0\.28\)/);
  assert.match(styleSource, /#admin-support \.admin-support-empty-state\s*\{[\s\S]*?text-align: center/);
});

test('support panels expose edit and delete controls for threads and admin replies', () => {
  const supportSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const adminSource = fs.readFileSync(new URL('../app/admin/support-admin-panel.tsx', import.meta.url), 'utf8');
  const threadRouteSource = fs.readFileSync(new URL('../app/api/support/threads/route.ts', import.meta.url), 'utf8');
  const replyRouteSource = fs.readFileSync(new URL('../app/api/admin/support/reply/route.ts', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(supportSource, /editingThreadId/);
  assert.match(supportSource, /saveThreadEdit/);
  assert.match(supportSource, /deleteThread/);
  assert.match(supportSource, /method: 'PATCH'/);
  assert.match(supportSource, /method: 'DELETE'/);
  assert.match(adminSource, /editingThreadId/);
  assert.match(adminSource, /editingReplyId/);
  assert.match(adminSource, /saveReplyEdit/);
  assert.match(adminSource, /deleteReply/);
  assert.match(adminSource, /admin-support-message-actions/);
  assert.match(threadRouteSource, /export async function PATCH/);
  assert.match(threadRouteSource, /updateAsyncSupportThread/);
  assert.match(threadRouteSource, /export async function DELETE/);
  assert.match(threadRouteSource, /deleteAsyncSupportThread/);
  assert.match(replyRouteSource, /export async function PATCH/);
  assert.match(replyRouteSource, /updateAsyncSupportMessageAsAdmin/);
  assert.match(replyRouteSource, /export async function DELETE/);
  assert.match(replyRouteSource, /deleteAsyncSupportMessageAsAdmin/);
  assert.match(styleSource, /support-thread-actions/);
  assert.match(styleSource, /admin-support-message-actions/);
});

test('member support panel supports notification deep links to a thread', () => {
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const pageSource = fs.readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /useSearchParams/);
  assert.match(panelSource, /targetThreadId/);
  assert.match(panelSource, /targetThread/);
  assert.match(panelSource, /latestAdminReply/);
  assert.match(panelSource, /orderedThreads/);
  assert.match(panelSource, /activeFilterKey/);
  assert.match(panelSource, /filterSupportThreads/);
  assert.match(panelSource, /aria-label="내 문의 빠른 필터"/);
  assert.match(panelSource, /quick-filter-count/);
  assert.match(panelSource, /현재 필터: \{activeFilter\.label\}/);
  assert.match(panelSource, /filteredThreads\.map/);
  assert.match(panelSource, /현재 필터에 해당하는 문의가 없습니다/);
  assert.match(panelSource, /support-deep-link-notice/);
  assert.match(panelSource, /답변 확인 대상 문의/);
  assert.match(panelSource, /최근 관리자 답변/);
  assert.match(panelSource, /support-thread-answered/);
  assert.match(panelSource, /support-reply-preview/);
  assert.match(panelSource, /support-answer-badge/);
  assert.match(panelSource, /답변 확인 가능/);
  assert.match(panelSource, /support-target-badge/);
  assert.match(panelSource, /알림에서 이동/);
  assert.match(panelSource, /최근 답변/);
  assert.match(panelSource, /문의 카드로 이동/);
  assert.match(panelSource, /id=\{`support-\$\{item\.thread\.id\}`\}/);
  assert.match(panelSource, /support-thread-target/);
  assert.match(pageSource, /import \{ Suspense \} from 'react'/);
  assert.match(pageSource, /<Suspense fallback=/);
  assert.match(styleSource, /\.thread-card\.support-thread-target/);
  assert.match(styleSource, /\.thread-card\.support-thread-answered/);
  assert.match(styleSource, /@keyframes supportTargetPulse/);
  assert.match(styleSource, /\.support-answer-badge/);
  assert.match(styleSource, /\.support-target-badge/);
  assert.match(styleSource, /\.support-reply-preview/);
  assert.match(styleSource, /\.support-deep-link-notice/);
});

test('member support panel supports trial request presets from landing links', () => {
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const labelSource = fs.readFileSync(new URL('../app/support/support-display-labels.ts', import.meta.url), 'utf8');
  const defaultSource = fs.readFileSync(new URL('../app/support/support-request-defaults.ts', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../app/api/support/threads/route.ts', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(panelSource, /presetCategory/);
  assert.match(panelSource, /searchParams\.get\('category'\)/);
  assert.match(panelSource, /presetCategory !== 'trial' && presetCategory !== 'partnership'/);
  assert.match(panelSource, /authSession/);
  assert.match(panelSource, /canSubmitTrialRequest/);
  assert.match(panelSource, /\/api\/auth\/me/);
  assert.match(panelSource, /trial-auth-gate/);
  assert.match(panelSource, /무료체험 신청은 일반회원 로그인이 필요합니다/);
  assert.match(panelSource, /\/signup\?redirect=\/support%3Fcategory%3Dtrial%23support-inquiry-form/);
  assert.match(panelSource, /\/login\?redirect=\/support%3Fcategory%3Dtrial%23support-inquiry-form/);
  assert.match(panelSource, /getTrialSupportRequestDraft/);
  assert.match(panelSource, /getPartnershipSupportRequestDraft/);
  assert.match(panelSource, /value="trial"/);
  assert.match(panelSource, /value="partnership"/);
  assert.match(labelSource, /trial/);
  assert.match(labelSource, /partnership/);
  assert.match(defaultSource, /무료체험 신청/);
  assert.match(defaultSource, /체험 가능 조건/);
  assert.match(defaultSource, /제휴문의/);
  assert.match(defaultSource, /TradingCore 서비스 제휴/);
  assert.match(routeSource, /'trial'/);
  assert.match(styleSource, /\.trial-auth-gate/);
  assert.doesNotMatch(defaultSource, /5분 차트 미리보기/);
});

test('support page exposes public notice qna and faq boards before private inquiries', () => {
  const pageSource = fs.readFileSync(new URL('../app/support/page.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/support/support-panel.tsx', import.meta.url), 'utf8');
  const styleSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(pageSource, /getAsyncChartServicePersistence/);
  assert.match(pageSource, /persistence\.runRead/);
  assert.match(pageSource, /SUPPORT_CONTACT_ROUTES/);
  assert.match(pageSource, /support-contact-routes/);
  assert.match(pageSource, /1:1 문의/);
  assert.match(pageSource, /제휴문의/);
  assert.match(pageSource, /무료체험신청/);
  assert.match(pageSource, /#support-inquiry-form/);
  assert.match(pageSource, /\/support\?category=partnership#support-inquiry-form/);
  assert.match(pageSource, /\/signup\?redirect=\/support%3Fcategory%3Dtrial%23support-inquiry-form/);
  assert.match(pageSource, /회원가입 후 무료체험 신청/);
  assert.match(panelSource, /id="support-inquiry-form"/);
  assert.doesNotMatch(pageSource, /SUPPORT_FLOW/);
  assert.doesNotMatch(pageSource, /입금\/결제/);
  assert.doesNotMatch(pageSource, /취소\/환불/);
  assert.match(pageSource, /listAsyncPublishedPublicBoardPosts/);
  assert.match(pageSource, /PUBLIC_BOARD_CATEGORY_LABELS/);
  assert.match(pageSource, /support-public-board/);
  assert.match(pageSource, /공지사항/);
  assert.match(pageSource, /질문답변/);
  assert.match(pageSource, /FAQ/);
  assert.match(pageSource, /공개 게시판/);
  assert.match(pageSource, /<SupportPanel \/>/);
  assert.match(styleSource, /\.support-contact-routes/);
  assert.match(styleSource, /\.support-contact-route-card/);
  assert.match(styleSource, /#support-inquiry-form/);
  assert.match(styleSource, /\.support-public-board/);
  assert.match(styleSource, /\.support-public-board-card/);
});

test('public board posts are repository backed and hide unpublished items', () => {
  const repository = createMockChartServiceRepository();

  repository.savePublicBoardPost({
    id: 'public_board_hidden',
    category: 'notice',
    title: 'Hidden notice',
    body: 'Operators can keep draft posts unpublished.',
    isPublished: false,
    sortOrder: -10,
    createdAt: '2026-05-25T09:00:00.000Z',
    updatedAt: '2026-05-25T09:00:00.000Z',
    updatedByAdminId: 'admin_1',
  });
  repository.savePublicBoardPost({
    id: 'public_board_priority',
    category: 'faq',
    title: 'Priority FAQ',
    body: 'Published posts are sorted by configured order.',
    isPublished: true,
    sortOrder: -20,
    createdAt: '2026-05-25T10:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    updatedByAdminId: 'admin_1',
  });

  const posts = listPublishedPublicBoardPosts(repository);

  assert.equal(posts.some((post) => post.id === 'public_board_hidden'), false);
  assert.equal(posts[0].id, 'public_board_priority');
  assert.deepEqual(
    [...new Set(posts.map((post) => post.category))].sort(),
    ['faq', 'notice', 'qna'],
  );
});

test('admin can update public board posts with audit evidence', () => {
  const repository = createMockChartServiceRepository();

  const updated = updatePublicBoardPosts(repository, {
    admin: { id: 'admin_1', role: 'admin' },
    posts: [
      {
        id: 'public_board_notice',
        category: 'notice',
        title: 'Updated notice',
        body: 'Updated public notice body',
        isPublished: true,
        sortOrder: 1,
      },
      {
        category: 'faq',
        title: 'New FAQ',
        body: 'New FAQ body',
        isPublished: false,
        sortOrder: 2,
      },
    ],
    updatedAt: '2026-05-25T11:00:00.000Z',
  });

  assert.equal(updated[0].title, 'Updated notice');
  assert.equal(updated[0].createdAt, '2026-05-23T00:00:00.000Z');
  assert.equal(updated[1].id.startsWith('public_board_'), true);
  assert.equal(repository.listPublicBoardPosts().some((post) => post.title === 'New FAQ'), true);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.public_board.update');
});

test('admin web info section exposes public board management submenu and route', () => {
  const sectionSource = fs.readFileSync(new URL('../app/admin/admin-web-info-section.tsx', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-public-board-panel.tsx', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../app/api/admin/public-board/route.ts', import.meta.url), 'utf8');

  assert.match(sectionSource, /AdminPublicBoardPanel/);
  assert.match(sectionSource, /href: '#admin-public-board'/);
  assert.match(sectionSource, /activePage === 'publicBoard'/);
  assert.match(panelSource, /\/api\/admin\/public-board/);
  assert.match(panelSource, /PUBLIC_BOARD_CATEGORY_LABELS/);
  assert.match(panelSource, /공개 게시판 저장/);
  assert.match(routeSource, /updateAsyncPublicBoardPosts/);
});
