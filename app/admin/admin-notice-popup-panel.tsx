'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { NoticePopupRecord } from '../../src/server/chart-service/repository.ts';
import { DeleteActionIcon, EditActionIcon } from '../shared/action-icons';
import { IconButton } from '../shared/icon-button';
import { NumberStepper } from '../shared/number-stepper';
import { RichTextEditor } from '../shared/rich-text-editor';
import { AdminRefreshButton } from './admin-refresh-button';
import { dispatchAdminRefreshEvent } from './admin-refresh-events';

type NoticePopupEditor = Pick<
  NoticePopupRecord,
  'bodyHtml' | 'endAt' | 'id' | 'isActive' | 'sortOrder' | 'startAt' | 'title'
>;

const emptyDraft: NoticePopupEditor = {
  id: '',
  title: '',
  bodyHtml: '<p></p>',
  isActive: true,
  sortOrder: 10,
  startAt: null,
  endAt: null,
};

export function AdminNoticePopupPanel() {
  const [popups, setPopups] = useState<NoticePopupRecord[]>([]);
  const [draft, setDraft] = useState<NoticePopupEditor>(emptyDraft);
  const [isHtmlSourceMode, setIsHtmlSourceMode] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [message, setMessage] = useState('공지팝업을 불러오는 중입니다.');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsBusy(true);
    const response = await fetch('/api/admin/notice-popups');
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '공지팝업을 불러오지 못했습니다.');
      return;
    }
    setPopups(normalizeNoticePopups(payload.popups));
    setMessage('랜딩페이지에 노출할 공지팝업 제목과 내용을 관리합니다.');
  }

  async function savePopup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const response = await fetch('/api/admin/notice-popups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '공지팝업 저장에 실패했습니다.');
      return;
    }
    setDraft(emptyDraft);
    await refresh();
    setViewMode('list');
    setIsHtmlSourceMode(false);
    setMessage('공지팝업을 저장했습니다. 활성 상태라면 사용자 화면에 반영됩니다.');
    dispatchAdminRefreshEvent({ source: 'webInfo' });
  }

  async function deletePopup(id: string) {
    if (!window.confirm('공지팝업을 삭제할까요?')) return;
    setIsBusy(true);
    const response = await fetch('/api/admin/notice-popups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(payload.message || '공지팝업 삭제에 실패했습니다.');
      return;
    }
    if (draft.id === id) setDraft(emptyDraft);
    await refresh();
    setViewMode('list');
    setMessage('공지팝업을 삭제했습니다.');
    dispatchAdminRefreshEvent({ source: 'webInfo' });
  }

  function editPopup(popup: NoticePopupRecord) {
    setDraft({
      id: popup.id,
      title: popup.title,
      bodyHtml: popup.bodyHtml,
      isActive: popup.isActive,
      sortOrder: popup.sortOrder,
      startAt: popup.startAt,
      endAt: popup.endAt,
    });
    setViewMode('form');
    setIsHtmlSourceMode(false);
    setMessage('선택한 공지팝업을 수정 중입니다.');
  }

  function startNewPopup() {
    setDraft(emptyDraft);
    setIsHtmlSourceMode(false);
    setViewMode('form');
    setMessage('새 공지팝업을 작성합니다.');
  }

  function backToList() {
    setDraft(emptyDraft);
    setIsHtmlSourceMode(false);
    setViewMode('list');
    setMessage('공지팝업 목록입니다. 작성, 수정, 삭제 작업을 선택하세요.');
  }

  return (
    <section className="card wide admin-notice-popup-panel" id="admin-notice-popup">
      <div className="toolbar">
        <div>
          <h2>공지팝업</h2>
          <p className="notice compact">제목과 HTML 내용을 작성하면 활성 공지가 사용자 화면에 팝업으로 표시됩니다.</p>
        </div>
        <div className="toolbar-actions">
          {viewMode === 'form' ? (
            <IconButton label="목록으로 돌아가기" onClick={backToList} disabled={isBusy}>
              <ArrowLeft />
            </IconButton>
          ) : (
            <IconButton label="공지글 작성" onClick={startNewPopup} disabled={isBusy}>
              <Plus />
            </IconButton>
          )}
          <AdminRefreshButton onClick={() => void refresh()} disabled={isBusy} />
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="admin-notice-popup-table-wrap">
          <table className="table admin-notice-popup-table">
            <thead>
              <tr>
                <th>제목</th>
                <th>표시</th>
                <th>순서</th>
                <th>노출 기간</th>
                <th>수정일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {popups.length > 0 ? popups.map((popup) => (
                <tr key={popup.id}>
                  <td>
                    <strong>{popup.title}</strong>
                    <small>{stripHtmlPreview(popup.bodyHtml)}</small>
                  </td>
                  <td>{popup.isActive ? '표시' : '숨김'}</td>
                  <td>{popup.sortOrder}</td>
                  <td>{formatNoticePopupSchedule(popup)}</td>
                  <td>{formatNoticePopupDate(popup.updatedAt)}</td>
                  <td>
                    <div className="admin-notice-popup-actions">
                      <IconButton className="action-icon-button edit" label="공지팝업 수정" onClick={() => editPopup(popup)} disabled={isBusy}>
                        <EditActionIcon />
                      </IconButton>
                      <IconButton className="action-icon-button delete" label="공지팝업 삭제" onClick={() => void deletePopup(popup.id)} disabled={isBusy}>
                        <DeleteActionIcon />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6}>등록된 공지팝업이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <form className="form admin-notice-popup-form" onSubmit={savePopup}>
        <div className="admin-notice-popup-fields">
          <label htmlFor="notice-popup-title">
            제목
            <input
              id="notice-popup-title"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </label>
          <label className="admin-notice-popup-sort-field" htmlFor="notice-popup-sort-order">
            표시 순서
            <NumberStepper
              id="notice-popup-sort-order"
              value={draft.sortOrder}
              onChange={(sortOrder) => setDraft((current) => ({ ...current, sortOrder }))}
              step={1}
              disabled={isBusy}
            />
          </label>
          <label className="inline-check admin-notice-popup-active" htmlFor="notice-popup-active">
            <input
              checked={draft.isActive}
              id="notice-popup-active"
              type="checkbox"
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            사용자 화면에 표시
          </label>
        </div>
        <NoticePopupSchedulePicker
          disabled={isBusy}
          endAt={draft.endAt}
          startAt={draft.startAt}
          onChange={(schedule) => setDraft((current) => ({ ...current, ...schedule }))}
        />
        <div className="admin-notice-popup-editor-label">
          <span id="notice-popup-body-label">내용</span>
          <RichTextEditor
            ariaLabelledBy="notice-popup-body-label"
            value={draft.bodyHtml}
            onChange={(bodyHtml) => setDraft((current) => ({ ...current, bodyHtml }))}
            disabled={isBusy}
            htmlSourceMode={isHtmlSourceMode}
            onHtmlSourceModeChange={setIsHtmlSourceMode}
          />
          {isHtmlSourceMode && (
            <textarea
              className="admin-notice-popup-html-source"
              rows={12}
              value={draft.bodyHtml}
              onChange={(event) => setDraft((current) => ({ ...current, bodyHtml: event.target.value }))}
              disabled={isBusy}
            />
          )}
        </div>
        <div className="toolbar-actions">
          {draft.id ? (
            <button className="button ghost" type="button" onClick={() => setDraft(emptyDraft)} disabled={isBusy}>
              새 공지 작성
            </button>
          ) : null}
          <button className="button" type="submit" disabled={isBusy}>
            {draft.id ? '수정 저장' : '공지 등록'}
          </button>
        </div>
      </form>
      )}
      <p className="notice">{message}</p>
    </section>
  );
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const DEFAULT_START_TIME = '00:00';
const DEFAULT_END_TIME = '23:59';

