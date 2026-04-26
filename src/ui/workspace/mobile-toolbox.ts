type MobileDrawingTool = {
  id: string | null;
  svg: string;
  title: string;
  isAction?: boolean;
};

type MobileChartLike = {
  drawingTool: string | null;
  setDrawingsVisible: (visible: boolean) => void;
  isDrawingsVisible: () => boolean;
  clearAllDrawings: (keepLocked?: boolean) => void;
  setDrawingTool: (tool: string | null) => void;
};

type MobilePaneLike = {
  chart: MobileChartLike;
  refreshChartUi: () => void;
};

type CreateMobileDrawingPanelArgs = {
  toolPanelEl: HTMLDivElement;
  getActivePane: () => MobilePaneLike;
  closePanel: () => void;
};

const MOBILE_DRAWING_TOOLS: MobileDrawingTool[] = [
  { id: null,               title: '선택 해제', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-7 1-3 7z"/></svg>' },
  { id: 'trendline',        title: '추세선',    svg: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/></svg>' },
  { id: 'hline',            title: '수평선',    svg: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><circle cx="2" cy="12" r="2" fill="currentColor"/></svg>' },
  { id: 'channel',          title: '채널',      svg: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2"><line x1="3" y1="18" x2="21" y2="6"/><line x1="3" y1="22" x2="21" y2="10"/></svg>' },
  { id: 'fib-retracement',  title: '피보나치',  svg: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.6"><line x1="2" y1="5" x2="22" y2="5"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="2" y1="15" x2="22" y2="15"/><line x1="2" y1="20" x2="22" y2="20"/></svg>' },
  { id: 'fib-trend',        title: '추세피보',  svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="3" y1="20" x2="21" y2="4"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="3" cy="20" r="2" fill="currentColor"/><circle cx="21" cy="4" r="2" fill="currentColor"/></svg>' },
  { id: 'measure',          title: '재기',      svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="8" x2="2" y2="16"/><line x1="22" y1="8" x2="22" y2="16"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="14" y1="10" x2="14" y2="14"/></svg>' },
  { id: 'long-position',    title: '롱포지션',  svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="3" y1="12" x2="22" y2="12"/><circle cx="4" cy="12" r="1.8" fill="currentColor"/><text x="11" y="10" font-size="5" font-weight="700" fill="currentColor" stroke="none">S</text></svg>' },
  { id: 'short-position',   title: '숏포지션',  svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="3" y1="12" x2="22" y2="12"/><circle cx="4" cy="12" r="1.8" fill="currentColor"/><text x="11" y="10" font-size="5" font-weight="700" fill="currentColor" stroke="none">S</text></svg>' },
  { id: 'text-note',        title: '텍스트',    svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg>' },
  { id: '__hide_drawings__', title: '드로잉 감추기', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="2"/></svg>' },
  { id: '__trash_drawings__', title: '드로잉 삭제', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"/></svg>' },
];

const MOBILE_DRAWING_TRIGGER_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" fill="#ffffff" xmlns="http://www.w3.org/2000/svg"><path d="M9,16h1.59c1.07,0,2.07-.42,2.83-1.17L23.12,5.12c.57-.57,.88-1.32,.88-2.12s-.31-1.55-.88-2.12c-1.17-1.17-3.07-1.17-4.24,0L9.17,10.59c-.76,.76-1.17,1.76-1.17,2.83v1.59c0,.55,.45,1,1,1ZM21.71,2.29c.19,.19,.29,.44,.29,.71s-.1,.52-.29,.71l-1.29,1.29-1.41-1.41,1.29-1.29c.39-.39,1.02-.39,1.41,0ZM10,13.41c0-.53,.21-1.04,.59-1.41l7-7,1.41,1.41-7,7c-.38,.38-.88,.59-1.41,.59h-.59v-.59Zm14,9.59c0,.55-.45,1-1,1-1.54,0-2.29-1.12-2.83-1.95-.5-.75-.75-1.05-1.17-1.05-.51,0-.9,.44-1.51,1.15-.7,.83-1.57,1.85-3.03,1.85s-2.32-1.03-3-1.87c-.58-.7-.96-1.13-1.46-1.13-.39,0-.63,.25-1.16,.91-.72,.88-1.71,2.09-3.84,2.09-2.76,0-5-2.24-5-5s2.24-5,5-5c.55,0,1,.45,1,1s-.45,1-1,1c-1.65,0-3,1.35-3,3s1.35,3,3,3c1.18,0,1.67-.6,2.29-1.36,.6-.73,1.34-1.64,2.71-1.64,1.47,0,2.32,1.03,3,1.87,.58,.7,.96,1.13,1.46,1.13s.9-.44,1.51-1.15c.7-.83,1.57-1.85,3.03-1.85s2.29,1.12,2.83,1.95c.5,.75,.75,1.05,1.17,1.05,.55,0,1,.45,1,1Z"/></svg>`;

export function createMobileDrawingTriggerButton(mobileBarButtonStyle: string): HTMLButtonElement {
  const toolTriggerBtn = document.createElement('button');
  toolTriggerBtn.title = '드로잉 도구';
  toolTriggerBtn.style.cssText = `${mobileBarButtonStyle};padding:0 10px;`;
  toolTriggerBtn.innerHTML = MOBILE_DRAWING_TRIGGER_SVG;
  return toolTriggerBtn;
}

export function createMobileDrawingToolPanel({
  toolPanelEl,
  getActivePane,
  closePanel,
}: CreateMobileDrawingPanelArgs): void {
  const toolGrid = document.createElement('div');
  toolGrid.style.cssText = [
    'display:grid', 'grid-template-columns:repeat(4,1fr)',
    'gap:8px', 'padding:0 16px 20px',
  ].join(';');
  toolPanelEl.appendChild(toolGrid);

  let activeToolCell: HTMLButtonElement | null = null;

  MOBILE_DRAWING_TOOLS.forEach(({ id, svg, title, isAction }) => {
    const cell = document.createElement('button');
    const isActionBtn = isAction === true;
    const actionColor = id === '__trash_drawings__' ? '#f23645' : '#c2ccdf';
    cell.style.cssText = [
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'gap:6px', 'padding:12px 4px',
      'background:#1c2840', `color:${actionColor}`,
      `border:1px solid ${isActionBtn ? '#3a3060' : '#2e3f5c'}`,
      'border-radius:10px',
      'font-size:11px', 'font-family:inherit', 'font-weight:600',
      'cursor:pointer', 'touch-action:manipulation',
      '-webkit-tap-highlight-color:transparent',
      'transition:background 0.12s,color 0.12s,border-color 0.12s',
    ].join(';');
    cell.innerHTML = `${svg}<span>${title}</span>`;

    cell.addEventListener('touchstart', () => {
      cell.style.background = isActionBtn ? '#2a1a3a' : '#1e3260';
      cell.style.borderColor = isActionBtn ? '#8a4aff' : '#2962ff';
    }, { passive: true });

    cell.addEventListener('touchend', () => {
      if (activeToolCell !== cell) {
        setTimeout(() => {
          cell.style.background = '#1c2840';
          cell.style.borderColor = isActionBtn ? '#3a3060' : '#2e3f5c';
        }, 300);
      }
    }, { passive: true });

    cell.addEventListener('click', () => {
      const pane = getActivePane();

      if (id === '__hide_drawings__') {
        pane.chart.setDrawingsVisible(!pane.chart.isDrawingsVisible());
        pane.refreshChartUi();
        const span = cell.querySelector('span');
        if (span) span.textContent = pane.chart.isDrawingsVisible() ? '드로잉 감추기' : '드로잉 표시';
        closePanel();
        return;
      }

      if (id === '__trash_drawings__') {
        pane.chart.clearAllDrawings(false);
        pane.refreshChartUi();
        closePanel();
        return;
      }

      const isSameTool =
        (id === null && pane.chart.drawingTool === null) ||
        (id !== null && pane.chart.drawingTool === id);
      const nextTool = isSameTool ? null : id;
      pane.chart.setDrawingTool(nextTool);

      if (activeToolCell) {
        activeToolCell.style.background = '#1c2840';
        activeToolCell.style.color = '#c2ccdf';
        activeToolCell.style.borderColor = '#2e3f5c';
      }
      if (nextTool !== null) {
        cell.style.background = '#193060';
        cell.style.color = '#7eb8ff';
        cell.style.borderColor = '#2962ff';
        activeToolCell = cell;
      } else {
        activeToolCell = null;
      }
      closePanel();
    });

    toolGrid.appendChild(cell);
  });
}
