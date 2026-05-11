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
  setIndicatorsVisible: (visible: boolean) => void;
  isIndicatorsVisible: () => boolean;
  setPatternBoxesVisible: (visible: boolean) => void;
  isPatternBoxesVisible: () => boolean;
  clearAllDrawings: (keepLocked?: boolean) => void;
  setDrawingTool: (tool: string | null) => void;
  getDrawingMagnetMode: () => string;
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

const MAGNET_SOFT_SVG = '<svg viewBox="0 0 512 512" width="27" height="27" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(512,0) scale(-1,1)"><path d="M421.83,293.82A144,144,0,0,0,218.18,90.17" stroke-width="32"></path><path d="M353.94,225.94a48,48,0,0,0-67.88-67.88" stroke-width="32"></path><line x1="192" y1="464" x2="192" y2="416" stroke-width="32"></line><line x1="90.18" y1="421.82" x2="124.12" y2="387.88" stroke-width="32"></line><line x1="48" y1="320" x2="96" y2="320" stroke-width="32"></line><path d="M286.06,158.06,172.92,271.19a32,32,0,0,1-45.25,0L105,248.57a32,32,0,0,1,0-45.26L218.18,90.17" stroke-width="32"></path><path d="M421.83,293.82,308.69,407a32,32,0,0,1-45.26,0l-22.62-22.63a32,32,0,0,1,0-45.26L353.94,225.94" stroke-width="32"></path><line x1="139.6" y1="169.98" x2="207.48" y2="237.87" stroke-width="32"></line><line x1="275.36" y1="305.75" x2="343.25" y2="373.63" stroke-width="32"></line></g></svg>';
const MAGNET_OFF_SVG = '<svg viewBox="0 0 512 512" width="27" height="27" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + MAGNET_SOFT_SVG.replace('<svg viewBox="0 0 512 512" width="27" height="27" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">', '').replace('</svg>', '') + '<line x1="80" y1="432" x2="432" y2="80" stroke-width="34"></line></svg>';
const MAGNET_STRONG_SVG = '<svg viewBox="0 0 512 512" width="27" height="27" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + MAGNET_SOFT_SVG.replace('<svg viewBox="0 0 512 512" width="27" height="27" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">', '').replace('</svg>', '') + '<circle cx="430" cy="96" r="34" stroke-width="20"></circle></svg>';