type NoticePopupScheduleValue = Pick<NoticePopupEditor, 'endAt' | 'startAt'>;

function NoticePopupSchedulePicker({
  disabled,
  endAt,
  onChange,
  startAt,
}: {
  disabled: boolean;
  endAt: string | null;
  onChange: (schedule: NoticePopupScheduleValue) => void;
  startAt: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState(() => getCalendarBaseMonth(startAt));
  const [rightMonth, setRightMonth] = useState(() => addMonths(getCalendarBaseMonth(startAt), 1));
  const startDateValue = getLocalDateInputValue(startAt);
  const endDateValue = getLocalDateInputValue(endAt);
  const startTimeValue = getLocalTimeInputValue(startAt, DEFAULT_START_TIME);
  const endTimeValue = getLocalTimeInputValue(endAt, DEFAULT_END_TIME);

  useEffect(() => {
    if (!isOpen) {
      const baseMonth = getCalendarBaseMonth(startAt);
      setLeftMonth(baseMonth);
      setRightMonth(addMonths(baseMonth, 1));
    }
  }, [isOpen, startAt]);

  function emitSchedule(nextStartAt: string | null, nextEndAt: string | null) {
    if (nextStartAt && nextEndAt && Date.parse(nextEndAt) < Date.parse(nextStartAt)) {
      onChange({ startAt: nextStartAt, endAt: null });
      return;
    }
    onChange({ startAt: nextStartAt, endAt: nextEndAt });
  }

  function pickDate(dateKey: string) {
    if (!startDateValue || endDateValue || dateKey < startDateValue) {
      emitSchedule(mergeLocalDateAndTime(dateKey, startTimeValue), null);
      return;
    }
    emitSchedule(startAt, mergeLocalDateAndTime(dateKey, endTimeValue));
  }

  function updateStartTime(timeValue: string) {
    if (!startDateValue) return;
    emitSchedule(mergeLocalDateAndTime(startDateValue, timeValue), endAt);
  }

  function updateEndTime(timeValue: string) {
    if (!endDateValue) return;
    emitSchedule(startAt, mergeLocalDateAndTime(endDateValue, timeValue));
  }

  function clearSchedule() {
    onChange({ startAt: null, endAt: null });
  }

  return (
    <section className="admin-notice-popup-schedule-picker" aria-label="공지 노출 기간">
      <div className="admin-notice-popup-schedule-head">
        <div>
          <span>공지 노출 기간</span>
          <strong>{formatNoticePopupSchedule({ startAt, endAt })}</strong>
        </div>
        <button
          className="button secondary admin-notice-popup-schedule-trigger"
          disabled={disabled}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <CalendarClock aria-hidden="true" />
          기간 선택
        </button>
      </div>

      {isOpen ? (
        <div className="admin-notice-popup-calendar-popover">
          <div className="admin-notice-popup-calendar-grid">
            <NoticePopupCalendarMonth
              disabled={disabled}
              endDateValue={endDateValue}
              month={leftMonth}
              onNextMonth={() => setLeftMonth((current) => addMonths(current, 1))}
              onPickDate={pickDate}
              onPreviousMonth={() => setLeftMonth((current) => addMonths(current, -1))}
              startDateValue={startDateValue}
            />
            <NoticePopupCalendarMonth
              disabled={disabled}
              endDateValue={endDateValue}
              month={rightMonth}
              onNextMonth={() => setRightMonth((current) => addMonths(current, 1))}
              onPickDate={pickDate}
              onPreviousMonth={() => setRightMonth((current) => addMonths(current, -1))}
              startDateValue={startDateValue}
            />
          </div>
          <div className="admin-notice-popup-time-grid">
            <label htmlFor="notice-popup-start-time">
              시작 시:분
              <input
                disabled={disabled || !startDateValue}
                id="notice-popup-start-time"
                type="time"
                value={startDateValue ? startTimeValue : DEFAULT_START_TIME}
                onChange={(event) => updateStartTime(event.target.value)}
              />
            </label>
            <label htmlFor="notice-popup-end-time">
              종료 시:분
              <input
                disabled={disabled || !endDateValue}
                id="notice-popup-end-time"
                type="time"
                value={endDateValue ? endTimeValue : DEFAULT_END_TIME}
                onChange={(event) => updateEndTime(event.target.value)}
              />
            </label>
            <button className="button ghost" disabled={disabled || (!startAt && !endAt)} type="button" onClick={clearSchedule}>
              기간 초기화
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NoticePopupCalendarMonth({
  disabled,
  endDateValue,
  month,
  onNextMonth,
  onPickDate,
  onPreviousMonth,
  startDateValue,
}: {
  disabled: boolean;
  endDateValue: string;
  month: Date;
  onNextMonth: () => void;
  onPickDate: (dateKey: string) => void;
  onPreviousMonth: () => void;
  startDateValue: string;
}) {
  const days = buildCalendarDays(month);

  return (
    <div className="notice-popup-calendar-month">
      <div className="notice-popup-calendar-month-header">
        <IconButton label={`${formatNoticePopupMonth(month)} 이전 달`} onClick={onPreviousMonth} disabled={disabled}>
          <ChevronLeft />
        </IconButton>
        <strong>{formatNoticePopupMonth(month)}</strong>
        <IconButton label={`${formatNoticePopupMonth(month)} 다음 달`} onClick={onNextMonth} disabled={disabled}>
          <ChevronRight />
        </IconButton>
      </div>
      <div className="notice-popup-calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="notice-popup-calendar-days">
        {days.map(({ date }, index) => {
          if (!date) {
            return <span aria-hidden="true" className="notice-popup-calendar-day notice-popup-calendar-blank" key={`blank-${getLocalMonthKey(month)}-${index}`} />;
          }
          const dateKey = getLocalDateKey(date);
          const isRangeStart = dateKey === startDateValue;
          const isRangeEnd = dateKey === endDateValue;
          const isInRange = Boolean(startDateValue && endDateValue && dateKey > startDateValue && dateKey < endDateValue);
          const dayClasses = [
            'notice-popup-calendar-day',
            isInRange ? 'in-range' : '',
            isRangeStart ? 'selected range-start' : '',
            isRangeEnd ? 'selected range-end' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              aria-pressed={isRangeStart || isRangeEnd}
              className={dayClasses}
              disabled={disabled}
              key={dateKey}
              type="button"
              onClick={() => onPickDate(dateKey)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function normalizeNoticePopups(popups: unknown): NoticePopupRecord[] {
  if (!Array.isArray(popups)) return [];
  return popups.filter((popup): popup is NoticePopupRecord => (
    typeof popup?.id === 'string' &&
    typeof popup.title === 'string' &&
    typeof popup.bodyHtml === 'string'
  )).map((popup) => ({
    ...popup,
    startAt: typeof popup.startAt === 'string' ? popup.startAt : null,
    endAt: typeof popup.endAt === 'string' ? popup.endAt : null,
  }));
}

function stripHtmlPreview(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '미리보기 없음';
}

function formatNoticePopupDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatNoticePopupSchedule(value: NoticePopupScheduleValue): string {
  if (!value.startAt && !value.endAt) return '상시 노출';
  if (value.startAt && value.endAt) {
    return `${formatNoticePopupDateTime(value.startAt)} ~ ${formatNoticePopupDateTime(value.endAt)}`;
  }
  if (value.startAt) return `${formatNoticePopupDateTime(value.startAt)}부터`;
  return `${formatNoticePopupDateTime(value.endAt)}까지`;
}

function formatNoticePopupDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNoticePopupMonth(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
}

function getCalendarBaseMonth(value: string | null): Date {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return getMonthStart(new Date());
  return getMonthStart(date);
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarDays(month: Date): Array<{ date: Date | null }> {
  const firstDay = getMonthStart(month);
  const leadingBlankCount = firstDay.getDay();
  const weekCount = getCalendarWeekCount(month);
  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const dayOfMonth = index - leadingBlankCount + 1;
    const daysInMonth = getDaysInMonth(month);
    return {
      date: dayOfMonth >= 1 && dayOfMonth <= daysInMonth
        ? new Date(month.getFullYear(), month.getMonth(), dayOfMonth)
        : null,
    };
  });
}

function getCalendarWeekCount(month: Date): number {
  const firstDay = getMonthStart(month);
  return Math.ceil((firstDay.getDay() + getDaysInMonth(month)) / 7);
}

function getDaysInMonth(month: Date): number {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

function getLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getLocalMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getLocalDateInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return getLocalDateKey(date);
}

function getLocalTimeInputValue(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function mergeLocalDateAndTime(dateValue: string, timeValue: string): string | null {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return new Date(year, month - 1, day, hour, minute).toISOString();
}
