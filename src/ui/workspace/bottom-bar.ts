type TimezoneChartLike = {
  config: {
    timezone: string;
  };
  activePanels?: string[];
  getPanelRatio?: (id: string) => number;
  jumpToLatest?: () => void;
  panViewport?: (shiftBars: number) => void;
  zoomByCandles?: (deltaVisible: number) => void;
};

export type BottomBarPaneLike<TChart extends TimezoneChartLike> = {
  chart: TChart;
  chartArea?: HTMLDivElement;
};

type CreateBottomBarArgs<TChart extends TimezoneChartLike> = {
  app: HTMLElement;
  rangeButtons: readonly string[];
  bottomOffset?: number;
  leftInset?: number;
  getActivePane: () => BottomBarPaneLike<TChart>;
  onApplyRange: (label: string) => void;
  onApplyDateRange?: (fromSec: number, toSec: number) => void;
  onGoToDateTime?: (targetSec: number, label: string) => void;
  onOpenTimezone: (chart: TChart, onUpdated: () => void) => void;
  formatDateWithTimezone: (date: Date, timezone: string, options: Intl.DateTimeFormatOptions) => string;
  formatTimezoneLabel: (timezone: string) => string;
};

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const dt = new Date(`${ymd}T00:00:00`);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function createBottomBar<TChart extends TimezoneChartLike>({
  app,
  rangeButtons,
  bottomOffset = 0,
  leftInset = 0,
  getActivePane,
  onApplyRange,
  onApplyDateRange,
  onGoToDateTime,
  onOpenTimezone,
  formatDateWithTimezone,
  formatTimezoneLabel,
}: CreateBottomBarArgs<TChart>): HTMLDivElement {
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = `position:absolute;left:${leftInset}px;right:0;bottom:${bottomOffset}px;height:32px;
    background:#131722;border-top:1px solid #2a2e3e;display:flex;align-items:center;
    justify-content:space-between;padding:0 10px;z-index:1000;color:#c0c4cc;
    font-family:'Segoe UI',Arial,sans-serif;font-size:11px;`;
  app.appendChild(bottomBar);

  const CALENDAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17,10.039c-3.859,0-7,3.14-7,7,0,3.838,3.141,6.961,7,6.961s7-3.14,7-7c0-3.838-3.141-6.961-7-6.961Zm0,11.961c-2.757,0-5-2.226-5-4.961,0-2.757,2.243-5,5-5s5,2.226,5,4.961c0,2.757-2.243,5-5,5Zm1.707-4.707c.391,.391,.391,1.023,0,1.414-.195,.195-.451,.293-.707,.293s-.512-.098-.707-.293l-1-1c-.188-.188-.293-.442-.293-.707v-2c0-.552,.447-1,1-1s1,.448,1,1v1.586l.707,.707Zm5.293-10.293v2c0,.552-.447,1-1,1s-1-.448-1-1v-2c0-1.654-1.346-3-3-3H5c-1.654,0-3,1.346-3,3v1H11c.552,0,1,.448,1,1s-.448,1-1,1H2v9c0,1.654,1.346,3,3,3h4c.552,0,1,.448,1,1s-.448,1-1,1H5c-2.757,0-5-2.243-5-5V7C0,4.243,2.243,2,5,2h1V1c0-.552,.448-1,1-1s1,.448,1,1v1h8V1c0-.552,.447-1,1-1s1,.448,1,1v1h1c2.757,0,5,2.243,5,5Z"/></svg>`;
  const CLOCK_SVG_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 7.5v4.8l3.2 1.8'/%3E%3C/svg%3E";
  const CALENDAR_SMALL_SVG_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3.5' y='5.5' width='17' height='15' rx='2.2'/%3E%3Cpath d='M7.5 3.8v3.4M16.5 3.8v3.4M3.5 9.5h17'/%3E%3C/svg%3E";
  const CHEVRON_LEFT_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="14 6 8 12 14 18"/></svg>`;
  const CHEVRON_RIGHT_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 6 16 12 10 18"/></svg>`;

  const datePicker = document.createElement('div');
  datePicker.style.cssText = `position:absolute;background:#ffffff;border:1px solid #d1d5db;border-radius:10px;
    padding:14px;display:none;z-index:1100;box-shadow:0 14px 30px rgba(0,0,0,0.3);
    font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111827;min-width:288px;box-sizing:border-box;`;
  app.appendChild(datePicker);

  const buildTimeOptions = (): string[] => {
    const out: string[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 15) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        out.push(`${hh}:${mm}`);
      }
    }
    return out;
  };
  const TIME_OPTIONS = buildTimeOptions();

  const DATE_CELL_BASE = 'height:34px;border:1px solid #d1d5db;border-radius:7px;padding:0 10px;font-size:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;background:#fff;color:#111827;';

  datePicker.innerHTML = `
    <style>
      .sigma-time-trigger{
        width:96px;height:34px;border:1px solid #d1d5db;border-radius:7px;
        padding:0 30px 0 8px;font-size:14px;font-weight:400;line-height:34px;color:#111827;background-color:#fff;
        text-align:left;cursor:pointer;
        background-image:url("${CLOCK_SVG_DATA_URI}");
        background-repeat:no-repeat;background-position:right 8px center;background-size:16px 16px;
      }
      .sigma-time-trigger:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 1px #2563eb inset;}
      .sigma-time-trigger.disabled{opacity:.5;background-color:#f3f4f6;cursor:not-allowed;}
      .sigma-time-menu{
        position:absolute;z-index:1200;width:96px;max-height:230px;overflow-y:auto;
        background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 10px 20px rgba(0,0,0,0.16);
        padding:4px 0;
      }
      .sigma-time-item{width:100%;height:32px;border:none;background:#fff;color:#111827;font-size:14px;font-weight:400;line-height:32px;text-align:left;padding:0 12px;cursor:pointer;}
      .sigma-time-item:hover{background:#f3f4f6;}
      .sigma-time-item.active{background:#111827;color:#fff;border-radius:6px;}
      .sigma-time-menu::-webkit-scrollbar{width:10px;}
      .sigma-time-menu::-webkit-scrollbar-track{background:#f3f4f6;border-radius:8px;}
      .sigma-time-menu::-webkit-scrollbar-thumb{background:#9ca3af;border-radius:8px;border:2px solid #f3f4f6;}
      .sigma-time-menu::-webkit-scrollbar-thumb:hover{background:#6b7280;}
      .sigma-date-icon{
        width:20px;height:20px;display:inline-block;opacity:.85;flex:0 0 20px;
        background-image:url("${CALENDAR_SMALL_SVG_DATA_URI}");
        background-repeat:no-repeat;background-position:center;background-size:20px 20px;
      }
      .sigma-cal-nav-btn{
        width:28px;height:28px;border:none;border-radius:7px;background:transparent;color:#111827;
        display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;
      }
      .sigma-cal-nav-btn:hover{background:#f3f4f6;}
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:28px;font-weight:800;line-height:1;color:#111827;">가기</div>
      <button type="button" data-k="close" style="border:none;background:transparent;color:#4b5563;font-size:20px;cursor:pointer;padding:0 4px;">✕</button>
    </div>
    <div data-k="tab-wrap" style="position:relative;display:flex;gap:18px;border-bottom:1px solid #e5e7eb;margin-bottom:10px;">
      <button type="button" data-k="tab-date" style="border:none;background:transparent;padding:8px 0;color:#111827;font-weight:700;cursor:pointer;">날짜</button>
      <button type="button" data-k="tab-range" style="border:none;background:transparent;padding:8px 0;color:#6b7280;font-weight:700;cursor:pointer;">기간설정</button>
      <div data-k="tab-underline" style="position:absolute;left:0;bottom:-1px;height:3px;width:0;background:#111827;border-radius:2px;transition:left .22s ease,width .22s ease;"></div>
    </div>
    <div data-k="panel-date" style="display:block;min-height:76px;">
      <div style="display:flex;gap:8px;">
        <button type="button" data-k="single-date-btn" style="${DATE_CELL_BASE}flex:1;"><span data-k="single-date-text"></span><span class="sigma-date-icon" aria-hidden="true"></span></button>
        <button type="button" data-k="single-time" class="sigma-time-trigger">00:00</button>
      </div>
    </div>
    <div data-k="panel-range" style="display:none;min-height:76px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button type="button" data-k="range-start-btn" style="${DATE_CELL_BASE}flex:1;"><span data-k="range-start-text"></span><span class="sigma-date-icon" aria-hidden="true"></span></button>
        <button type="button" data-k="range-start-time" class="sigma-time-trigger">00:00</button>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="button" data-k="range-end-btn" style="${DATE_CELL_BASE}flex:1;"><span data-k="range-end-text"></span><span class="sigma-date-icon" aria-hidden="true"></span></button>
        <button type="button" data-k="range-end-time" class="sigma-time-trigger">00:00</button>
      </div>
      <div data-k="range-time-hint" style="font-size:11px;color:#6b7280;margin-top:7px;display:none;">1년 초과 범위는 시간 선택이 비활성화됩니다.</div>
    </div>
    <div style="margin-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <button type="button" data-k="cal-prev" class="sigma-cal-nav-btn">${CHEVRON_LEFT_SVG}</button>
        <div data-k="cal-month" style="font-size:12px;font-weight:500;color:#111827;"></div>
        <button type="button" data-k="cal-next" class="sigma-cal-nav-btn">${CHEVRON_RIGHT_SVG}</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;color:#6b7280;text-align:center;font-size:12px;">
        <div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div><div>일</div>
      </div>
      <div data-k="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
      <button data-k="cancel" type="button" style="height:34px;padding:0 14px;background:#fff;border:1px solid #9ca3af;color:#111827;border-radius:8px;cursor:pointer;font-size:12px;">취소</button>
      <button data-k="apply" type="button" style="height:34px;padding:0 14px;background:#111827;border:1px solid #111827;color:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">가기</button>
    </div>`;

  const tabDateBtn = datePicker.querySelector('[data-k="tab-date"]') as HTMLButtonElement;
  const tabRangeBtn = datePicker.querySelector('[data-k="tab-range"]') as HTMLButtonElement;
  const tabWrap = datePicker.querySelector('[data-k="tab-wrap"]') as HTMLDivElement;
  const tabUnderline = datePicker.querySelector('[data-k="tab-underline"]') as HTMLDivElement;
  const panelDate = datePicker.querySelector('[data-k="panel-date"]') as HTMLDivElement;
  const panelRange = datePicker.querySelector('[data-k="panel-range"]') as HTMLDivElement;
  const singleDateBtn = datePicker.querySelector('[data-k="single-date-btn"]') as HTMLButtonElement;
  const singleDateText = datePicker.querySelector('[data-k="single-date-text"]') as HTMLSpanElement;
  const singleTimeInput = datePicker.querySelector('[data-k="single-time"]') as HTMLButtonElement;
  const rangeStartBtn = datePicker.querySelector('[data-k="range-start-btn"]') as HTMLButtonElement;
  const rangeStartText = datePicker.querySelector('[data-k="range-start-text"]') as HTMLSpanElement;
  const rangeStartTimeInput = datePicker.querySelector('[data-k="range-start-time"]') as HTMLButtonElement;
  const rangeEndBtn = datePicker.querySelector('[data-k="range-end-btn"]') as HTMLButtonElement;
  const rangeEndText = datePicker.querySelector('[data-k="range-end-text"]') as HTMLSpanElement;
  const rangeEndTimeInput = datePicker.querySelector('[data-k="range-end-time"]') as HTMLButtonElement;
  const rangeTimeHint = datePicker.querySelector('[data-k="range-time-hint"]') as HTMLDivElement;
  const calPrevBtn = datePicker.querySelector('[data-k="cal-prev"]') as HTMLButtonElement;
  const calNextBtn = datePicker.querySelector('[data-k="cal-next"]') as HTMLButtonElement;
  const calMonthEl = datePicker.querySelector('[data-k="cal-month"]') as HTMLDivElement;
  const calGridEl = datePicker.querySelector('[data-k="cal-grid"]') as HTMLDivElement;
  const dpApplyBtn = datePicker.querySelector('[data-k="apply"]') as HTMLButtonElement;
  const dpCancelBtn = datePicker.querySelector('[data-k="cancel"]') as HTMLButtonElement;
  const dpCloseBtn = datePicker.querySelector('[data-k="close"]') as HTMLButtonElement;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  let activeDateTab: 'date' | 'range' = 'date';
  let activeRangeField: 'start' | 'end' = 'start';
  let calCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let singleDateYmd = toYmd(new Date());
  let rangeStartYmd = toYmd(new Date());
  let rangeEndYmd = toYmd(new Date());

  let calBtn: HTMLButtonElement | null = null;
  let openTimeMenuEl: HTMLDivElement | null = null;

  const createTimeDropdown = (trigger: HTMLButtonElement) => {
    let value = trigger.textContent?.trim() || '00:00';
    let disabled = false;
    const getValue = () => value;
    const setValue = (next: string) => {
      value = TIME_OPTIONS.includes(next) ? next : '00:00';
      trigger.textContent = value;
    };
    const setDisabled = (next: boolean) => {
      disabled = next;
      trigger.classList.toggle('disabled', disabled);
    };
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (disabled) return;
      openTimeMenuEl?.remove();
      openTimeMenuEl = document.createElement('div');
      openTimeMenuEl.className = 'sigma-time-menu';
      openTimeMenuEl.innerHTML = TIME_OPTIONS.map((t) => (
        `<button type="button" class="sigma-time-item${t === value ? ' active' : ''}" data-time="${t}">${t}</button>`
      )).join('');
      app.appendChild(openTimeMenuEl);
      const tr = trigger.getBoundingClientRect();
      const ar = app.getBoundingClientRect();
      openTimeMenuEl.style.left = `${tr.left - ar.left}px`;
      openTimeMenuEl.style.top = `${tr.bottom - ar.top + 4}px`;
      openTimeMenuEl.querySelectorAll('.sigma-time-item').forEach((el) => {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const picked = (el as HTMLButtonElement).dataset.time || '00:00';
          setValue(picked);
          openTimeMenuEl?.remove();
          openTimeMenuEl = null;
        });
      });
      const active = openTimeMenuEl.querySelector('.sigma-time-item.active') as HTMLButtonElement | null;
      active?.scrollIntoView({ block: 'center' });
    });
    return { getValue, setValue, setDisabled };
  };
  const singleTime = createTimeDropdown(singleTimeInput);
  const rangeStartTime = createTimeDropdown(rangeStartTimeInput);
  const rangeEndTime = createTimeDropdown(rangeEndTimeInput);

  const parseDateTimeSec = (dateText: string, timeText: string): number => {
    if (!dateText) return NaN;
    const safeTime = timeText && /^\d{2}:\d{2}$/.test(timeText) ? timeText : '00:00';
    const ms = new Date(`${dateText}T${safeTime}:00`).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
  };

  const updateRangeTimeLock = () => {
    const from = parseYmd(rangeStartYmd)?.getTime() ?? NaN;
    const to = parseYmd(rangeEndYmd)?.getTime() ?? NaN;
    const disabled = Number.isFinite(from) && Number.isFinite(to) && Math.abs(to - from) > 365 * MS_PER_DAY;
    rangeStartTime.setDisabled(disabled);
    rangeEndTime.setDisabled(disabled);
    rangeTimeHint.style.display = disabled ? 'block' : 'none';
    if (disabled) {
      rangeStartTime.setValue('00:00');
      rangeEndTime.setValue('00:00');
    }
  };

  const applyTabStyles = () => {
    const isDate = activeDateTab === 'date';
    tabDateBtn.style.color = isDate ? '#111827' : '#6b7280';
    tabRangeBtn.style.color = isDate ? '#6b7280' : '#111827';
    panelDate.style.display = isDate ? 'block' : 'none';
    panelRange.style.display = isDate ? 'none' : 'block';
    const activeBtn = isDate ? tabDateBtn : tabRangeBtn;
    const wrapRect = tabWrap.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    tabUnderline.style.left = `${Math.max(0, btnRect.left - wrapRect.left)}px`;
    tabUnderline.style.width = `${btnRect.width}px`;
  };

  const updateDateFieldStyles = () => {
    singleDateBtn.style.borderColor = activeDateTab === 'date' ? '#3b82f6' : '#d1d5db';
    singleDateBtn.style.boxShadow = activeDateTab === 'date' ? '0 0 0 1px #3b82f6 inset' : 'none';
    const startActive = activeDateTab === 'range' && activeRangeField === 'start';
    const endActive = activeDateTab === 'range' && activeRangeField === 'end';
    rangeStartBtn.style.borderColor = startActive ? '#3b82f6' : '#d1d5db';
    rangeStartBtn.style.boxShadow = startActive ? '0 0 0 1px #3b82f6 inset' : 'none';
    rangeEndBtn.style.borderColor = endActive ? '#3b82f6' : '#d1d5db';
    rangeEndBtn.style.boxShadow = endActive ? '0 0 0 1px #3b82f6 inset' : 'none';

    singleDateText.textContent = singleDateYmd;
    rangeStartText.textContent = rangeStartYmd;
    rangeEndText.textContent = rangeEndYmd;
  };

  const getActiveSelectedYmd = (): string => {
    if (activeDateTab === 'date') return singleDateYmd;
    return activeRangeField === 'start' ? rangeStartYmd : rangeEndYmd;
  };

  const renderCalendar = () => {
    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    calMonthEl.textContent = `${m + 1}월 ${y}`;
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const todayYmd = toYmd(new Date());
    const selectedYmd = getActiveSelectedYmd();

    const cells: string[] = [];
    for (let i = 0; i < startOffset; i += 1) {
      cells.push('<div style="height:34px;"></div>');
    }
    for (let d = 1; d <= days; d += 1) {
      const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const selected = ymd === selectedYmd;
      const isToday = ymd === todayYmd;
      const bg = selected ? '#1f2937' : (isToday ? '#e5e7eb' : 'transparent');
      const color = selected ? '#ffffff' : '#111827';
      cells.push(`<button type="button" data-ymd="${ymd}" style="height:34px;border:none;border-radius:7px;background:${bg};color:${color};cursor:pointer;font-size:12px;">${d}</button>`);
    }
    calGridEl.innerHTML = cells.join('');
    Array.from(calGridEl.querySelectorAll('button[data-ymd]')).forEach((el) => {
      el.addEventListener('click', () => {
        const ymd = (el as HTMLButtonElement).dataset.ymd || '';
        if (!ymd) return;
        if (activeDateTab === 'date') singleDateYmd = ymd;
        else if (activeRangeField === 'start') rangeStartYmd = ymd;
        else rangeEndYmd = ymd;
        updateDateFieldStyles();
        updateRangeTimeLock();
        renderCalendar();
      });
    });
  };

  const syncCalendarToActiveField = () => {
    const dt = parseYmd(getActiveSelectedYmd()) ?? new Date();
    calCursor = new Date(dt.getFullYear(), dt.getMonth(), 1);
    renderCalendar();
  };

  const openDatePicker = () => {
    const today = new Date();
    if (!singleDateYmd) singleDateYmd = toYmd(today);
    if (!rangeStartYmd) rangeStartYmd = toYmd(today);
    if (!rangeEndYmd) rangeEndYmd = toYmd(today);
    if (!singleTime.getValue()) singleTime.setValue('00:00');
    if (!rangeStartTime.getValue()) rangeStartTime.setValue('00:00');
    if (!rangeEndTime.getValue()) rangeEndTime.setValue('00:00');

    applyTabStyles();
    updateDateFieldStyles();
    updateRangeTimeLock();
    syncCalendarToActiveField();

    datePicker.style.display = 'block';
    requestAnimationFrame(() => applyTabStyles());
    if (calBtn) {
      const appRect = app.getBoundingClientRect();
      const btnRect = calBtn.getBoundingClientRect();
      const dpW = datePicker.offsetWidth || 300;
      let left = btnRect.left - appRect.left;
      if (left + dpW > appRect.width - 8) left = appRect.width - dpW - 8;
      if (left < 8) left = 8;
      datePicker.style.left = `${left}px`;
      datePicker.style.bottom = `${bottomOffset + 36}px`;
      datePicker.style.top = 'auto';
    }
  };

  const closeDatePicker = () => {
    datePicker.style.display = 'none';
    openTimeMenuEl?.remove();
    openTimeMenuEl = null;
  };
  dpCancelBtn.addEventListener('click', closeDatePicker);
  dpCloseBtn.addEventListener('click', closeDatePicker);

  tabDateBtn.addEventListener('click', () => {
    activeDateTab = 'date';
    applyTabStyles();
    updateDateFieldStyles();
    syncCalendarToActiveField();
  });

  tabRangeBtn.addEventListener('click', () => {
    activeDateTab = 'range';
    applyTabStyles();
    updateDateFieldStyles();
    syncCalendarToActiveField();
  });

  singleDateBtn.addEventListener('click', () => {
    activeDateTab = 'date';
    applyTabStyles();
    updateDateFieldStyles();
    syncCalendarToActiveField();
  });

  rangeStartBtn.addEventListener('click', () => {
    activeDateTab = 'range';
    activeRangeField = 'start';
    applyTabStyles();
    updateDateFieldStyles();
    syncCalendarToActiveField();
  });

  rangeEndBtn.addEventListener('click', () => {
    activeDateTab = 'range';
    activeRangeField = 'end';
    applyTabStyles();
    updateDateFieldStyles();
    syncCalendarToActiveField();
  });

  calPrevBtn.addEventListener('click', () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
    renderCalendar();
  });

  calNextBtn.addEventListener('click', () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
    renderCalendar();
  });

  dpApplyBtn.addEventListener('click', () => {
    if (activeDateTab === 'date') {
      const targetSec = parseDateTimeSec(singleDateYmd, singleTime.getValue());
      if (!Number.isFinite(targetSec)) return;
      onGoToDateTime?.(targetSec, `${singleDateYmd} ${singleTime.getValue() || '00:00'}`);
      closeDatePicker();
      return;
    }

    updateRangeTimeLock();
    const fromSec = parseDateTimeSec(rangeStartYmd, rangeStartTime.getValue());
    const toSec = parseDateTimeSec(rangeEndYmd, rangeEndTime.getValue());
    if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || fromSec > toSec) return;
    onApplyDateRange?.(fromSec, toSec);
    closeDatePicker();
  });

  document.addEventListener('click', (e) => {
    if (openTimeMenuEl && !openTimeMenuEl.contains(e.target as Node)) {
      openTimeMenuEl.remove();
      openTimeMenuEl = null;
    }
    // Keep date picker open until explicit close actions (X/Cancel/Go).
  });

  const rangeWrap = document.createElement('div');
  rangeWrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
  const rangeTooltipMap: Record<string, string> = {
    '1D': '1분 간격',
    '5D': '5분 간격',
    '1M': '30분 간격',
    '3M': '1시간 간격',
    '6M': '2시간 간격',
    '1Y': '1일 간격',
    '5Y': '1주 간격',
    '전체': '1달 간격',
  };
  rangeButtons.forEach((label) => {
    const btn = document.createElement('button');
    if (label === '📅' || label === '??') {
      calBtn = btn;
      btn.innerHTML = CALENDAR_SVG;
      btn.title = '날짜/기간 이동';
      btn.style.cssText = 'border:none;background:transparent;color:#aab0bb;padding:3px 5px;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;';
      btn.addEventListener('mouseenter', () => { btn.style.background = '#252a3a'; btn.style.color = '#fff'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = '#aab0bb'; });
      btn.addEventListener('click', (e) => { e.stopPropagation(); datePicker.style.display === 'none' ? openDatePicker() : closeDatePicker(); });
    } else {
      btn.textContent = label;
      if (rangeTooltipMap[label]) btn.title = rangeTooltipMap[label];
      btn.style.cssText = 'border:none;background:transparent;color:#aab0bb;padding:3px 6px;border-radius:4px;cursor:pointer;font-size:11px;';
      btn.addEventListener('mouseenter', () => { btn.style.background = '#252a3a'; btn.style.color = '#fff'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = '#aab0bb'; });
      btn.addEventListener('click', () => onApplyRange(label));
    }
    rangeWrap.appendChild(btn);
  });
  bottomBar.appendChild(rangeWrap);

  // ---- Live Ticker (PC/태블릿 전용, 모바일 숨김) ----
  {
    type TDef = {
      sym: string; name: string; badge: string; currency: string;
      src: 'spot' | 'futures' | 'gateway'; apiSym?: string; gatewayMarket?: string; color: string;
    };
    const TDEFS: TDef[] = [
      { sym: 'NQ1!',      name: 'NQ',     badge: 'NQ', currency: '',     src: 'gateway', gatewayMarket: 'index',     color: '#4a9eff' },
      { sym: 'SPX500',    name: 'SPX',    badge: 'SP', currency: '',     src: 'gateway', gatewayMarket: 'index',     color: '#48bb78' },
      { sym: 'HSI',       name: 'HSI',    badge: 'HS', currency: '',     src: 'gateway', gatewayMarket: 'index',     color: '#fc8181' },
      { sym: 'KOSPI',     name: 'KOSPI',  badge: 'KP', currency: '',     src: 'gateway', gatewayMarket: 'index',     color: '#fbb040' },
      { sym: 'KOSPI200',  name: 'KP200',  badge: 'K2', currency: '',     src: 'gateway', gatewayMarket: 'index',     color: '#fb8a00' },
      { sym: 'KOSDAQ',    name: 'KOSDAQ', badge: 'KD', currency: '',     src: 'gateway', gatewayMarket: 'index',     color: '#fdd835' },
      { sym: 'BTCUSDT',   name: 'BTC',    badge: 'BT', currency: 'USDT', src: 'spot',    color: '#f7931a' },
      { sym: 'ETHUSDT',   name: 'ETH',    badge: 'ET', currency: 'USDT', src: 'spot',    color: '#627eea' },
      { sym: 'XRPUSDT',   name: 'XRP',    badge: 'XR', currency: 'USDT', src: 'spot',    color: '#00a3e0' },
      { sym: 'SOLUSDT',   name: 'SOL',    badge: 'SO', currency: 'USDT', src: 'spot',    color: '#9945ff' },
      { sym: 'BNBUSDT',   name: 'BNB',    badge: 'BN', currency: 'USDT', src: 'spot',    color: '#f3ba2f' },
      { sym: 'TRXUSDT',   name: 'TRX',    badge: 'TR', currency: 'USDT', src: 'spot',    color: '#ef0027' },
      { sym: 'XAUUSDT.P', name: 'XAU',    badge: 'AU', currency: 'USDT', src: 'futures', apiSym: 'XAUUSDT', color: '#d4af37' },
      { sym: 'XAGUSDT.P', name: 'XAG',    badge: 'AG', currency: 'USDT', src: 'futures', apiSym: 'XAGUSDT', color: '#a8a9ad' },
      { sym: 'WTI1!',     name: 'WTI',    badge: 'OL', currency: 'USD',  src: 'gateway', gatewayMarket: 'commodity', color: '#8d6233' },
    ];
    type TState = { price: number; change: number };
    const tState = new Map<string, TState>(TDEFS.map((d) => [d.sym, { price: NaN, change: NaN }]));

    if (!document.getElementById('sigma-lticker-css')) {
      const s = document.createElement('style');
      s.id = 'sigma-lticker-css';
      s.textContent = '@keyframes slt-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}'
        + '.slt-track{display:flex;align-items:center;animation:slt-scroll 80s linear infinite;will-change:transform;}'
        + '.slt-item{display:inline-flex;align-items:center;gap:5px;padding:0 13px;white-space:nowrap;border-right:1px solid #1e2336;}';
      document.head.appendChild(s);
    }

    const tickerWrap = document.createElement('div');
    tickerWrap.style.cssText = 'flex:1;min-width:0;overflow:hidden;height:100%;align-self:stretch;margin:0 4px;display:flex;align-items:center;';

    const viewport = document.createElement('div');
    viewport.style.cssText = 'overflow:hidden;width:100%;height:100%;display:flex;align-items:center;'
      + '-webkit-mask-image:linear-gradient(to right,transparent 0,#000 28px,#000 calc(100% - 28px),transparent 100%);'
      + 'mask-image:linear-gradient(to right,transparent 0,#000 28px,#000 calc(100% - 28px),transparent 100%);';

    const track = document.createElement('div');
    track.className = 'slt-track';

    const fmtPrice = (p: number): string => {
      if (!Number.isFinite(p) || p <= 0) return '—';
      if (p >= 10000) return p.toLocaleString('en', { maximumFractionDigits: 0 });
      if (p >= 1000) return p.toLocaleString('en', { maximumFractionDigits: 1 });
      if (p >= 10) return p.toLocaleString('en', { maximumFractionDigits: 2 });
      if (p >= 1) return p.toLocaleString('en', { maximumFractionDigits: 3 });
      return p.toLocaleString('en', { maximumFractionDigits: 4 });
    };

    const fmtChange = (c: number): string =>
      !Number.isFinite(c) ? '—' : `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`;

    const makeItem = (def: TDef): HTMLDivElement => {
      const el = document.createElement('div');
      el.className = 'slt-item';
      el.dataset.sym = def.sym;

      const badge = document.createElement('span');
      badge.style.cssText = `width:18px;height:18px;border-radius:3px;background:${def.color};display:inline-flex;align-items:center;justify-content:center;font-size:6.5px;font-weight:900;color:rgba(255,255,255,0.92);letter-spacing:-0.2px;flex-shrink:0;`;
      badge.textContent = def.badge;

      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-weight:600;color:#d1d4dc;font-size:11px;';
      nameEl.textContent = def.name;

      const priceEl = document.createElement('span');
      priceEl.style.cssText = 'color:#e0e3eb;font-size:11px;';
      priceEl.dataset.role = 'p';
      priceEl.textContent = '—';

      const changeEl = document.createElement('span');
      changeEl.style.cssText = 'font-size:11px;color:#8892a4;';
      changeEl.dataset.role = 'c';
      changeEl.textContent = '—';

      el.appendChild(badge);
      el.appendChild(nameEl);
      el.appendChild(priceEl);

      if (def.currency) {
        const cur = document.createElement('span');
        cur.style.cssText = 'color:#5a6478;font-size:7px;line-height:1;margin-top:3px;align-self:flex-end;margin-bottom:1px;';
        cur.textContent = def.currency;
        el.appendChild(cur);
      }

      el.appendChild(changeEl);
      return el;
    };

    const buildTrack = () => {
      track.innerHTML = '';
      for (let g = 0; g < 2; g++) {
        const grp = document.createElement('div');
        grp.style.cssText = 'display:inline-flex;align-items:center;';
        TDEFS.forEach((def) => grp.appendChild(makeItem(def)));
        track.appendChild(grp);
      }
    };
    buildTrack();

    const updateDisplay = () => {
      track.querySelectorAll<HTMLElement>('.slt-item').forEach((el) => {
        const sym = el.dataset.sym;
        if (!sym) return;
        const st = tState.get(sym);
        if (!st) return;
        const pe = el.querySelector<HTMLElement>('[data-role="p"]');
        const ce = el.querySelector<HTMLElement>('[data-role="c"]');
        if (pe && Number.isFinite(st.price)) pe.textContent = fmtPrice(st.price);
        if (ce && Number.isFinite(st.change)) {
          ce.textContent = fmtChange(st.change);
          ce.style.color = st.change >= 0 ? '#26a69a' : '#ef5350';
        }
      });
    };

    const adjustSpeed = () => {
      const grp = track.children[0] as HTMLElement;
      if (!grp) return;
      const w = grp.offsetWidth;
      if (w > 50) track.style.animationDuration = `${Math.max(20, Math.round(w / 60))}s`;
    };

    const gwBase = (): string => {
      const win = window as Window & { __DATA_GATEWAY_URL__?: string };
      const fw = (win.__DATA_GATEWAY_URL__ ?? '').trim();
      const fs = (localStorage.getItem('my-chart-lib.data-gateway-url') ?? '').trim();
      if (fw) return fw.replace(/\/+$/, '');
      if (fs) return fs.replace(/\/+$/, '');
      const h = window.location.hostname;
      return (h === 'localhost' || h === '127.0.0.1') ? 'http://127.0.0.1:8787' : window.location.origin;
    };

    const fetchAll = async (): Promise<void> => {
      const spotDefs = TDEFS.filter((d) => d.src === 'spot');
      const futDefs  = TDEFS.filter((d) => d.src === 'futures');
      const gwDefs   = TDEFS.filter((d) => d.src === 'gateway');
      const jobs: Promise<void>[] = [
        (async () => {
          if (!spotDefs.length) return;
          const syms = JSON.stringify(spotDefs.map((d) => d.sym));
          const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`, { cache: 'no-store' });
          if (!r.ok) return;
          const data = await r.json() as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>;
          data.forEach((it) => {
            const def = spotDefs.find((d) => d.sym === it.symbol);
            if (!def) return;
            const p = Number(it.lastPrice), c = Number(it.priceChangePercent);
            if (Number.isFinite(p)) tState.set(def.sym, { price: p, change: Number.isFinite(c) ? c : NaN });
          });
        })(),
        (async () => {
          if (!futDefs.length) return;
          const apiSyms = futDefs.map((d) => d.apiSym ?? d.sym.replace('.P', ''));
          const syms = JSON.stringify(apiSyms);
          const r = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${encodeURIComponent(syms)}`, { cache: 'no-store' });
          if (!r.ok) return;
          const data = await r.json() as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>;
          data.forEach((it) => {
            const def = futDefs.find((d) => (d.apiSym ?? d.sym.replace('.P', '')) === it.symbol);
            if (!def) return;
            const p = Number(it.lastPrice), c = Number(it.priceChangePercent);
            if (Number.isFinite(p)) tState.set(def.sym, { price: p, change: Number.isFinite(c) ? c : NaN });
          });
        })(),
        ...gwDefs.map((def) => (async () => {
          const url = `${gwBase()}/candles?market=${def.gatewayMarket}&symbol=${encodeURIComponent(def.sym)}&timeframe=1d&limit=2`;
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) return;
          const json = await r.json() as { candles?: Array<{ open: number; close: number }> };
          const cans = json.candles;
          if (!Array.isArray(cans) || !cans.length) return;
          const last = cans[cans.length - 1];
          const p = Number(last.close);
          const prev = cans.length >= 2 ? Number(cans[cans.length - 2].close) : Number(last.open);
          const c = (Number.isFinite(prev) && prev !== 0) ? ((p - prev) / Math.abs(prev)) * 100 : NaN;
          if (Number.isFinite(p)) tState.set(def.sym, { price: p, change: c });
        })()),
      ];
      await Promise.allSettled(jobs);
      updateDisplay();
    };

    void fetchAll().then(() => requestAnimationFrame(adjustSpeed));
    window.setInterval(fetchAll, 30_000);
    window.addEventListener('resize', adjustSpeed, { passive: true });

    viewport.appendChild(track);
    tickerWrap.appendChild(viewport);
    bottomBar.appendChild(tickerWrap);

    const applyTickerVisibility = () => {
      tickerWrap.style.display = window.matchMedia('(max-width: 767px)').matches ? 'none' : 'flex';
    };
    applyTickerVisibility();
    window.addEventListener('resize', applyTickerVisibility, { passive: true });
  }

  const navPanel = document.createElement('div');
  navPanel.style.cssText = `position:absolute;left:50%;transform:translate(-50%,8px);bottom:${bottomOffset + 26}px;
    display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:10px;
    background:rgba(19,23,34,0.94);border:1px solid #2f3649;box-shadow:0 8px 20px rgba(0,0,0,0.35);
    opacity:0;pointer-events:none;transition:opacity .16s ease, transform .16s ease;z-index:1010;`;
  app.appendChild(navPanel);

  const calcAnchorYInApp = (): number | null => {
    const pane = getActivePane();
    const chartArea = pane?.chartArea;
    if (!chartArea) return null;

    const appRect = app.getBoundingClientRect();
    const caRect = chartArea.getBoundingClientRect();
    const panels = Array.isArray(pane.chart.activePanels) ? pane.chart.activePanels : [];
    let anchorY = 0;

    if (panels.length && typeof pane.chart.getPanelRatio === 'function') {
      const plotHeight = Math.max(40, chartArea.clientHeight - 22);
      const subRatio = panels.reduce((sum, id) => sum + pane.chart.getPanelRatio!(id), 0);
      anchorY = caRect.top + plotHeight * (1 - subRatio) - appRect.top;
    } else {
      anchorY = caRect.bottom - appRect.top - 22;
    }
    return anchorY;
  };

  const updateNavPanelPosition = () => {
    const anchorY = calcAnchorYInApp();
    if (anchorY == null) {
      navPanel.style.top = 'auto';
      navPanel.style.bottom = `${bottomOffset + 26}px`;
      return;
    }

    const panelHeight = navPanel.offsetHeight || 40;
    const gapAboveFirstSub = 10;
    const top = Math.max(8, Math.round(anchorY - panelHeight - gapAboveFirstSub));
    navPanel.style.top = `${top}px`;
    navPanel.style.bottom = 'auto';
  };

  const setNavVisible = (visible: boolean) => {
    if (visible) updateNavPanelPosition();
    navPanel.style.opacity = visible ? '1' : '0';
    navPanel.style.pointerEvents = visible ? 'auto' : 'none';
    navPanel.style.transform = visible ? 'translate(-50%,0)' : 'translate(-50%,8px)';
  };

  let navHoverLock = false;
  const isNearBottomBand = (clientY: number): boolean => {
    const rect = app.getBoundingClientRect();
    const localY = clientY - rect.top;
    const anchorY = calcAnchorYInApp();
    if (anchorY == null) return localY >= rect.height - (bottomOffset + 66);
    const panelHeight = navPanel.offsetHeight || 40;
    const gapAboveFirstSub = 10;
    const panelTop = Math.max(8, Math.round(anchorY - panelHeight - gapAboveFirstSub));
    const panelBottom = panelTop + panelHeight;
    return localY >= (panelTop - 16) && localY <= (panelBottom + 24);
  };

  const ICON_PAN_LEFT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="14 6 8 12 14 18"/></svg>`;
  const ICON_PAN_RIGHT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 6 16 12 10 18"/></svg>`;
  const ICON_ZOOM_IN = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="6" x2="12" y2="18"/></svg>`;
  const ICON_ZOOM_OUT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>`;
  const ICON_JUMP_LATEST = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline class="chev-left" points="6 17 11 12 6 7"/><polyline class="chev-right" points="13 17 18 12 13 7"/></svg>`;

  type NavMotionKind = 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'latest';
  const makeNavButton = (iconSvg: string, title: string, motionKind: NavMotionKind, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<span class="nav-icon" style="display:inline-flex;align-items:center;justify-content:center;transform:translateX(0) scale(1);transform-origin:center center;">${iconSvg}</span>`;
    btn.setAttribute('aria-label', title);
    btn.title = title;
    btn.style.cssText = 'height:30px;min-width:30px;padding:0 8px;border-radius:8px;border:1px solid #d1d5db;background:#ffffff;color:#374151;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;';
    const iconWrap = btn.querySelector('.nav-icon') as HTMLSpanElement | null;
    let runningAnimations: Animation[] = [];
    const stopIconMotion = () => {
      runningAnimations.forEach((anim) => anim.cancel());
      runningAnimations = [];
      if (iconWrap) iconWrap.style.transform = 'translateX(0) scale(1)';
      const svg = iconWrap?.querySelector('svg');
      const left = svg?.querySelector('.chev-left') as SVGElement | null;
      const right = svg?.querySelector('.chev-right') as SVGElement | null;
      if (left) { left.style.opacity = '1'; left.style.transform = 'translateX(0)'; }
      if (right) { right.style.opacity = '1'; right.style.transform = 'translateX(0)'; }
    };
    const startIconMotion = () => {
      if (!iconWrap) return;
      stopIconMotion();
      if (motionKind === 'pan-left') {
        runningAnimations.push(iconWrap.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-2.8px)' }, { transform: 'translateX(0)' }], { duration: 560, iterations: Infinity, easing: 'ease-in-out' }));
      } else if (motionKind === 'pan-right') {
        runningAnimations.push(iconWrap.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(2.8px)' }, { transform: 'translateX(0)' }], { duration: 560, iterations: Infinity, easing: 'ease-in-out' }));
      } else if (motionKind === 'zoom-in') {
        runningAnimations.push(iconWrap.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 620, iterations: Infinity, easing: 'ease-in-out' }));
      } else if (motionKind === 'zoom-out') {
        runningAnimations.push(iconWrap.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.82)' }, { transform: 'scale(1)' }], { duration: 620, iterations: Infinity, easing: 'ease-in-out' }));
      } else {
        const svg = iconWrap.querySelector('svg');
        const left = svg?.querySelector('.chev-left') as SVGElement | null;
        const right = svg?.querySelector('.chev-right') as SVGElement | null;
        if (left && right) {
          runningAnimations.push(left.animate([{ opacity: 0.2, transform: 'translateX(-1px)' }, { opacity: 1, transform: 'translateX(0)' }, { opacity: 0.2, transform: 'translateX(1px)' }], { duration: 760, iterations: Infinity, easing: 'ease-in-out' }));
          runningAnimations.push(right.animate([{ opacity: 0.2, transform: 'translateX(-1px)' }, { opacity: 1, transform: 'translateX(0)' }, { opacity: 0.2, transform: 'translateX(1px)' }], { duration: 760, delay: 210, iterations: Infinity, easing: 'ease-in-out' }));
        }
      }
    };
    btn.addEventListener('mouseenter', () => { btn.style.background = '#f3f4f6'; btn.style.borderColor = '#9ca3af'; btn.style.color = '#1f2937'; startIconMotion(); });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#ffffff'; btn.style.borderColor = '#d1d5db'; btn.style.color = '#374151'; stopIconMotion(); });
    btn.addEventListener('click', onClick);
    return btn;
  };

  const callChartControl = (fn: (chart: TChart) => void): void => {
    const pane = getActivePane();
    if (!pane || !pane.chart) return;
    fn(pane.chart);
  };
  navPanel.appendChild(makeNavButton(ICON_PAN_LEFT, 'Pan Left', 'pan-left', () => callChartControl((chart) => chart.panViewport?.(-10))));
  navPanel.appendChild(makeNavButton(ICON_PAN_RIGHT, 'Pan Right', 'pan-right', () => callChartControl((chart) => chart.panViewport?.(10))));
  navPanel.appendChild(makeNavButton(ICON_ZOOM_IN, 'Zoom In', 'zoom-in', () => callChartControl((chart) => chart.zoomByCandles?.(-6))));
  navPanel.appendChild(makeNavButton(ICON_ZOOM_OUT, 'Zoom Out', 'zoom-out', () => callChartControl((chart) => chart.zoomByCandles?.(6))));
  navPanel.appendChild(makeNavButton(ICON_JUMP_LATEST, 'Jump To Latest Candle', 'latest', () => callChartControl((chart) => chart.jumpToLatest?.())));

  app.addEventListener('mousemove', (event) => {
    if (navHoverLock) return;
    const target = event.target as Element | null;
    if (target?.closest('.panel-divider')) return;
    setNavVisible(isNearBottomBand(event.clientY));
  });
  app.addEventListener('mouseleave', () => { if (!navHoverLock) setNavVisible(false); });
  bottomBar.addEventListener('mouseenter', () => setNavVisible(true));
  navPanel.addEventListener('mouseenter', () => { navHoverLock = true; setNavVisible(true); });
  navPanel.addEventListener('mouseleave', () => { navHoverLock = false; setNavVisible(false); });
  window.addEventListener('resize', updateNavPanelPosition);
  window.setInterval(updateNavPanelPosition, 350);

  const tzWrap = document.createElement('div');
  tzWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const clockEl = document.createElement('span');
  clockEl.style.cssText = 'color:#d1d4dc;font-size:11px;line-height:1;';
  const tzBtn = document.createElement('button');
  tzBtn.type = 'button';
  tzBtn.style.cssText = 'background:#1c2030;color:#d1d4dc;border:1px solid #2a2e3e;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;';
  const refreshTimezoneButton = () => {
    tzBtn.textContent = formatTimezoneLabel(getActivePane().chart.config.timezone);
  };
  tzBtn.addEventListener('click', () => {
    onOpenTimezone(getActivePane().chart, refreshTimezoneButton);
  });
  const updateClock = () => {
    clockEl.textContent = formatDateWithTimezone(new Date(), getActivePane().chart.config.timezone, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  };
  refreshTimezoneButton();
  updateClock();
  window.setInterval(updateClock, 1000);
  tzWrap.append(clockEl, tzBtn);
  bottomBar.appendChild(tzWrap);

  return bottomBar;
}
