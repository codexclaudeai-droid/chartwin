'use client';

import { Extension, mergeAttributes, Node, type Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  ChevronDown,
  Code2,
  Ban,
  Eraser,
  Highlighter,
  Image,
  ImageUp,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Rows3,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Video,
  Columns3,
  Palette,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  htmlSourceMode?: boolean;
  onHtmlSourceModeChange?: (enabled: boolean) => void;
  ariaLabelledBy?: string;
};

type RichTextDropdownOption = {
  value: string;
  label: string;
  previewStyle?: CSSProperties;
};

const BLOCK_FORMAT_OPTIONS = [
  { value: 'paragraph', label: '본문' },
  { value: 'heading2', label: '제목 2' },
  { value: 'heading3', label: '제목 3' },
  { value: 'blockquote', label: '인용' },
  { value: 'codeBlock', label: '코드블록' },
];

const BODY_STYLE_OPTIONS: RichTextDropdownOption[] = [
  { value: 'default', label: '기본 본문' },
  { value: 'lead', label: '리드문', previewStyle: { fontSize: '1rem', fontWeight: 700 } },
  { value: 'muted', label: '작은 설명', previewStyle: { color: 'rgba(216, 236, 255, 0.68)' } },
  { value: 'strong', label: '핵심 강조', previewStyle: { fontWeight: 800, color: '#ffffff' } },
  { value: 'underline', label: '밑줄 강조', previewStyle: { textDecoration: 'underline' } },
  { value: 'highlight', label: '형광 강조', previewStyle: { background: 'rgba(255, 230, 109, 0.22)' } },
  { value: 'info', label: '안내 박스', previewStyle: { background: 'rgba(88, 166, 255, 0.16)' } },
  { value: 'note', label: '노트 박스', previewStyle: { background: 'rgba(125, 183, 255, 0.12)' } },
  { value: 'warning', label: '주의 박스', previewStyle: { background: 'rgba(255, 194, 87, 0.18)' } },
  { value: 'danger', label: '위험 박스', previewStyle: { background: 'rgba(255, 108, 108, 0.16)' } },
  { value: 'success', label: '성공 박스', previewStyle: { background: 'rgba(73, 217, 147, 0.16)' } },
  { value: 'quote', label: '인용 본문', previewStyle: { fontStyle: 'italic' } },
  { value: 'center', label: '중앙 본문', previewStyle: { textAlign: 'center' } },
  { value: 'divider', label: '구분 본문', previewStyle: { borderTop: '1px solid rgba(216, 236, 255, 0.24)' } },
];

