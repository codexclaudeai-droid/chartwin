import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { USER_ROLES } from '../src/domain/chart-service/index.ts';
import {
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  listAsyncPublishedNoticePopups,
  sanitizeNoticePopupHtml,
  upsertAsyncNoticePopup,
  deleteAsyncNoticePopup,
} from '../src/server/chart-service/index.ts';

test('notice popup service sanitizes html and audits admin mutations', async () => {
  const repository = createMockChartServiceRepository();
  const asyncRepository = createAsyncChartServiceRepository(repository);
  const admin = { id: 'admin_1', role: USER_ROLES.admin };

  const popup = await upsertAsyncNoticePopup(asyncRepository, {
    admin,
    popup: {
      title: '서비스 점검',
      bodyHtml: '<h2 onclick="alert(1)">공지</h2><script>alert(1)</script><p><a href="javascript:alert(1)">링크</a></p>',
      isActive: true,
      sortOrder: 20,
      startAt: '2026-05-31T00:00:00.000Z',
      endAt: '2026-05-31T23:59:00.000Z',
    },
    updatedAt: '2026-05-31T00:00:00.000Z',
  });
  const futurePopup = await upsertAsyncNoticePopup(asyncRepository, {
    admin,
    popup: {
      title: '다음 공지',
      bodyHtml: '<p>다음 주 공지</p>',
      isActive: true,
      sortOrder: 10,
      startAt: '2026-06-10T00:00:00.000Z',
      endAt: '2026-06-12T23:59:00.000Z',
    },
    updatedAt: '2026-05-31T00:00:00.000Z',
  });

  assert.equal(popup.title, '서비스 점검');
  assert.equal(popup.startAt, '2026-05-31T00:00:00.000Z');
  assert.equal(popup.endAt, '2026-05-31T23:59:00.000Z');
  assert.doesNotMatch(popup.bodyHtml, /script|onclick|javascript:/i);
  assert.deepEqual(
    (await listAsyncPublishedNoticePopups(asyncRepository, '2026-05-31T12:00:00.000Z')).map((item) => item.id),
    [popup.id],
  );
  assert.deepEqual(
    (await listAsyncPublishedNoticePopups(asyncRepository, '2026-05-30T23:59:00.000Z')).map((item) => item.id),
    [],
  );
  assert.deepEqual(
    (await listAsyncPublishedNoticePopups(asyncRepository, '2026-06-01T00:00:00.000Z')).map((item) => item.id),
    [],
  );
  await assert.rejects(
    upsertAsyncNoticePopup(asyncRepository, {
      admin,
      popup: {
        title: '잘못된 기간',
        bodyHtml: '<p>종료가 먼저인 공지</p>',
        isActive: true,
        sortOrder: 30,
        startAt: '2026-06-02T00:00:00.000Z',
        endAt: '2026-06-01T00:00:00.000Z',
      },
      updatedAt: '2026-05-31T00:00:00.000Z',
    }),
    /Notice popup end time must be after start time/,
  );
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.notice_popup.upsert');

  await deleteAsyncNoticePopup(asyncRepository, { admin, popupId: popup.id });
  await deleteAsyncNoticePopup(asyncRepository, { admin, popupId: futurePopup.id });
  assert.equal((await asyncRepository.listNoticePopups()).length, 0);
  assert.equal(repository.listAuditLogs().at(-1)?.action, 'admin.notice_popup.delete');
});