const MOBILE_DRAWING_TOOLS: MobileDrawingTool[] = [
  { id: null, title: '선택 해제', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-7 1-3 7z"/></svg>' },
  { id: 'cursor-cross', title: '크로스', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="3.5" x2="12" y2="9.5"/><line x1="12" y1="14.5" x2="12" y2="20.5"/><line x1="3.5" y1="12" x2="9.5" y2="12"/><line x1="14.5" y1="12" x2="20.5" y2="12"/></svg>' },
  { id: 'cursor-dot', title: '점', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="2.2"></circle></svg>' },
  { id: 'cursor-arrow', title: '화살표', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l12 9-5 1 2 7-2 1-3-7-4 4z"></path></svg>' },
  { id: 'cursor-demo', title: '데모', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.0"><circle cx="12" cy="12" r="8" fill="rgba(47,108,255,0.35)" stroke="none"></circle></svg>' },
  { id: 'trendline', title: '추세선', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round"><line x1="5.2" y1="16.8" x2="16.8" y2="5.2"></line><circle cx="4" cy="18" r="1.7" fill="none"></circle><circle cx="18" cy="4" r="1.7" fill="none"></circle></svg>' },
  { id: 'hline', title: '수평선', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line></svg>' },
  { id: 'channel', title: '채널', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round"><line x1="5" y1="8" x2="19" y2="3"></line><line x1="5" y1="16" x2="19" y2="11"></line></svg>' },
  { id: 'fib-retracement', title: '피보나치', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="4" x2="21" y2="4"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="14" x2="17.5" y2="14"></line><line x1="20.5" y1="14" x2="21" y2="14"></line><line x1="3" y1="19" x2="3.3" y2="19"></line><line x1="6.7" y1="19" x2="21" y2="19"></line><line x1="5" y1="19" x2="19" y2="14" stroke-dasharray="4 3"></line><circle cx="5" cy="19" r="1.7" fill="none"></circle><circle cx="19" cy="14" r="1.7" fill="none"></circle></svg>' },
  { id: 'fib-trend', title: '추세 피보나치', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="4" x2="21" y2="4"></line><line x1="3" y1="9" x2="10.3" y2="9"></line><line x1="13.7" y1="9" x2="21" y2="9"></line><line x1="3" y1="14" x2="17.5" y2="14"></line><line x1="20.5" y1="14" x2="21" y2="14"></line><line x1="6.3" y1="21.0" x2="10.8" y2="10.2" stroke-dasharray="4 3"></line><line x1="13.5" y1="9.9" x2="17.5" y2="13.1" stroke-dasharray="4 3"></line><circle cx="5" cy="22" r="1.7" fill="none"></circle><circle cx="12" cy="9" r="1.7" fill="none"></circle><circle cx="19" cy="14" r="1.7" fill="none"></circle></svg>' },
  { id: 'measure', title: '재기', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5 16.5 4l3.5 3.5L7.5 20z"></path><path d="M8.2 12.3l2.5 2.5M11.1 9.4l2.5 2.5M14 6.5l2.5 2.5"></path></svg>' },
  { id: 'long-position', title: '롱 포지션', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round"><path d="M5 16h14"></path><path d="M12 19V5"></path><path d="M9 8l3-3 3 3"></path></svg>' },
  { id: 'short-position', title: '숏 포지션', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round"><path d="M5 8h14"></path><path d="M12 5v14"></path><path d="M9 16l3 3 3-3"></path></svg>' },
  { id: 'anchored-vwap', title: '앵커드 VWAP', svg: '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.2" cy="16.8" r="1.7"></circle><path d="M5.2 16.8c2.1-3.5 4.9-5.5 8.1-5.5 2.7 0 4.6 1.2 5.5 3.1 0 0 .7 1.2 1.2 3.1"></path></svg>' },
  { id: 'text-note', title: '텍스트', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg>' },
  { id: '__hide_drawings__', title: '드로잉 감추기', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="20" x2="20" y2="4"/></svg>' },
  { id: '__hide_indicators__', title: '지표 감추기', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="17" x2="9" y2="11"></line><line x1="10" y1="14" x2="14" y2="8"></line><line x1="15" y1="12" x2="19" y2="6"></line><line x1="4" y1="20" x2="20" y2="4"></line></svg>' },
  { id: '__hide_all__', title: '모두 감추기', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"></rect><line x1="4" y1="20" x2="20" y2="4"></line></svg>' },
  { id: '__magnet_off__', title: '자석 끄기', isAction: true, svg: MAGNET_OFF_SVG },
  { id: '__magnet_soft__', title: '자석 약하게', isAction: true, svg: MAGNET_SOFT_SVG },
  { id: '__magnet_strong__', title: '자석 강하게', isAction: true, svg: MAGNET_STRONG_SVG },
  { id: '__trash_drawings__', title: '드로잉 삭제', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"/></svg>' },
  { id: 'eraser', title: '지우개', isAction: true, svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l11-11 6 6-4.5 4.5"/><path d="M6.5 17.5l3-3"/></svg>' },
];

const MAGNET_MODE_TO_ID: Record<string, string> = {
  off: '__magnet_off__',
  soft: '__magnet_soft__',
  strong: '__magnet_strong__',
};

const MOBILE_DRAWING_TRIGGER_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" fill="#ffffff" xmlns="http://www.w3.org/2000/svg"><path d="M9,16h1.59c1.07,0,2.07-.42,2.83-1.17L23.12,5.12c.57-.57,.88-1.32,.88-2.12s-.31-1.55-.88-2.12c-1.17-1.17-3.07-1.17-4.24,0L9.17,10.59c-.76,.76-1.17,1.76-1.17,2.83v1.59c0,.55,.45,1,1,1ZM21.71,2.29c.19,.19,.29,.44,.29,.71s-.1,.52-.29,.71l-1.29,1.29-1.41-1.41,1.29-1.29c.39-.39,1.02-.39,1.41,0ZM10,13.41c0-.53,.21-1.04,.59-1.41l7-7,1.41,1.41-7,7c-.38,.38-.88,.59-1.41,.59h-.59v-.59Zm14,9.59c0,.55-.45,1-1,1-1.54,0-2.29-1.12-2.83-1.95-.5-.75-.75-1.05-1.17-1.05-.51,0-.9,.44-1.51,1.15-.7,.83-1.57,1.85-3.03,1.85s-2.32-1.03-3-1.87c-.58-.7-.96-1.13-1.46-1.13-.39,0-.63,.25-1.16,.91-.72,.88-1.71,2.09-3.84,2.09-2.76,0-5-2.24-5-5s2.24-5,5-5c.55,0,1,.45,1,1s-.45,1-1,1c-1.65,0-3,1.35-3,3s1.35,3,3,3c1.18,0,1.67-.6,2.29-1.36,.6-.73,1.34-1.64,2.71-1.64,1.47,0,2.32,1.03,3,1.87,.58,.7,.96,1.13,1.46,1.13s.9-.44,1.51-1.15c.7-.83,1.57-1.85,3.03-1.85s2.29,1.12,2.83,1.95c.5,.75,.75,1.05,1.17,1.05,.55,0,1,.45,1,1Z"/></svg>`;

export function createMobileDrawingTriggerButton(mobileBarButtonStyle: string): HTMLButtonElement {
  const toolTriggerBtn = document.createElement('button');
  toolTriggerBtn.title = '?쒕줈???꾧뎄';
  toolTriggerBtn.style.cssText = `${mobileBarButtonStyle};padding:0 10px;`;
  toolTriggerBtn.innerHTML = MOBILE_DRAWING_TRIGGER_SVG;
  return toolTriggerBtn;
}

export function createMobileDrawingToolPanel({
  toolPanelEl,
  getActivePane,
  closePanel,
}: CreateMobileDrawingPanelArgs): void {
  const categories = [
    { key: 'trend', label: '추세', ids: ['trendline', 'hline', 'channel'] },
    { key: 'fibonacci', label: '피보나치', ids: ['fib-retracement', 'fib-trend'] },
    { key: 'position', label: '예측', ids: ['long-position', 'short-position', 'anchored-vwap'] },
    { key: 'magnet', label: '자석', ids: ['__magnet_off__', '__magnet_soft__', '__magnet_strong__'] },
    { key: 'hide', label: '감추기', ids: ['__hide_drawings__', '__hide_indicators__', '__hide_all__'] },
  ] as const;
  const quickToolIds: Array<string> = ['measure', 'text-note', '__trash_drawings__', 'eraser'];
  type CategoryKey = (typeof categories)[number]['key'];
  let activeCategory: CategoryKey = 'trend';

  const tabBar = document.createElement('div');
  tabBar.style.cssText = [
    'display:flex', 'gap:8px', 'padding:0 16px 10px',
    'position:sticky', 'top:0', 'z-index:1',
    'background:linear-gradient(180deg,rgba(10,16,28,0.98) 0%, rgba(10,16,28,0.90) 100%)',
    'backdrop-filter:blur(6px)',
  ].join(';');
  toolPanelEl.appendChild(tabBar);

  const gridViewport = document.createElement('div');
  gridViewport.style.cssText = [
    'position:relative',
    'overflow:hidden',
    'min-height:208px',
  ].join(';');
  toolPanelEl.appendChild(gridViewport);

  const toolGrid = document.createElement('div');
  toolGrid.style.cssText = [
    'display:grid', 'grid-template-columns:repeat(4,1fr)',
    'gap:8px', 'padding:0 16px 12px',
    'transition:transform 220ms ease, opacity 220ms ease',
    'will-change:transform,opacity',
    'align-content:start',
  ].join(';');
  gridViewport.appendChild(toolGrid);

  const quickRow = document.createElement('div');
  quickRow.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(4,1fr)',
    'gap:8px',
    'padding:0 16px 20px',
    'border-top:1px solid rgba(63,84,120,0.45)',
  ].join(';');
  toolPanelEl.appendChild(quickRow);

  const getToolsByCategory = (key: CategoryKey): MobileDrawingTool[] => {
    const cat = categories.find((c) => c.key === key);
    if (!cat) return [];
    return cat.ids
      .map((id) => MOBILE_DRAWING_TOOLS.find((tool) => tool.id === id) ?? null)
      .filter((tool): tool is MobileDrawingTool => Boolean(tool));
  };

  const applyMagnetActiveStyle = () => {
    const mode = getActivePane().chart.getDrawingMagnetMode();
    const activeId = MAGNET_MODE_TO_ID[mode] ?? '__magnet_off__';
    const magnetIds = ['__magnet_off__', '__magnet_soft__', '__magnet_strong__'];
    magnetIds.forEach((id) => {
      const btn = toolGrid.querySelector(`button[data-tool-id="${id}"]`) as HTMLButtonElement | null;
      if (!btn) return;
      const isActive = id === activeId;
      btn.style.background = isActive ? '#1a3a20' : '#1c2840';
      btn.style.color = isActive ? '#39d98a' : '#c2ccdf';
      btn.style.borderColor = isActive ? '#39d98a' : '#3a3060';
    });
  };

  const buildToolCell = (tool: MobileDrawingTool): HTMLButtonElement => {
    const pane = getActivePane();
    const { id, svg, title, isAction } = tool;
    const cell = document.createElement('button');
    let displayTitle = title;
    let displaySvg = svg;
    if (id === '__hide_drawings__') {
      const visible = pane.chart.isDrawingsVisible();
      displayTitle = visible ? '드로잉 감추기' : '드로잉 보기';
      displaySvg = visible
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="20" x2="20" y2="4"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    } else if (id === '__hide_indicators__') {
      const visible = pane.chart.isIndicatorsVisible();
      displayTitle = visible ? '지표 감추기' : '지표 보기';
      displaySvg = visible
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="17" x2="9" y2="11"></line><line x1="10" y1="14" x2="14" y2="8"></line><line x1="15" y1="12" x2="19" y2="6"></line><line x1="4" y1="4" x2="20" y2="20"></line></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="17" x2="9" y2="11"></line><line x1="10" y1="14" x2="14" y2="8"></line><line x1="15" y1="12" x2="19" y2="6"></line></svg>';
    } else if (id === '__hide_all__') {
      const allVisible = pane.chart.isDrawingsVisible() && pane.chart.isIndicatorsVisible() && pane.chart.isPatternBoxesVisible();
      displayTitle = allVisible ? '모두 감추기' : '모두 보기';
      displaySvg = allVisible
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"></rect><line x1="4" y1="20" x2="20" y2="4"></line></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>';
    }
    const isActionBtn = isAction === true;
    const isMagnetBtn = id === '__magnet_off__' || id === '__magnet_soft__' || id === '__magnet_strong__';
    const isPointerBtn = id === 'cursor-cross' || id === 'cursor-dot' || id === 'cursor-arrow' || id === 'cursor-demo';
    const actionColor = id === '__trash_drawings__' ? '#f23645' : '#c2ccdf';
    if (id) cell.dataset.toolId = id;
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
      'transition:background 0.12s,color 0.12s,border-color 0.12s, transform 0.12s',
    ].join(';');
    cell.innerHTML = `${displaySvg}<span>${displayTitle}</span>`;
    cell.addEventListener('touchstart', () => {
      if (!isMagnetBtn) {
        cell.style.background = isActionBtn ? '#2a1a3a' : '#1e3260';
        cell.style.borderColor = isActionBtn ? '#8a4aff' : '#2962ff';
        cell.style.transform = 'translateY(-1px)';
      }
    }, { passive: true });
    cell.addEventListener('touchend', () => {
      cell.style.transform = 'translateY(0)';
      if (!isMagnetBtn) {
        setTimeout(() => {
          cell.style.background = '#1c2840';
          cell.style.borderColor = isActionBtn ? '#3a3060' : '#2e3f5c';
        }, 220);
      }
    }, { passive: true });
    cell.addEventListener('click', () => {
      if (id === '__hide_drawings__') {
        pane.chart.setDrawingsVisible(!pane.chart.isDrawingsVisible());
        pane.refreshChartUi();
        renderTools(activeCategory, 1);
        return;
      }
      if (id === '__hide_indicators__') {
        pane.chart.setIndicatorsVisible(!pane.chart.isIndicatorsVisible());
        pane.refreshChartUi();
        renderTools(activeCategory, 1);
        return;
      }
      if (id === '__hide_all__') {
        const indicatorsVisible = pane.chart.isIndicatorsVisible();
        const patternsVisible = pane.chart.isPatternBoxesVisible();
        const nextVisible = !(pane.chart.isDrawingsVisible() && indicatorsVisible && patternsVisible);
        pane.chart.setDrawingsVisible(nextVisible);
        pane.chart.setIndicatorsVisible(nextVisible);
        pane.chart.setPatternBoxesVisible(nextVisible);
        pane.refreshChartUi();
        renderTools(activeCategory, 1);
        return;
      }
      if (id === '__trash_drawings__') {
        pane.chart.clearAllDrawings(false);
        pane.refreshChartUi();
        closePanel();
        return;
      }
      if (isMagnetBtn) {
        const itemId = id === '__magnet_off__'
          ? 'magnet-off'
          : id === '__magnet_strong__'
            ? 'magnet-strong'
            : 'magnet-soft';
        window.dispatchEvent(new CustomEvent('chart-toolbox-select', {
          detail: { toolId: 'magnet', itemId, label: itemId },
        }));
        pane.refreshChartUi();
        applyMagnetActiveStyle();
        closePanel();
        return;
      }
      if (isPointerBtn && id) {
        window.dispatchEvent(new CustomEvent('chart-toolbox-select', {
          detail: { toolId: 'pointer', itemId: id, label: id },
        }));
        pane.chart.setDrawingTool(null);
        pane.refreshChartUi();
        closePanel();
        return;
      }
      const isSameTool =
        (id === null && pane.chart.drawingTool === null) ||
        (id !== null && pane.chart.drawingTool === id);
      const nextTool = isSameTool ? null : id;
      pane.chart.setDrawingTool(nextTool);
      pane.refreshChartUi();
      closePanel();
    });
    return cell;
  };

  const renderTools = (category: CategoryKey, direction: 1 | -1 = 1) => {
    const tools = getToolsByCategory(category);
    toolGrid.style.opacity = '0';
    toolGrid.style.transform = `translateX(${direction * 18}px)`;
    window.requestAnimationFrame(() => {
      toolGrid.innerHTML = '';
      tools.forEach((tool) => {
        toolGrid.appendChild(buildToolCell(tool));
      });
      applyMagnetActiveStyle();
      window.requestAnimationFrame(() => {
        toolGrid.style.opacity = '1';
        toolGrid.style.transform = 'translateX(0)';
      });
    });
  };

  const renderQuickTools = () => {
    quickRow.innerHTML = '';
    quickToolIds.forEach((id) => {
      const tool = MOBILE_DRAWING_TOOLS.find((candidate) => candidate.id === id);
      if (!tool) return;
      quickRow.appendChild(buildToolCell(tool));
    });
  };

  const tabButtonMap = new Map<CategoryKey, HTMLButtonElement>();
  const setActiveTab = (next: CategoryKey) => {
    const prev = activeCategory;
    activeCategory = next;
    tabButtonMap.forEach((btn, key) => {
      const active = key === next;
      btn.style.background = active ? '#2452a8' : '#17253d';
      btn.style.color = active ? '#ffffff' : '#9eb2d3';
      btn.style.borderColor = active ? '#4f89ff' : '#2a3f62';
      btn.style.transform = active ? 'translateY(-1px)' : 'translateY(0)';
    });
    renderTools(next, prev === next ? 1 : (categories.findIndex((c) => c.key === next) > categories.findIndex((c) => c.key === prev) ? 1 : -1));
  };

  categories.forEach((cat) => {
    const tab = document.createElement('button');
    tab.textContent = cat.label;
    tab.style.cssText = [
      'height:30px', 'padding:0 12px',
      'border-radius:8px', 'border:1px solid #2a3f62',
      'background:#17253d', 'color:#9eb2d3',
      'font-size:12px', 'font-weight:700',
      'cursor:pointer', 'touch-action:manipulation',
      '-webkit-tap-highlight-color:transparent',
      'transition:all 180ms ease',
    ].join(';');
    tab.addEventListener('click', () => setActiveTab(cat.key));
    tabBar.appendChild(tab);
    tabButtonMap.set(cat.key, tab);
  });

  renderQuickTools();
  setActiveTab('trend');

  const observer = new MutationObserver(() => {
    if (toolPanelEl.style.display !== 'none' && toolPanelEl.offsetParent !== null) {
      applyMagnetActiveStyle();
    }
  });
  observer.observe(toolPanelEl, { attributes: true, attributeFilter: ['style'] });
}