const FONT_FAMILY_OPTIONS: RichTextDropdownOption[] = [
  { value: 'default', label: '기본 글꼴' },
  {
    value: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    label: '맑은 고딕',
    previewStyle: { fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  },
  {
    value: '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    label: '애플 고딕',
    previewStyle: { fontFamily: '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  },
  {
    value: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    label: '본고딕',
    previewStyle: { fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  },
  {
    value: '"Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    label: '프리텐다드',
    previewStyle: { fontFamily: '"Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  },
  {
    value: '"SUIT", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    label: 'SUIT',
    previewStyle: { fontFamily: '"SUIT", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  },
  {
    value: '"Spoqa Han Sans Neo", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    label: '스포카 한 산스',
    previewStyle: { fontFamily: '"Spoqa Han Sans Neo", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  },
  {
    value: '"Nanum Gothic", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    label: '나눔고딕',
    previewStyle: { fontFamily: '"Nanum Gothic", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  },
  {
    value: '"Nanum Myeongjo", "Batang", serif',
    label: '나눔명조',
    previewStyle: { fontFamily: '"Nanum Myeongjo", "Batang", serif' },
  },
  {
    value: '"KoPubWorld Dotum", "KoPub Dotum", "Malgun Gothic", sans-serif',
    label: 'KoPub 돋움',
    previewStyle: { fontFamily: '"KoPubWorld Dotum", "KoPub Dotum", "Malgun Gothic", sans-serif' },
  },
  {
    value: '"KoPubWorld Batang", "KoPub Batang", "Batang", serif',
    label: 'KoPub 바탕',
    previewStyle: { fontFamily: '"KoPubWorld Batang", "KoPub Batang", "Batang", serif' },
  },
  {
    value: '"Gmarket Sans", "GmarketSansMedium", "Malgun Gothic", sans-serif',
    label: 'G마켓 산스',
    previewStyle: { fontFamily: '"Gmarket Sans", "GmarketSansMedium", "Malgun Gothic", sans-serif' },
  },
  {
    value: '"BM DoHyeon", "BMDOHYEON", "Do Hyeon", "Malgun Gothic", sans-serif',
    label: '배민 도현',
    previewStyle: { fontFamily: '"BM DoHyeon", "BMDOHYEON", "Do Hyeon", "Malgun Gothic", sans-serif' },
  },
  {
    value: '"BM JUA", "BMJUA", "Jua", "Malgun Gothic", sans-serif',
    label: '배민 주아',
    previewStyle: { fontFamily: '"BM JUA", "BMJUA", "Jua", "Malgun Gothic", sans-serif' },
  },
  {
    value: '"BM HANNA Pro", "BMHANNAPro", "BM Hanna 11yrs Old", "Malgun Gothic", sans-serif',
    label: '배민 한나',
    previewStyle: { fontFamily: '"BM HANNA Pro", "BMHANNAPro", "BM Hanna 11yrs Old", "Malgun Gothic", sans-serif' },
  },
  {
    value: '"Black Han Sans", "Malgun Gothic", sans-serif',
    label: '검은고딕',
    previewStyle: { fontFamily: '"Black Han Sans", "Malgun Gothic", sans-serif' },
  },
  {
    value: '"Consolas", "D2Coding", monospace',
    label: '코딩',
    previewStyle: { fontFamily: '"Consolas", "D2Coding", monospace' },
  },
];

const FONT_SIZE_OPTIONS: RichTextDropdownOption[] = [
  { value: 'default', label: '기본 크기' },
  { value: '12px', label: '12px', previewStyle: { fontSize: '12px' } },
  { value: '14px', label: '14px', previewStyle: { fontSize: '14px' } },
  { value: '16px', label: '16px', previewStyle: { fontSize: '16px' } },
  { value: '18px', label: '18px', previewStyle: { fontSize: '18px' } },
  { value: '20px', label: '20px', previewStyle: { fontSize: '20px' } },
  { value: '24px', label: '24px', previewStyle: { fontSize: '24px' } },
  { value: '28px', label: '28px', previewStyle: { fontSize: '28px' } },
  { value: '32px', label: '32px', previewStyle: { fontSize: '32px' } },
];

const DEFAULT_RICH_TEXT_HTML = '<p></p>';

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  htmlSourceMode = false,
  onHtmlSourceModeChange,
  ariaLabelledBy,
}: RichTextEditorProps) {
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedHtmlRef = useRef<string | null>(null);
  const [toolbarRenderTick, setToolbarRenderTick] = useState(0);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      BodyParagraphStyle,
      NoticeImage,
      NoticeVideo,
      TextStyle,
      FontFamilyStyle,
      FontSizeStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      Link.configure({
        autolink: true,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
    ],
    content: normalizeEditorContent(value),
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      const nextHtml = updatedEditor.getHTML();
      lastEmittedHtmlRef.current = nextHtml;
      onChange(nextHtml);
    },
  });
  const activeBlockFormat = useMemo(() => getActiveBlockFormat(editor), [editor, toolbarRenderTick]);
  const activeBodyStyle = useMemo(() => getActiveBodyStyle(editor), [editor, toolbarRenderTick]);
  const activeFontFamily = useMemo(() => getActiveFontFamily(editor), [editor, toolbarRenderTick]);
  const activeFontSize = useMemo(() => getActiveFontSize(editor), [editor, toolbarRenderTick]);
  const canUseEditorToolbar = Boolean(editor && !disabled && editor.isEditable);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const refreshToolbarState = () => setToolbarRenderTick((current) => current + 1);

    editor.on('selectionUpdate', refreshToolbarState);
    editor.on('focus', refreshToolbarState);
    editor.on('blur', refreshToolbarState);
    return () => {
      editor.off('selectionUpdate', refreshToolbarState);
      editor.off('focus', refreshToolbarState);
      editor.off('blur', refreshToolbarState);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const normalizedValue = normalizeEditorContent(value);
    if (editor.getHTML() === normalizedValue) return;
    if (lastEmittedHtmlRef.current === normalizedValue) return;
    editor.commands.setContent(normalizedValue, { emitUpdate: false });
  }, [editor, value]);

  function applyLink() {
    if (!editor || disabled) return;
    const previousUrl = editor.getAttributes('link').href;
    const nextUrl = window.prompt('연결할 URL을 입력하세요.', previousUrl || 'https://');
    if (nextUrl === null) return;
    if (!nextUrl.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: nextUrl.trim() }).run();
  }

  function insertImageUrl() {
    if (!editor || disabled) return;
    const imageUrl = window.prompt('이미지 URL을 입력하세요.', 'https://');
    const src = normalizeMediaUrl(imageUrl);
    if (!src) return;
    editor.chain().focus().insertContent({
      type: 'noticeImage',
      attrs: { src, alt: '' },
    }).run();
  }

  function insertVideoUrl() {
    if (!editor || disabled) return;
    const videoUrl = window.prompt('동영상 URL을 입력하세요.', 'https://');
    const media = createVideoMediaAttrs(videoUrl);
    if (!media) return;
    editor.chain().focus().insertContent({
      type: 'noticeVideo',
      attrs: media,
    }).run();
  }

  function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!editor || disabled || !file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      window.alert('PNG, JPG, WEBP, GIF 이미지만 등록할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) return;
      editor.chain().focus().insertContent({
        type: 'noticeImage',
        attrs: { src, alt: file.name },
      }).run();
    });
    reader.readAsDataURL(file);
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  function applyBlockFormat(format: string) {
    if (!editor || disabled || !editor.isEditable) return;
    const chain = editor.chain().focus();
    if (format === 'paragraph') chain.setParagraph().run();
    if (format === 'heading2') chain.setHeading({ level: 2 }).run();
    if (format === 'heading3') chain.setHeading({ level: 3 }).run();
    if (format === 'blockquote') chain.setBlockquote().run();
    if (format === 'codeBlock') chain.setCodeBlock().run();
    setToolbarRenderTick((current) => current + 1);
  }

  function applyBodyStyle(bodyStyle: string) {
    if (!editor || disabled || !editor.isEditable) return;
    editor
      .chain()
      .focus()
      .setParagraph()
      .updateAttributes('paragraph', { bodyStyle: bodyStyle === 'default' ? null : bodyStyle })
      .run();
    setToolbarRenderTick((current) => current + 1);
  }

  function applyFontFamily(fontFamily: string) {
    if (!editor || disabled || !editor.isEditable) return;
    if (fontFamily === 'default') {
      editor.chain().focus().setMark('textStyle', { fontFamily: null }).run();
    } else {
      editor.chain().focus().setMark('textStyle', { fontFamily }).run();
    }
    setToolbarRenderTick((current) => current + 1);
  }

  function applyFontSize(fontSize: string) {
    if (!editor || disabled || !editor.isEditable) return;
    if (fontSize === 'default') {
      editor.chain().focus().setMark('textStyle', { fontSize: null }).run();
    } else {
      editor.chain().focus().setMark('textStyle', { fontSize }).run();
    }
    setToolbarRenderTick((current) => current + 1);
  }

  return (
    <div
      className="rich-text-editor"
      data-disabled={disabled ? 'true' : 'false'}
    >
      <div className="rich-text-toolbar" aria-label="내용 편집 도구">
        <RichTextDropdown
          label="문단 형식"
          value={activeBlockFormat}
          options={BLOCK_FORMAT_OPTIONS}
          disabled={!canUseEditorToolbar}
          onSelect={applyBlockFormat}
        />
        <RichTextDropdown
          label="본문 스타일"
          value={activeBodyStyle}
          options={BODY_STYLE_OPTIONS}
          disabled={!canUseEditorToolbar}
          onSelect={applyBodyStyle}
        />
        <RichTextDropdown
          label="글꼴"
          value={activeFontFamily}
          options={FONT_FAMILY_OPTIONS}
          disabled={!canUseEditorToolbar}
          onSelect={applyFontFamily}
        />
        <RichTextDropdown
          label="글자 크기"
          value={activeFontSize}
          options={FONT_SIZE_OPTIONS}
          disabled={!canUseEditorToolbar}
          onSelect={applyFontSize}
        />
        <button type="button" title="굵게" aria-label="굵게" disabled={disabled} className={editor?.isActive('bold') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold />
          <span>굵게</span>
        </button>
        <button type="button" title="기울임" aria-label="기울임" disabled={disabled} className={editor?.isActive('italic') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic />
          <span>기울임</span>
        </button>
        <button type="button" title="밑줄" aria-label="밑줄" disabled={disabled} className={editor?.isActive('underline') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon />
          <span>밑줄</span>
        </button>
        <button type="button" title="취소선" aria-label="취소선" disabled={disabled} className={editor?.isActive('strike') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough />
          <span>취소선</span>
        </button>
        <button type="button" title="아래첨자" aria-label="아래첨자" disabled={disabled} className={editor?.isActive('subscript') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleSubscript().run()}>
          <SubscriptIcon />
          <span>아래</span>
        </button>
        <button type="button" title="위첨자" aria-label="위첨자" disabled={disabled} className={editor?.isActive('superscript') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleSuperscript().run()}>
          <SuperscriptIcon />
          <span>위</span>
        </button>
        <button type="button" title="글머리 목록" aria-label="글머리 목록" disabled={disabled} className={editor?.isActive('bulletList') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List />
          <span>목록</span>
        </button>
        <button type="button" title="번호 목록" aria-label="번호 목록" disabled={disabled} className={editor?.isActive('orderedList') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
          <span>번호</span>
        </button>
        <button type="button" title="체크 목록" aria-label="체크 목록" disabled={disabled} className={editor?.isActive('taskList') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
          <CheckSquare />
          <span>체크</span>
        </button>
        <button type="button" title="왼쪽 정렬" aria-label="왼쪽 정렬" disabled={disabled} className={editor?.isActive({ textAlign: 'left' }) ? 'active' : ''} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
          <AlignLeft />
          <span>좌</span>
        </button>
        <button type="button" title="가운데 정렬" aria-label="가운데 정렬" disabled={disabled} className={editor?.isActive({ textAlign: 'center' }) ? 'active' : ''} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
          <AlignCenter />
          <span>중</span>
        </button>
        <button type="button" title="오른쪽 정렬" aria-label="오른쪽 정렬" disabled={disabled} className={editor?.isActive({ textAlign: 'right' }) ? 'active' : ''} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
          <AlignRight />
          <span>우</span>
        </button>
        <label className="rich-text-color-control" title="글자색">
          <Palette aria-hidden="true" />
          <input type="color" disabled={disabled} defaultValue="#eef7ff" onInput={(event) => editor?.chain().focus().setColor(event.currentTarget.value).run()} />
        </label>
        <label className="rich-text-color-control" title="배경색">
          <Highlighter aria-hidden="true" />
          <input type="color" disabled={disabled} defaultValue="#315dff" onInput={(event) => editor?.chain().focus().toggleHighlight({ color: event.currentTarget.value }).run()} />
        </label>
        <button
          type="button"
          title="하이라이트 해제"
          aria-label="하이라이트 해제"
          disabled={disabled}
          onClick={() => editor?.chain().focus().unsetHighlight().run()}
        >
          <Ban />
          <span>하이라이트 해제</span>
        </button>
        <button type="button" title="링크" aria-label="링크" disabled={disabled} className={editor?.isActive('link') ? 'active' : ''} onClick={applyLink}>
          <LinkIcon />
          <span>링크</span>
        </button>
        <button type="button" title="가로선" aria-label="가로선" disabled={disabled} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus />
          <span>선</span>
        </button>
        <button type="button" title="표 삽입" aria-label="표 삽입" disabled={disabled} onClick={insertTable}>
          <Table2 />
          <span>표</span>
        </button>
        <button type="button" title="행 추가" aria-label="행 추가" disabled={disabled || !editor?.can().addRowAfter()} onClick={() => editor?.chain().focus().addRowAfter().run()}>
          <Rows3 />
          <span>+</span>
        </button>
        <button type="button" title="열 추가" aria-label="열 추가" disabled={disabled || !editor?.can().addColumnAfter()} onClick={() => editor?.chain().focus().addColumnAfter().run()}>
          <Columns3 />
          <span>+</span>
        </button>
        <button type="button" title="행 삭제" aria-label="행 삭제" disabled={disabled || !editor?.can().deleteRow()} onClick={() => editor?.chain().focus().deleteRow().run()}>
          <Rows3 />
          <span>-</span>
        </button>
        <button type="button" title="열 삭제" aria-label="열 삭제" disabled={disabled || !editor?.can().deleteColumn()} onClick={() => editor?.chain().focus().deleteColumn().run()}>
          <Columns3 />
          <span>-</span>
        </button>
        <button type="button" title="표 삭제" aria-label="표 삭제" disabled={disabled || !editor?.can().deleteTable()} onClick={() => editor?.chain().focus().deleteTable().run()}>
          <Trash2 />
          <span>표-</span>
        </button>
        <button type="button" title="이미지 URL" aria-label="이미지 URL" disabled={disabled} onClick={insertImageUrl}>
          <Image />
          <span>이미지URL</span>
        </button>
        <button type="button" title="이미지 업로드" aria-label="이미지 업로드" disabled={disabled} onClick={() => imageUploadInputRef.current?.click()}>
          <ImageUp />
          <span>업로드</span>
        </button>
        <button type="button" title="동영상 URL" aria-label="동영상 URL" disabled={disabled} onClick={insertVideoUrl}>
          <Video />
          <span>동영상URL</span>
        </button>
        <button type="button" title="서식 지우기" aria-label="서식 지우기" disabled={disabled} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
          <Eraser />
          <span>지우기</span>
        </button>
        <button type="button" title="되돌리기" aria-label="되돌리기" disabled={disabled || !editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 />
          <span>되돌리기</span>
        </button>
        <button type="button" title="다시 실행" aria-label="다시 실행" disabled={disabled || !editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 />
          <span>다시</span>
        </button>
        {onHtmlSourceModeChange ? (
          <button
            type="button"
            title="HTML 적용"
            aria-label="HTML 적용"
            disabled={disabled}
            className={htmlSourceMode ? 'active' : ''}
            onClick={() => onHtmlSourceModeChange(!htmlSourceMode)}
          >
            <Code2 />
            <span>HTML</span>
          </button>
        ) : null}
        <input
          ref={imageUploadInputRef}
          className="rich-text-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={uploadImage}
          tabIndex={-1}
        />
      </div>
      {htmlSourceMode ? null : (
        <div className="rich-text-editor-content">
          <EditorContent editor={editor} aria-labelledby={ariaLabelledBy} />
        </div>
      )}
    </div>
  );
}

function RichTextDropdown({
  label,
  value,
  options,
  disabled,
  onSelect,
}: {
  label: string;
  value: string;
  options: RichTextDropdownOption[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  function toggleDropdown() {
    if (disabled) return;
    setIsOpen((current) => !current);
  }

  function selectOption(nextValue: string) {
    if (disabled) return;
    onSelect(nextValue);
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleDropdown();
  }

  useEffect(() => {
    if (!isOpen) return;

    function updateMenuPosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const width = Math.max(triggerRect.width, 132);
      const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - width - 8);
      const top = Math.min(triggerRect.bottom + 6, window.innerHeight - 8);
      setMenuStyle({
        left,
        top,
        width,
      });
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function closeFromOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof globalThis.Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      window.setTimeout(() => setIsOpen(false), 0);
    }

    document.addEventListener('pointerdown', closeFromOutside, true);
    return () => document.removeEventListener('pointerdown', closeFromOutside, true);
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className="rich-text-dropdown-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-open={isOpen ? 'true' : 'false'}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleDropdown();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {isOpen && typeof document !== 'undefined' ? createPortal(
        <div
          ref={menuRef}
          className="rich-text-dropdown-menu"
          role="menu"
          style={menuStyle}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? 'active' : ''}
              role="menuitem"
              style={option.previewStyle}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectOption(option.value);
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectOption(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function normalizeEditorContent(value: string): string {
  return value.trim() ? value : DEFAULT_RICH_TEXT_HTML;
}

function getActiveBlockFormat(editor: Editor | null): string {
  if (!editor) return 'paragraph';
  if (editor.isActive('heading', { level: 2 })) return 'heading2';
  if (editor.isActive('heading', { level: 3 })) return 'heading3';
  if (editor.isActive('blockquote')) return 'blockquote';
  if (editor.isActive('codeBlock')) return 'codeBlock';
  return 'paragraph';
}

function getActiveBodyStyle(editor: Editor | null): string {
  if (!editor || !editor.isActive('paragraph')) return 'default';
  const bodyStyle = editor.getAttributes('paragraph').bodyStyle;
  if (typeof bodyStyle !== 'string' || !bodyStyle.trim()) return 'default';
  return BODY_STYLE_OPTIONS.some((option) => option.value === bodyStyle) ? bodyStyle : 'default';
}

function getActiveFontFamily(editor: Editor | null): string {
  if (!editor) return 'default';
  const fontFamily = editor.getAttributes('textStyle').fontFamily;
  if (typeof fontFamily !== 'string' || !fontFamily.trim()) return 'default';
  return FONT_FAMILY_OPTIONS.some((option) => option.value === fontFamily) ? fontFamily : 'default';
}

function getActiveFontSize(editor: Editor | null): string {
  if (!editor) return 'default';
  const fontSize = editor.getAttributes('textStyle').fontSize;
  if (typeof fontSize !== 'string' || !fontSize.trim()) return 'default';
  return FONT_SIZE_OPTIONS.some((option) => option.value === fontSize) ? fontSize : 'default';
}

const BodyParagraphStyle = Extension.create({
  name: 'noticeBodyParagraphStyle',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          bodyStyle: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const className = element.getAttribute('class') ?? '';
              const match = className.match(/\bnotice-body-style-([a-z-]+)\b/);
              const bodyStyle = match?.[1] ?? '';
              return BODY_STYLE_OPTIONS.some((option) => option.value === bodyStyle) ? bodyStyle : null;
            },
            renderHTML: (attributes: { bodyStyle?: string | null }) => {
              if (!attributes.bodyStyle || attributes.bodyStyle === 'default') return {};
              return {
                class: `notice-body-style notice-body-style-${attributes.bodyStyle}`,
              };
            },
          },
        },
      },
    ];
  },
});

const FontFamilyStyle = Extension.create({
  name: 'noticeFontFamily',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontFamily || null,
            renderHTML: (attributes: { fontFamily?: string | null }) => {
              if (!attributes.fontFamily) return {};
              return { style: `font-family: ${attributes.fontFamily}` };
            },
          },
        },
      },
    ];
  },
});

const FontSizeStyle = Extension.create({
  name: 'noticeFontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const NoticeImage = Node.create({
  name: 'noticeImage',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { class: 'notice-editor-image' })];
  },
});

const NoticeVideo = Node.create({
  name: 'noticeVideo',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      kind: { default: 'embed' },
      title: { default: '공지 동영상' },
    };
  },

  parseHTML() {
    return [
      { tag: 'iframe[data-notice-video]' },
      { tag: 'video[data-notice-video]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, {
      class: 'notice-editor-video',
      'data-notice-video': 'true',
    });
    if (HTMLAttributes.kind === 'file') {
      return ['video', mergeAttributes(attrs, { controls: 'true' })];
    }
    return ['iframe', mergeAttributes(attrs, {
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: 'true',
      loading: 'lazy',
    })];
  },
});

function normalizeMediaUrl(value: string | null): string {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) return '';
  return url;
}

function createVideoMediaAttrs(value: string | null): { src: string; kind: 'embed' | 'file'; title: string } | null {
  const url = normalizeMediaUrl(value);
  if (!url) return null;
  const embedUrl = toEmbeddableVideoUrl(url);
  return {
    src: embedUrl,
    kind: /\.(mp4|webm|ogg)(\?|#|$)/i.test(embedUrl) ? 'file' : 'embed',
    title: '공지 동영상',
  };
}

function toEmbeddableVideoUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('youtube.com')) {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (parsedUrl.hostname === 'youtu.be') {
      const videoId = parsedUrl.pathname.replace('/', '');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (parsedUrl.hostname.includes('vimeo.com')) {
      const videoId = parsedUrl.pathname.split('/').filter(Boolean).at(-1);
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    return url;
  }
  return url;
}