test('notice popup admin screen uses Tiptap and icon actions', () => {
  const panelSource = fs.readFileSync(new URL('../app/admin/admin-notice-popup-panel.tsx', import.meta.url), 'utf8');
  const publicBoardSource = fs.readFileSync(new URL('../app/admin/admin-public-board-panel.tsx', import.meta.url), 'utf8');
  const editorSource = fs.readFileSync(new URL('../app/shared/rich-text-editor.tsx', import.meta.url), 'utf8');
  const numberStepperSource = fs.readFileSync(new URL('../app/shared/number-stepper.tsx', import.meta.url), 'utf8');
  const webInfoSource = fs.readFileSync(new URL('../app/admin/admin-web-info-section.tsx', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../app/api/admin/notice-popups/route.ts', import.meta.url), 'utf8');
  const publicRouteSource = fs.readFileSync(new URL('../app/api/notice-popups/route.ts', import.meta.url), 'utf8');
  const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const viewerSource = fs.readFileSync(new URL('../app/notice-popup-viewer.tsx', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(editorSource, /@tiptap\/react/);
  assert.match(editorSource, /StarterKit/);
  assert.match(editorSource, /BodyParagraphStyle/);
  assert.match(editorSource, /BODY_STYLE_OPTIONS/);
  assert.match(editorSource, /Underline/);
  assert.match(editorSource, /Link/);
  assert.match(editorSource, /TextAlign/);
  assert.match(editorSource, /Color/);
  assert.match(editorSource, /FontFamilyStyle/);
  assert.match(editorSource, /FontSizeStyle/);
  assert.match(editorSource, /FONT_FAMILY_OPTIONS/);
  assert.match(editorSource, /FONT_SIZE_OPTIONS/);
  assert.match(editorSource, /RichTextDropdown/);
  assert.match(editorSource, /createPortal/);
  assert.match(editorSource, /document\.body/);
  assert.match(editorSource, /window\.setTimeout\(\(\) => setIsOpen\(false\), 0\)/);
  assert.match(editorSource, /onPointerDown/);
  assert.match(editorSource, /handleTriggerKeyDown/);
  assert.match(editorSource, /getActiveBlockFormat/);
  assert.match(editorSource, /getActiveBodyStyle/);
  assert.match(editorSource, /getActiveFontFamily/);
  assert.match(editorSource, /getActiveFontSize/);
  assert.match(editorSource, /ariaLabelledBy/);
  assert.match(editorSource, /Pretendard/);
  assert.match(editorSource, /Spoqa Han Sans Neo/);
  assert.match(editorSource, /Gmarket Sans/);
  assert.match(editorSource, /BM DoHyeon/);
  assert.match(editorSource, /Black Han Sans/);
  assert.match(editorSource, /안내 박스/);
  assert.match(editorSource, /주의 박스/);
  assert.match(editorSource, /성공 박스/);
  assert.match(editorSource, /lastEmittedHtmlRef/);
  assert.match(editorSource, /selectionUpdate/);
  assert.doesNotMatch(editorSource, /editor\.on\('transaction'/);
  assert.doesNotMatch(editorSource, /selectedBlockFormat/);
  assert.doesNotMatch(editorSource, /rich-text-block-format-button/);
  assert.doesNotMatch(editorSource, /rich-text-format-select/);
  assert.doesNotMatch(editorSource, /onMouseDown/);
  assert.doesNotMatch(editorSource, /rich-text-editor-content" onClick/);
  assert.doesNotMatch(editorSource, /onPointerDownCapture/);
  assert.match(editorSource, /Highlight/);
  assert.match(editorSource, /unsetHighlight/);
  assert.match(editorSource, /하이라이트 해제/);
  assert.match(editorSource, /Subscript/);
  assert.match(editorSource, /Superscript/);
  assert.match(editorSource, /TaskList/);
  assert.match(editorSource, /Table/);
  assert.match(editorSource, /lucide-react/);
  assert.match(editorSource, /Bold/);
  assert.match(editorSource, /ImageUp/);
  assert.match(editorSource, /Video/);
  assert.match(editorSource, /Code2/);
  assert.match(editorSource, /onHtmlSourceModeChange/);
  assert.match(editorSource, /HTML 적용/);
  assert.match(editorSource, /<span>굵게<\/span>/);
  assert.match(editorSource, /<span>이미지URL<\/span>/);
  assert.match(editorSource, /<span>동영상URL<\/span>/);
  assert.match(editorSource, /NoticeImage/);
  assert.match(editorSource, /NoticeVideo/);
  assert.match(editorSource, /제목 3/);
  assert.match(editorSource, /코드블록/);
  assert.match(editorSource, /체크/);
  assert.match(editorSource, /글자/);
  assert.match(editorSource, /글자 크기/);
  assert.match(editorSource, /24px/);
  assert.match(editorSource, /배경/);
  assert.match(editorSource, /Rows3/);
  assert.match(editorSource, /Columns3/);
  assert.match(editorSource, /이미지 URL/);
  assert.match(editorSource, /이미지 업로드/);
  assert.match(editorSource, /동영상 URL/);
  assert.match(panelSource, /RichTextEditor/);
  assert.match(panelSource, /ariaLabelledBy="notice-popup-body-label"/);
  assert.doesNotMatch(panelSource, /<label className="admin-notice-popup-editor-label">/);
  assert.match(panelSource, /NumberStepper/);
  assert.match(panelSource, /NoticePopupSchedulePicker/);
  assert.match(panelSource, /startAt/);
  assert.match(panelSource, /endAt/);
  assert.match(panelSource, /notice-popup-schedule-picker/);
  assert.match(panelSource, /notice-popup-calendar-day/);
  assert.match(panelSource, /range-start/);
  assert.match(panelSource, /in-range/);
  assert.match(panelSource, /getCalendarWeekCount/);
  assert.match(panelSource, /weekCount \* 7/);
  assert.match(panelSource, /notice-popup-calendar-blank/);
  assert.match(panelSource, /leftMonth/);
  assert.match(panelSource, /rightMonth/);
  assert.doesNotMatch(panelSource, /length: 42/);
  assert.match(panelSource, /IconButton/);
  assert.match(panelSource, /admin-notice-popup-table/);
  assert.match(panelSource, /공지글 작성/);
  assert.match(publicBoardSource, /NumberStepper/);
  assert.match(numberStepperSource, /ChevronUpIcon/);
  assert.match(numberStepperSource, /ChevronDownIcon/);
  assert.match(panelSource, /Pencil/);
  assert.match(panelSource, /Trash2/);
  assert.match(webInfoSource, /공지팝업/);
  assert.match(webInfoSource, /AdminNoticePopupPanel/);
  assert.match(routeSource, /upsertAsyncNoticePopup/);
  assert.match(routeSource, /deleteAsyncNoticePopup/);
  assert.match(routeSource, /startAt/);
  assert.match(routeSource, /endAt/);
  assert.match(publicRouteSource, /listAsyncPublishedNoticePopups/);
  assert.match(layoutSource, /NoticePopupViewer/);
  assert.match(viewerSource, /usePathname/);
  assert.match(viewerSource, /startsWith\('\/admin'\)/);
  assert.match(viewerSource, /localStorage/);
  assert.match(viewerSource, /24시간 동안 닫기/);
  assert.match(viewerSource, /NOTICE_POPUP_SNOOZE_MS/);
  assert.match(viewerSource, /NOTICE_POPUP_POLL_INTERVAL_MS/);
  assert.match(viewerSource, /window\.setInterval/);
  assert.match(viewerSource, /visibilitychange/);
  assert.match(viewerSource, /document\.visibilityState === 'visible'/);
  assert.match(cssSource, /\.rich-text-editor/);
  assert.match(cssSource, /\.notice-body-style-info/);
  assert.match(cssSource, /\.notice-body-style-warning/);
  assert.match(cssSource, /\.notice-body-style-success/);
  assert.match(cssSource, /\.notice-popup-content p\.notice-body-style/);
  assert.match(cssSource, /\.rich-text-dropdown-trigger/);
  assert.match(cssSource, /\.rich-text-dropdown-menu/);
  assert.match(cssSource, /position: fixed/);
  assert.match(cssSource, /z-index: 5000/);
  assert.match(cssSource, /\.rich-text-toolbar \.rich-text-dropdown-trigger::after/);
  assert.doesNotMatch(cssSource, /\.rich-text-block-format-menu/);
  assert.doesNotMatch(cssSource, /\.rich-text-format-select/);
  assert.match(cssSource, /\.rich-text-file-input/);
  assert.match(cssSource, /\.rich-text-color-control/);
  assert.match(cssSource, /\.icon-button/);
  assert.match(cssSource, /input\[type="checkbox"\]/);
  assert.match(cssSource, /\.admin-notice-popup-schedule-picker/);
  assert.match(cssSource, /\.notice-popup-calendar-day\.in-range/);
  assert.match(cssSource, /\.notice-popup-calendar-day\.range-start/);
  assert.match(cssSource, /\.admin-notice-popup-time-grid input\[type="time"\]::-webkit-calendar-picker-indicator/);
  assert.match(cssSource, /\.admin-notice-popup-time-grid input\[type="time"\] \{/);
  assert.match(cssSource, /--notice-popup-time-control-color: #eef7ff/);
  assert.match(cssSource, /color: var\(--notice-popup-time-control-color\)/);
  assert.match(cssSource, /opacity: 1/);
  assert.match(cssSource, /\.admin-notice-popup-table/);
  assert.match(cssSource, /\.notice-popup-content table/);
  assert.match(cssSource, /\.notice-popup-content iframe/);
  assert.match(cssSource, /\.number-stepper-controls/);
  assert.match(cssSource, /\.notice-popup-dialog/);
  assert.match(cssSource, /\.notice-popup-header \.mobile-nav-panel-close/);
  assert.match(cssSource, /\.notice-popup-footer \.button/);
  assert.match(cssSource, /\.notice-popup-footer \.button\.secondary/);
  assert.match(cssSource, /color: #eef7ff/);
});

test('notice popup sanitizer keeps safe text content', () => {
  assert.equal(sanitizeNoticePopupHtml('<p>공지</p>'), '<p>공지</p>');
  assert.equal(sanitizeNoticePopupHtml('<iframe src="https://example.com/video"></iframe><p>내용</p>'), '<iframe src="https://example.com/video"></iframe><p>내용</p>');
  assert.equal(sanitizeNoticePopupHtml('<img src="javascript:alert(1)"><p>내용</p>'), '<img><p>내용</p>');
});
