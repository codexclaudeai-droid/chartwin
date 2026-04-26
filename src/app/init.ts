import '../style.css';
import {
  TIMEFRAME_SECONDS,
  formatDateWithTimezone,
  formatTimezoneLabel,
  type TimeframeKey,
} from '../catalog/time';
import {
  createSymbolIconElement,
  findSymbolItem,
  getSymbolIconUrl,
} from '../catalog/symbols';
import {
  loadStrategies,
  saveStrategies,
  type StrategyDefinition,
  type StrategySignal,
} from '../strategy/strategy-service';
import {
  openChartSettingsModal,
  openIndicatorModal,
  openStrategyModal,
  openSymbolModal,
  openSymbolRegistryModal,
  openTimezoneModal,
} from '../ui/modal-handlers';
import { createIndicatorOverlay } from '../ui/indicator-overlay';
import {
  applyActivePaneOutline,
  createPaneManager,
  updateGridByCount as updateGridTemplateByCount,
  type PaneManagerState,
} from '../ui/workspace/pane-manager';
import { applyRangeToChart } from '../ui/workspace/pane-utils';
import { createBottomBar } from '../ui/workspace/bottom-bar';
import { createTopBar } from '../ui/workspace/top-bar';
import { setupPopoutView } from '../ui/workspace/popout-controls';
import { bindGlobalShortcuts } from '../ui/workspace/keyboard-shortcuts';
import { openMultiMonitorPopouts } from '../ui/workspace/multi-monitor';
import { createPaneChrome } from '../ui/workspace/pane-chrome';
import { createPanelDividerManager } from '../ui/workspace/panel-dividers';
import { createLiveTicker } from '../ui/workspace/live-ticker';
import { createBinanceLiveFeed } from '../data/binance-live-feed';
import { createGatewayLiveFeed, shouldUseBinanceDirect } from '../data/gateway-live-feed';
import { bindPaneEventHandlers } from '../ui/workspace/pane-events';
import { createStrategyReportPanel } from '../ui/workspace/strategy-report-panel';
import { createLeftToolbox } from '../ui/workspace/left-toolbox';
import {
  createMobileDrawingToolPanel,
  createMobileDrawingTriggerButton,
} from '../ui/workspace/mobile-toolbox';
import type {
  DrawingAnchor,
  DrawingShape,
  DrawingToolId,
} from '../ui/workspace/drawing-types';
import { cloneDrawingShape } from '../ui/workspace/drawing-utils';
import { resizePanelBoundary } from '../indicator-panel-module';
import { formatWithComma, getBucketStartSec, shiftBucketSec } from '../chart/axis-utils';
import {
  generateDummyData,
  getSymbolPricePrecision,
  loadSavedApiKeys,
  setDataSource,
  setFinnhubApiKey,
} from '../data/market-data-sources';
import { type PatternAnalysisScope } from '../patterns/pattern-detector';
import type { CandleData } from '../types';
import type { DisplayCurrency } from '../types/market';
import { SimpleChart, X_AXIS_HEIGHT, MOBILE_BOTTOM_BAR_HEIGHT, MOBILE_JUMP_LATEST_SVG } from '../chart/SimpleChart0';
import { getUsdtToDisplayRate } from '../utils/currency';
import { canonicalizeUiSymbol, isNasdaqFuturesLikeSymbol, isCmeEquityFuturesOpen } from '../utils/market-session';
import { type GapMode, loadGapMode, loadPatternAnalysisScope, loadPatternAlertEnabled } from '../utils/gap-smoothing';
// 앱 시작 시 API 키 로드
loadSavedApiKeys();

// 개발자 도구에서 API 키/데이터 소스 설정 가능하도록 window 객체에 함수 노출
(window as any).setFinnhubApiKey = setFinnhubApiKey;
(window as any).setDataSource = setDataSource;


// -----------------------------------------------------------------------------
// 인디케이터 오버레이 생성
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// 앱 초기화

const app = document.getElementById('app');
if (app) {
// ── 모바일 전용 CSS 주입 ──────────────────────────────────────────────────
(function injectMobileStyles() {
  const style = document.createElement('style');
  style.id = 'sigma-mobile-styles';
  style.textContent = `
    /* 전체 터치 스크롤 차단 (차트 캔버스가 직접 처리) */
    #app { touch-action: none; overflow: hidden; }

    /* 안전 영역 대응 */
    @supports (padding-bottom: env(safe-area-inset-bottom)) {
      #app { padding-bottom: env(safe-area-inset-bottom, 0); }
    }

    /* 모바일: 상단바 compact */
    @media (max-width: 600px), (pointer: coarse) {
      /* 분할 레이아웃 버튼·멀티모니터 버튼 숨김 */
      [data-topbar-split], [data-topbar-monitor], [data-topbar-screenshot] {
        display: none !important;
      }
      /* 상단바 높이 줄이지 않음 ? 가로 패딩만 최소화 */
      [data-topbar-root] { padding: 0 6px !important; gap: 4px !important; }

      /* 캔버스 터치 기본 동작 차단 */
      canvas { touch-action: none; -webkit-user-select: none; user-select: none; }

      /* 팝업/모달 스크롤 */
      .sigma-modal-body { -webkit-overflow-scrolling: touch; }

      /* 버튼 탭 하이라이트 제거 */
      button, [role="button"] {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
    }
  `;
  document.head.appendChild(style);
})();

const splitPresets = [1, 2, 4, 6, 8] as const;
  const DRAWING_STORAGE_KEY = 'my-chart-lib.drawings.v1';
  const DRAWING_KIND_SET = new Set<string>([
    'trendline',
    'hline',
    'channel',
    'fib-retracement',
    'fib-trend',
    'long-position',
    'short-position',
    'measure',
    'text-note',
  ]);
  const SYMBOL_STORAGE_KEY = 'my-chart-lib.last-symbol.v1';
  const TIMEFRAME_STORAGE_KEY = 'my-chart-lib.last-timeframe.v1';
  type PersistedDrawingEntry = {
    symbol: string;
    timeframe: TimeframeKey;
    drawings: DrawingShape[];
    drawingsVisible: boolean;
    updatedAt: number;
  };
  type PersistedDrawingStore = {
    version: 1;
    entries: Record<string, PersistedDrawingEntry>;
  };
  type TemporalDrawingSnapshot = {
    drawings: Array<{
      shape: DrawingShape;
      aTime: number | null;
      bTime: number | null;
      offsetTime: number | null;
    }>;
    drawingsVisible: boolean;
  };
  const clampCandleIndex = (candles: CandleData[], index: number): number => {
    if (!candles.length) return 0;
    return Math.max(0, Math.min(candles.length - 1, Math.round(index)));
  };
  const candleTimeAtIndex = (candles: CandleData[], index: number): number | null => {
    if (!candles.length) return null;
    const clamped = clampCandleIndex(candles, index);
    const value = Number(candles[clamped]?.time);
    return Number.isFinite(value) ? value : null;
  };
  const findNearestCandleIndexByTime = (candles: CandleData[], epochSec: number, fallback: number): number => {
    if (!candles.length) return Math.max(0, Math.round(fallback));
    if (!Number.isFinite(epochSec)) return clampCandleIndex(candles, fallback);
    let lo = 0;
    let hi = candles.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const t = Number(candles[mid]?.time);
      if (!Number.isFinite(t)) break;
      if (t < epochSec) lo = mid + 1;
      else if (t > epochSec) hi = mid - 1;
      else return mid;
    }
    const left = Math.max(0, Math.min(candles.length - 1, hi));
    const right = Math.max(0, Math.min(candles.length - 1, lo));
    const leftDiff = Math.abs(Number(candles[left]?.time) - epochSec);
    const rightDiff = Math.abs(Number(candles[right]?.time) - epochSec);
    return rightDiff < leftDiff ? right : left;
  };
  const captureTemporalDrawingSnapshot = (
    drawings: DrawingShape[],
    candles: CandleData[],
    drawingsVisible: boolean,
  ): TemporalDrawingSnapshot => {
    return {
      drawingsVisible,
      drawings: drawings.map((shape) => {
        const cloned = cloneDrawingShape(shape);
        const aTime = candleTimeAtIndex(candles, cloned.a.index);
        const bTime = cloned.b ? candleTimeAtIndex(candles, cloned.b.index) : null;
        const offsetTime = cloned.channelOffset
          ? candleTimeAtIndex(candles, cloned.a.index + cloned.channelOffset.index)
          : null;
        return {
          shape: cloned,
          aTime,
          bTime,
          offsetTime,
        };
      }),
    };
  };
  const remapTemporalDrawingSnapshot = (
    snapshot: TemporalDrawingSnapshot,
    candles: CandleData[],
  ): { drawings: DrawingShape[]; drawingsVisible: boolean } => {
    const drawings = snapshot.drawings.map((item) => {
      const next = cloneDrawingShape(item.shape);
      const nextAIndex = findNearestCandleIndexByTime(candles, Number(item.aTime), next.a.index);
      next.a.index = nextAIndex;
      if (next.b) {
        next.b.index = findNearestCandleIndexByTime(candles, Number(item.bTime), next.b.index);
      }
      if (next.channelOffset) {
        const fallbackOffsetAbs = nextAIndex + next.channelOffset.index;
        const offsetAbs = findNearestCandleIndexByTime(candles, Number(item.offsetTime), fallbackOffsetAbs);
        next.channelOffset.index = offsetAbs - nextAIndex;
      }
      return next;
    });
    return {
      drawings,
      drawingsVisible: snapshot.drawingsVisible,
    };
  };
  const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
  );
  const toFiniteNumber = (value: unknown): number | null => {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const normalizeDrawingAnchor = (value: unknown): DrawingAnchor | null => {
    if (!isRecord(value)) return null;
    const index = toFiniteNumber(value.index);
    const price = toFiniteNumber(value.price);
    if (index === null || price === null) return null;
    return { index, price };
  };
  const normalizeDrawingShape = (value: unknown): DrawingShape | null => {
    if (!isRecord(value)) return null;
    const id = typeof value.id === 'string' ? value.id : '';
    const kindRaw = typeof value.kind === 'string' ? value.kind : '';
    if (!id || !DRAWING_KIND_SET.has(kindRaw)) return null;
    const a = normalizeDrawingAnchor(value.a);
    if (!a) return null;
    const b = value.b == null ? undefined : normalizeDrawingAnchor(value.b);
    if (value.b != null && !b) return null;
    const channelOffset = value.channelOffset == null ? undefined : normalizeDrawingAnchor(value.channelOffset);
    if (value.channelOffset != null && !channelOffset) return null;
    const width = value.width == null ? undefined : toFiniteNumber(value.width);
    const lineStyle = value.lineStyle === 'dash' || value.lineStyle === 'dot' || value.lineStyle === 'solid'
      ? value.lineStyle
      : undefined;
    const alert = isRecord(value.alert)
      ? {
          enabled: Boolean(value.alert.enabled),
          mode: value.alert.mode === 'down' ? 'down' as const : 'up' as const,
          target: value.alert.target === 'price' ? 'price' as const : 'trendline' as const,
          priceValue: toFiniteNumber(value.alert.priceValue ?? undefined) ?? undefined,
          appPush: Boolean(value.alert.appPush),
          onsite: Boolean(value.alert.onsite),
          sound: Boolean(value.alert.sound),
          lastTriggerBar: toFiniteNumber(value.alert.lastTriggerBar ?? undefined) ?? undefined,
        }
      : undefined;
    return {
      id,
      kind: kindRaw as DrawingToolId,
      a,
      b: b ?? undefined,
      text: typeof value.text === 'string' ? value.text : undefined,
      color: typeof value.color === 'string' ? value.color : undefined,
      width: width ?? undefined,
      lineStyle,
      channelOffset: channelOffset ?? undefined,
      hidden: typeof value.hidden === 'boolean' ? value.hidden : undefined,
      locked: typeof value.locked === 'boolean' ? value.locked : undefined,
      alert,
    };
  };
  const normalizeSymbol = (symbol: string): string => canonicalizeUiSymbol(symbol);
  const drawingEntryKey = (symbol: string, timeframe: TimeframeKey): string => `${normalizeSymbol(symbol)}::${timeframe}`;
  const loadDrawingStore = (): PersistedDrawingStore => {
    try {
      const raw = localStorage.getItem(DRAWING_STORAGE_KEY);
      if (!raw) return { version: 1, entries: {} };
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed) || !isRecord(parsed.entries)) {
        return { version: 1, entries: {} };
      }
      const entries: Record<string, PersistedDrawingEntry> = {};
      Object.entries(parsed.entries).forEach(([key, entryRaw]) => {
        if (!isRecord(entryRaw)) return;
        const symbol = typeof entryRaw.symbol === 'string' ? normalizeSymbol(entryRaw.symbol) : '';
        const timeframe = typeof entryRaw.timeframe === 'string'
          && (TIMEFRAME_SECONDS as Record<string, number>)[entryRaw.timeframe]
          ? (entryRaw.timeframe as TimeframeKey)
          : null;
        if (!symbol || !timeframe) return;
        const drawingsRaw = Array.isArray(entryRaw.drawings) ? entryRaw.drawings : [];
        const drawings = drawingsRaw
          .map((item) => normalizeDrawingShape(item))
          .filter((item): item is DrawingShape => item !== null);
        const updatedAt = toFiniteNumber(entryRaw.updatedAt) ?? Date.now();
        entries[key] = {
          symbol,
          timeframe,
          drawings,
          drawingsVisible: typeof entryRaw.drawingsVisible === 'boolean' ? entryRaw.drawingsVisible : true,
          updatedAt,
        };
      });
      return { version: 1, entries };
    } catch {
      return { version: 1, entries: {} };
    }
  };
  const saveDrawingStore = (store: PersistedDrawingStore): void => {
    try {
      localStorage.setItem(DRAWING_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  };
  const saveDrawingEntry = (symbol: string, timeframe: TimeframeKey, chart: SimpleChart): void => {
    try {
      const normalizedSymbol = normalizeSymbol(symbol);
      if (!normalizedSymbol) return;
      const store = loadDrawingStore();
      const key = drawingEntryKey(normalizedSymbol, timeframe);
      store.entries[key] = {
        symbol: normalizedSymbol,
        timeframe,
        drawings: chart.getDrawingsSnapshot(),
        drawingsVisible: chart.isDrawingsVisible(),
        updatedAt: Date.now(),
      };
      saveDrawingStore(store);
    } catch {
      // ignore
    }
  };
  const loadDrawingEntry = (symbol: string, timeframe: TimeframeKey): PersistedDrawingEntry | null => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol) return null;
    const store = loadDrawingStore();
    const key = drawingEntryKey(normalizedSymbol, timeframe);
    const entry = store.entries[key];
    if (!entry) return null;
    return {
      ...entry,
      drawings: entry.drawings.map((shape) => cloneDrawingShape(shape)),
    };
  };
  const loadSavedSymbol = (): string | null => {
    try {
      const raw = localStorage.getItem(SYMBOL_STORAGE_KEY);
      if (!raw) return null;
      const normalized = canonicalizeUiSymbol(raw);
      return normalized ? normalized : null;
    } catch {
      return null;
    }
  };
  const saveSymbol = (symbol: string): void => {
    try {
      const normalized = canonicalizeUiSymbol(symbol);
      if (!normalized) return;
      localStorage.setItem(SYMBOL_STORAGE_KEY, normalized);
    } catch {
      // ignore
    }
  };
  const loadSavedTimeframe = (): TimeframeKey | null => {
    try {
      const raw = localStorage.getItem(TIMEFRAME_STORAGE_KEY);
      if (!raw) return null;
      return (TIMEFRAME_SECONDS as Record<string, number>)[raw] ? (raw as TimeframeKey) : null;
    } catch {
      return null;
    }
  };
  const saveTimeframe = (timeframe: TimeframeKey): void => {
    try {
      localStorage.setItem(TIMEFRAME_STORAGE_KEY, timeframe);
    } catch {
      // ignore
    }
  };
  const persistedSymbol = loadSavedSymbol();
  const persistedTimeframe = loadSavedTimeframe();
  type PaneController = {
    paneId: number;
    root: HTMLDivElement;
    chartArea: HTMLDivElement;
    chart: SimpleChart;
    refreshChartUi: () => void;
    refreshHeader: () => void;
    startLive: () => void;
    stopLive: () => void;
    reloadLiveData: () => Promise<void>;
  };

  const TFS: Array<{ key: TimeframeKey; label: string }> = [
    { key: '1s', label: '1s' },
    { key: '1m', label: '1m' },
    { key: '3m', label: '3m' },
    { key: '5m', label: '5m' },
    { key: '15m', label: '15m' },
    { key: '30m', label: '30m' },
    { key: '1h', label: '1hr' },
    { key: '2h', label: '2hr' },
    { key: '4h', label: '4hr' },
    { key: '1d', label: '1D' },
    { key: '1w', label: '1W' },
    { key: '1M', label: '1M' },
  ];
  const RANGE_BTNS = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', '전체', '??'];

  const pageUrl = new URL(window.location.href);
  const isPopout = pageUrl.searchParams.get('popout') === '1';
  // ── 모바일 감지 ──────────────────────────────────────────────────────────
  // 태블릿(768px 이상)은 PC 레이아웃 유지 ? 좌측 툴박스·하단바 표시
  const isMobile = window.innerWidth < 768
    && (/Mobi|Android|iPhone|iPod/i.test(navigator.userAgent)
      || (window.matchMedia?.('(pointer: coarse)').matches ?? false)
      || window.innerWidth < 600);

  const paneState: PaneManagerState = {
    splitCount: isPopout ? 1 : 1,
    splitPreset: 1,
    activePaneId: 0,
    maximizedPaneId: null,
    currentVisiblePaneIds: [0],
    minimizedPaneIds: new Set<number>(),
    closedPaneIds: new Set<number>(),
    allPaneIds: [],
    splitPresets: [...splitPresets],
  };
  let monitorMode: 'single' | 'multi' = 'single';
  let refreshTopControlIcons = () => {};
  let refreshStrategyReport = () => {};

  const topBarHeight = isPopout ? 0 : 40;
  // 모바일: 좌측 툴바 숨김 (width=0), 하단바도 숨김
  const drawingToolbarDockMinWidth = (isPopout || isMobile) ? 0 : 56;
  let drawingToolbarDockWidth = drawingToolbarDockMinWidth;
  // 모바일도 하단 바 공간 확보 (터치 최적화 44px)
  const bottomBarHeight = isPopout ? 0 : (isMobile ? MOBILE_BOTTOM_BAR_HEIGHT : 32);
  let reportPanelHeight = isPopout ? 0 : 320;

  const workspace = document.createElement('div');
  // 모바일에서 jumpBtn(position:absolute)이 workspace 경계 안에 표시되도록 overflow 조정
  workspace.style.cssText = `position:absolute;left:${drawingToolbarDockWidth}px;right:0;top:${topBarHeight}px;bottom:${bottomBarHeight + reportPanelHeight}px;overflow:${isMobile ? 'visible' : 'hidden'};background:#0f121b;`;
  app.appendChild(workspace);
  let bottomBarEl: HTMLDivElement | null = null;
  let drawingToolbarLayer: HTMLDivElement | null = null;
  if (!isPopout && !isMobile) {
    drawingToolbarLayer = document.createElement('div');
    drawingToolbarLayer.style.cssText = `position:absolute;left:0;top:${topBarHeight}px;bottom:0;width:${drawingToolbarDockWidth}px;z-index:1800;display:flex;align-items:stretch;justify-content:flex-start;padding:0;pointer-events:auto;border-right:1px solid #2a3244;background:linear-gradient(180deg,#0e1525 0%,#0d1422 100%);box-sizing:border-box;`;
    app.appendChild(drawingToolbarLayer);
  }
  const applyViewportOffsets = () => {
    workspace.style.left = `${drawingToolbarDockWidth}px`;
    workspace.style.top = `${topBarHeight}px`;
    workspace.style.bottom = `${bottomBarHeight + reportPanelHeight}px`;
    if (bottomBarEl) {
      bottomBarEl.style.left = `${drawingToolbarDockWidth}px`;
      bottomBarEl.style.bottom = `${reportPanelHeight}px`;
    }
    if (drawingToolbarLayer) {
      drawingToolbarLayer.style.width = `${drawingToolbarDockWidth}px`;
      drawingToolbarLayer.style.top = `${topBarHeight}px`;
      drawingToolbarLayer.style.bottom = '0';
    }
  };

  const grid = document.createElement('div');
  grid.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;display:grid;gap:1px;background:#1f2533;padding:1px;';
  workspace.appendChild(grid);

  if (!isPopout && !isMobile) {
    createLeftToolbox(drawingToolbarLayer ?? workspace);
  }

  const paneSlots: HTMLDivElement[] = [];
  for (let i = 0; i < 8; i += 1) {
    const slot = document.createElement('div');
    slot.style.cssText = 'position:relative;min-width:0;min-height:0;background:#0f172a;overflow:hidden;';
    grid.appendChild(slot);
    paneSlots.push(slot);
  }

  const paneControllers = new Map<number, PaneController>();
  paneState.allPaneIds = Array.from({ length: 8 }, (_, index) => index);

  const updateGridByCount = (count: number) => {
    updateGridTemplateByCount(grid, count);
  };

  const createPane = (paneId: number, host: HTMLDivElement): PaneController => {
    const chrome = createPaneChrome({
      host,
      chartConfig: { symbol: 'BTCUSDT', timeframe: '1h' as TimeframeKey },
      timeframes: TFS,
      createSymbolIconElement,
      getSymbolIconUrl,
      getSymbolDisplayLabel: (symbol: string) => findSymbolItem(symbol)?.label ?? symbol,
    });
    const {
      paneRoot,
      paneHeader,
      chartArea,
      tfSelect,
      currencySelect,
      symBtn,
      symIcon,
      symLabel,
      marketPriceWrap,
      symPriceLabel,
      symChangeLabel,
      symChangeMetaLabel,
      indBtn,
      strategyBtn,
      strategyReportBtn,
      marketSessionBadge,
      headerTitle,
      winCtrlWrap,
      minBtn,
      maxBtn,
      closeBtn,
      refreshSymbolVisual,
    } = chrome;
    headerTitle.style.cssText = 'display:block;margin-left:6px;padding:1px 6px;border-radius:999px;border:1px solid #3a4155;background:#22293a;color:#b5bece;font-size:10px;font-weight:700;line-height:1.4;white-space:nowrap;flex-shrink:0;';

    const chart = new SimpleChart(chartArea);
    if (persistedSymbol) {
      chart.config.symbol = persistedSymbol;
    }
    if (persistedTimeframe) {
      chart.setTimeframe(persistedTimeframe);
    }
    tfSelect.value = chart.config.timeframe;
    const persistCurrentChartDrawings = () => {
      saveDrawingEntry(chart.config.symbol, chart.config.timeframe, chart);
    };
    const restoreCurrentChartDrawings = (options: { clearWhenMissing?: boolean } = {}) => {
      const clearWhenMissing = options.clearWhenMissing ?? true;
      const entry = loadDrawingEntry(chart.config.symbol, chart.config.timeframe);
      if (!entry) {
        if (clearWhenMissing) {
          chart.setDrawingsSnapshot([]);
          chart.setDrawingsVisible(true);
        }
        return false;
      }
      chart.setDrawingsSnapshot(entry.drawings);
      chart.setDrawingsVisible(entry.drawingsVisible);
      return true;
    };
    restoreCurrentChartDrawings();

    const applyMarketInfoLayout = () => {
      const side = chart.config.layout.marketInfoSide === 'left' ? 'left' : 'right';
      if (!paneHeader.contains(symBtn)) paneHeader.insertBefore(symBtn, paneHeader.firstChild);
      if (!paneHeader.contains(winCtrlWrap)) paneHeader.appendChild(winCtrlWrap);
      if (side === 'left') {
        if (currencySelect.parentElement !== paneHeader) paneHeader.insertBefore(currencySelect, symBtn);
        paneHeader.insertBefore(currencySelect, symBtn);
        if (marketPriceWrap.parentElement !== paneHeader) paneHeader.insertBefore(marketPriceWrap, tfSelect);
        paneHeader.insertBefore(marketPriceWrap, tfSelect);
        currencySelect.style.marginLeft = '0';
        winCtrlWrap.style.marginLeft = 'auto';
      } else {
        if (marketPriceWrap.parentElement !== paneHeader) paneHeader.insertBefore(marketPriceWrap, tfSelect);
        if (currencySelect.parentElement !== paneHeader) paneHeader.insertBefore(currencySelect, winCtrlWrap);
        currencySelect.style.marginLeft = 'auto';
        winCtrlWrap.style.marginLeft = '6px';
      }
    };
    applyMarketInfoLayout();

    // 모바일: 보조지표 패널 기본 높이 확대 ? 패널 수에 따라 동적 조정
    if (isMobile) {
      const indicator_apply_mobile_ratios = () => {
        const panels = chart.activePanels;
        const cnt = panels.length;
        if (!cnt) return;
        // 기본 0.12 기준: 1개=200%(0.24), 2개=150%(0.18), 3개↑=120%(0.144)
        const baseRatio = cnt === 1 ? 0.24 : cnt === 2 ? 0.18 : 0.144;
        panels.forEach((id) => {
          const cur = chart.config.panelState.panelRatios?.[id];
          // 이미 사용자가 직접 조정한 값(기본 배수 이상)은 건드리지 않음
          if (!cur || cur <= 0.12) {
            chart.config.panelState.panelRatios[id] = baseRatio;
          }
        });
      };
      // 최초 + refreshChartUi 마다 적용 (아래에서 refreshChartUi 재정의 시 호출)
      (chart as any)._mobileRatioFn = indicator_apply_mobile_ratios;
    }

    let rawCandles = generateDummyData(300, chart.config.timeframe);
    let gapMode: GapMode = loadGapMode();
    let patternScope: PatternAnalysisScope = loadPatternAnalysisScope();
    let patternAlertEnabled = loadPatternAlertEnabled();
    let currencyRate = 1;
    const convertPrice = (price: number): number => price * currencyRate;
    const toDisplayCandles = (candles: CandleData[]): CandleData[] => {
      return candles.map((c) => ({
        ...c,
        open: convertPrice(c.open),
        high: convertPrice(c.high),
        low: convertPrice(c.low),
        close: convertPrice(c.close),
      }));
    };
    const applyDisplayCurrencyToChart = () => {
      chart.setData(toDisplayCandles(rawCandles));
    };
    chart.config.quoteCurrency = 'USDT';
    currencySelect.value = chart.config.quoteCurrency;
    chart.setGapMode(gapMode);
    chart.setPatternAnalysisScope(patternScope);
    chart.setPatternAlertEnabled(patternAlertEnabled);
    applyDisplayCurrencyToChart();
    window.addEventListener('my-chart-lib:gap-mode-updated', () => {
      gapMode = loadGapMode();
      chart.setGapMode(gapMode);
      applyDisplayCurrencyToChart();
      refreshChartUi();
    });
    window.addEventListener('my-chart-lib:pattern-scope-updated', () => {
      patternScope = loadPatternAnalysisScope();
      chart.setPatternAnalysisScope(patternScope);
      refreshChartUi();
    });
    window.addEventListener('my-chart-lib:pattern-alert-updated', () => {
      patternAlertEnabled = loadPatternAlertEnabled();
      chart.setPatternAlertEnabled(patternAlertEnabled);
      refreshChartUi();
    });

    const dividerManager = createPanelDividerManager({
      chart,
      chartArea,
      xAxisHeight: X_AXIS_HEIGHT,
      resizePanelBoundary,
    });
    let refreshChartUi = () => {};
    const refreshOverlay = createIndicatorOverlay(chartArea, chart, () => refreshChartUi());
    dividerManager.setOnAfterResize(() => refreshOverlay());
    chart.onAfterResize = () => {
      dividerManager.syncDividers();
      refreshOverlay();
    };
    refreshChartUi = () => {
      if (isMobile) (chart as any)._mobileRatioFn?.();
      refreshOverlay();
      dividerManager.syncDividers();
      refreshHeader();
      refreshStrategyReport();
    };

    const applyMockData = () => {
      rawCandles = generateDummyData(300, chart.config.timeframe);
      applyDisplayCurrencyToChart();
      refreshChartUi();
    };

    let liveStatus: 'idle' | 'connecting' | 'live' | 'fallback' = 'idle';
    const setLiveStatus = (status: 'idle' | 'connecting' | 'live' | 'fallback') => {
      liveStatus = status;
      refreshHeader();
    };
    const normalizeExchangeSymbol = (symbol: string): string => symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const resolveExchangeMarketSymbol = (rawSymbol: string): { market: 'spot' | 'futures'; symbol: string } => {
      const upper = rawSymbol.trim().toUpperCase();
      if (upper.endsWith('.P')) {
        return {
          market: 'futures',
          symbol: normalizeExchangeSymbol(upper.slice(0, -2)),
        };
      }
      return {
        market: 'spot',
        symbol: normalizeExchangeSymbol(upper),
      };
    };
    const exchange24hState: {
      key: string;
      percent: number;
      updatedAt: number;
      inflight: boolean;
      seq: number;
    } = {
      key: '',
      percent: NaN,
      updatedAt: 0,
      inflight: false,
      seq: 0,
    };
    const refreshExchange24hPercent = async (force = false) => {
      const resolved = resolveExchangeMarketSymbol(chart.config.symbol);
      const key = `${resolved.market}:${resolved.symbol}`;
      const now = Date.now();
      if (
        !force
        && exchange24hState.key === key
        && Number.isFinite(exchange24hState.percent)
        && now - exchange24hState.updatedAt < 45_000
      ) {
        return;
      }
      if (exchange24hState.inflight && !force) return;
      exchange24hState.key = key;
      exchange24hState.inflight = true;
      const seq = ++exchange24hState.seq;
      const endpoint = resolved.market === 'futures'
        ? `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${resolved.symbol}`
        : `https://api.binance.com/api/v3/ticker/24hr?symbol=${resolved.symbol}`;
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`24h ticker error: ${response.status}`);
        const json = await response.json() as { priceChangePercent?: string | number };
        const percent = Number(json.priceChangePercent);
        if (seq !== exchange24hState.seq || exchange24hState.key !== key) return;
        if (Number.isFinite(percent)) {
          exchange24hState.percent = percent;
        }
        exchange24hState.updatedAt = Date.now();
        refreshHeader();
      } catch {
        if (seq !== exchange24hState.seq || exchange24hState.key !== key) return;
        exchange24hState.updatedAt = Date.now();
      } finally {
        if (seq === exchange24hState.seq) {
          exchange24hState.inflight = false;
        }
      }
    };

    const refreshHeader = () => {
      applyMarketInfoLayout();
      const visibleCount = paneState.currentVisiblePaneIds.filter((id) => paneSlots[id].style.display !== 'none').length;
      refreshSymbolVisual(chart.config.symbol);
      tfSelect.value = chart.config.timeframe;
      void refreshExchange24hPercent();
      const candles = chart.getCandles();
      const lastClose = candles.length ? candles[candles.length - 1].close : NaN;
      const lastTs = candles.length ? candles[candles.length - 1].time : NaN;
      const nowSec = Math.floor(Date.now() / 1000);
      const tfSec = TIMEFRAME_SECONDS[chart.config.timeframe] ?? 60;
      const staleThresholdSec = Math.max(180, tfSec * 3);
      const alwaysOpenMarket = shouldUseBinanceDirect(chart.config.symbol);
      const cmeSessionSymbol = isNasdaqFuturesLikeSymbol(chart.config.symbol);
      const sessionOpen = alwaysOpenMarket
        ? true
        : cmeSessionSymbol
          ? isCmeEquityFuturesOpen(new Date())
          : (Number.isFinite(lastTs) && nowSec - lastTs <= staleThresholdSec);
      marketSessionBadge.style.background = sessionOpen ? '#1fbf75' : '#e24a4a';
      marketSessionBadge.style.borderColor = sessionOpen ? '#2f8f66' : '#9d3c3c';
      marketSessionBadge.title = sessionOpen ? '장오픈' : '장마감';

      let baseClose24h = NaN;
      if (Number.isFinite(lastTs) && candles.length) {
        const targetTs = lastTs - 86400;
        let pickIndex = 0;
        for (let i = candles.length - 1; i >= 0; i -= 1) {
          if (candles[i].time <= targetTs) {
            pickIndex = i;
            break;
          }
        }
        baseClose24h = candles[pickIndex]?.close ?? NaN;
      }
      const fallbackDiff = Number.isFinite(lastClose) && Number.isFinite(baseClose24h) ? lastClose - baseClose24h : NaN;
      const fallbackPct = Number.isFinite(fallbackDiff) && baseClose24h !== 0 ? (fallbackDiff / baseClose24h) * 100 : NaN;
      const resolved = resolveExchangeMarketSymbol(chart.config.symbol);
      const currentKey = `${resolved.market}:${resolved.symbol}`;
      const exchangePct = exchange24hState.key === currentKey ? exchange24hState.percent : NaN;
      const pct = Number.isFinite(exchangePct) ? exchangePct : fallbackPct;
      if (Number.isFinite(lastClose) && Number.isFinite(pct)) {
        const isUp = pct >= 0;
        const priceDigits = getSymbolPricePrecision(chart.config.symbol, chart.config.quoteCurrency);
        const tone = isUp ? '#39d98a' : '#ff7f7f';
        symPriceLabel.style.color = tone;
        symPriceLabel.textContent = formatWithComma(lastClose, priceDigits);
        symChangeLabel.style.color = tone;
        symChangeLabel.textContent = `${isUp ? '+' : ''}${pct.toFixed(2)}%`;
        symChangeMetaLabel.style.color = '#7f889a';
      } else {
        symPriceLabel.style.color = '#9aa7c1';
        symPriceLabel.textContent = '--';
        symChangeLabel.style.color = '#9aa7c1';
        symChangeLabel.textContent = '--';
      }
      if (liveStatus === 'live') {
        headerTitle.textContent = 'LIVE';
        headerTitle.style.background = '#1d3a30';
        headerTitle.style.borderColor = '#2a6c56';
        headerTitle.style.color = '#4ae3a5';
      } else if (liveStatus === 'connecting') {
        headerTitle.textContent = 'CONNECTING';
        headerTitle.style.background = '#3a3020';
        headerTitle.style.borderColor = '#7d5a2e';
        headerTitle.style.color = '#ffd27a';
      } else if (liveStatus === 'fallback') {
        headerTitle.textContent = 'FALLBACK';
        headerTitle.style.background = '#3a2323';
        headerTitle.style.borderColor = '#7b3a3a';
        headerTitle.style.color = '#ff9b9b';
      } else {
        headerTitle.textContent = 'IDLE';
        headerTitle.style.background = '#22293a';
        headerTitle.style.borderColor = '#3a4155';
        headerTitle.style.color = '#b5bece';
      }
      minBtn.textContent = paneState.minimizedPaneIds.has(paneId) ? '+' : '?';
      minBtn.title = paneState.minimizedPaneIds.has(paneId) ? '최소화 해제' : '최소화';
      maxBtn.textContent = paneState.maximizedPaneId === paneId ? '?' : '□';
      maxBtn.title = paneState.maximizedPaneId === paneId ? '최대화 해제' : '최대화';
      winCtrlWrap.style.display = (visibleCount <= 1 && paneState.maximizedPaneId === null) ? 'none' : 'flex';
    };

    const fallbackTicker = createLiveTicker({
      chart: {
        config: chart.config,
        addNewCandle: (candle) => {
          chart.addNewCandle({
            ...candle,
            open: convertPrice(candle.open),
            high: convertPrice(candle.high),
            low: convertPrice(candle.low),
            close: convertPrice(candle.close),
          });
        },
        updateLastCandle: (patch) => {
          chart.updateLastCandle({
            ...patch,
            close: convertPrice(patch.close),
            high: convertPrice(patch.high),
            low: convertPrice(patch.low),
          });
        },
      },
      getData: () => rawCandles,
      getBucketStartSec,
      shiftBucketSec,
      onTick: () => refreshHeader(),
    });
    const binanceFeed = createBinanceLiveFeed({
      chart: {
        config: chart.config,
        setData: (candles) => {
          rawCandles = candles.slice();
          chart.setData(toDisplayCandles(rawCandles));
        },
        getCandles: () => rawCandles,
        addNewCandle: (candle) => {
          rawCandles.push(candle);
          if (gapMode === 'smooth') {
            applyDisplayCurrencyToChart();
            return;
          }
          chart.addNewCandle({
            ...candle,
            open: convertPrice(candle.open),
            high: convertPrice(candle.high),
            low: convertPrice(candle.low),
            close: convertPrice(candle.close),
          });
        },
        updateLastCandle: (patch) => {
          const last = rawCandles[rawCandles.length - 1];
          if (!last) return;
          if (Number.isFinite(patch.close)) last.close = patch.close;
          if (Number.isFinite(patch.high)) last.high = patch.high;
          if (Number.isFinite(patch.low)) last.low = patch.low;
          if (Number.isFinite(patch.volume)) last.volume = patch.volume;
          if (gapMode === 'smooth') {
            applyDisplayCurrencyToChart();
            return;
          }
          chart.updateLastCandle({
            close: convertPrice(last.close),
            high: convertPrice(last.high),
            low: convertPrice(last.low),
            volume: last.volume,
          });
        },
      },
      limit: 3000,
      onDataApplied: (candles) => {
        rawCandles = candles.slice();
        applyDisplayCurrencyToChart();
        refreshChartUi();
      },
      onLiveTick: () => {
        refreshHeader();
      },
      onStatusChange: (status) => {
        setLiveStatus(status);
      },
    });
    const gatewayFeed = createGatewayLiveFeed({
      chart: {
        config: chart.config,
        setData: (candles) => {
          rawCandles = candles.slice();
          chart.setData(toDisplayCandles(rawCandles));
        },
        getCandles: () => rawCandles,
        addNewCandle: (candle) => {
          rawCandles.push(candle);
          if (gapMode === 'smooth') {
            applyDisplayCurrencyToChart();
            return;
          }
          chart.addNewCandle({
            ...candle,
            open: convertPrice(candle.open),
            high: convertPrice(candle.high),
            low: convertPrice(candle.low),
            close: convertPrice(candle.close),
          });
        },
        updateLastCandle: (patch) => {
          const last = rawCandles[rawCandles.length - 1];
          if (!last) return;
          if (Number.isFinite(patch.close)) last.close = patch.close;
          if (Number.isFinite(patch.high)) last.high = patch.high;
          if (Number.isFinite(patch.low)) last.low = patch.low;
          if (Number.isFinite(patch.volume)) last.volume = patch.volume;
          if (gapMode === 'smooth') {
            applyDisplayCurrencyToChart();
            return;
          }
          chart.updateLastCandle({
            close: convertPrice(last.close),
            high: convertPrice(last.high),
            low: convertPrice(last.low),
            volume: last.volume,
          });
        },
      },
      limit: 3000,
      onDataApplied: (candles) => {
        rawCandles = candles.slice();
        applyDisplayCurrencyToChart();
        refreshChartUi();
      },
      onLiveTick: () => {
        refreshHeader();
      },
      onStatusChange: (status) => {
        setLiveStatus(status);
      },
    });

    const reloadLiveData = async () => {
      liveRunning = true;
      fallbackTicker.stopLive();
      binanceFeed.stop();
      gatewayFeed.stop();
      setLiveStatus('connecting');
      void refreshExchange24hPercent(true);
      const selectedFeed = shouldUseBinanceDirect(chart.config.symbol) ? binanceFeed : gatewayFeed;
      const ok = await selectedFeed.reload();
      if (!ok) {
        binanceFeed.stop();
        gatewayFeed.stop();
        applyMockData();
        setLiveStatus('fallback');
        fallbackTicker.startLive();
      }
    };
    let liveRunning = false;
    const applyCurrencySelection = async () => {
      chart.config.quoteCurrency = (currencySelect.value as DisplayCurrency) || 'USDT';
      currencyRate = await getUsdtToDisplayRate(chart.config.quoteCurrency);
      applyDisplayCurrencyToChart();
      refreshChartUi();
    };
    currencySelect.addEventListener('change', () => {
      void applyCurrencySelection();
    });
    window.setInterval(() => {
      if (chart.config.quoteCurrency === 'USDT' || chart.config.quoteCurrency === 'USD') return;
      void applyCurrencySelection();
    }, 60_000);
    void applyCurrencySelection();

    bindPaneEventHandlers<TimeframeKey>({
      symBtn,
      tfSelect,
      indBtn,
      strategyBtn,
      strategyReportBtn,
      minBtn,
      maxBtn,
      closeBtn,
      onSymbolClick: () => {
        openSymbolModal(chart, symLabel, symIcon, async (selectedSymbol) => {
          persistCurrentChartDrawings();
          // ? config.symbol 먼저 갱신 → binanceFeed.reload()가 올바른 심볼로 연결
          const canonical = canonicalizeUiSymbol(selectedSymbol);
          chart.config.symbol = canonical;
          saveSymbol(canonical);
          restoreCurrentChartDrawings();
          void reloadLiveData();
        });
      },
      onTimeframeChange: (timeframe) => {
        const beforeSnapshot = captureTemporalDrawingSnapshot(
          chart.getDrawingsSnapshot(),
          rawCandles,
          chart.isDrawingsVisible(),
        );
        persistCurrentChartDrawings();
        chart.setTimeframe(timeframe);
        saveTimeframe(timeframe);
        const hasStoredTarget = restoreCurrentChartDrawings({ clearWhenMissing: false });
        void reloadLiveData().then(() => {
          if (hasStoredTarget) {
            persistCurrentChartDrawings();
            return;
          }
          const remapped = remapTemporalDrawingSnapshot(beforeSnapshot, rawCandles);
          chart.setDrawingsSnapshot(remapped.drawings);
          chart.setDrawingsVisible(remapped.drawingsVisible);
          persistCurrentChartDrawings();
          refreshChartUi();
        });
      },
      onIndicatorClick: () => openIndicatorModal(chart, refreshChartUi),
      onStrategyClick: () => openStrategyModal(chart, refreshChartUi),
      onStrategyReportClick: () => {
        window.dispatchEvent(new CustomEvent('chart-open-strategy-report', {
          detail: { chart },
        }));
      },
      onMinimizeClick: () => {
        togglePaneMinimize(paneId);
        refreshHeader();
      },
      onMaximizeClick: () => {
        togglePaneMaximize(paneId);
        refreshHeader();
      },
      onCloseClick: () => {
        closePane(paneId);
      },
    });

    const startLive = () => {
      if (liveRunning) return;
      void reloadLiveData();
    };
    const stopLive = () => {
      if (!liveRunning) return;
      liveRunning = false;
      binanceFeed.stop();
      gatewayFeed.stop();
      fallbackTicker.stopLive();
    };

    paneRoot.addEventListener('mousedown', () => setActivePane(paneId));
    window.setInterval(() => {
      persistCurrentChartDrawings();
    }, 1500);

    refreshChartUi();
    refreshHeader();

    return {
      paneId,
      root: host,
      chartArea,
      chart,
      refreshChartUi,
      refreshHeader,
      startLive,
      stopLive,
      reloadLiveData,
    };
  };

  const ensurePane = (paneId: number): PaneController => {
    const existing = paneControllers.get(paneId);
    if (existing) return existing;
    const pane = createPane(paneId, paneSlots[paneId]);

    if (isPopout) {
      saveDrawingEntry(pane.chart.config.symbol, pane.chart.config.timeframe, pane.chart);
      const symbol = pageUrl.searchParams.get('symbol');
      const tf = pageUrl.searchParams.get('tf') as TimeframeKey | null;
      if (symbol) {
        const canonical = canonicalizeUiSymbol(symbol);
        pane.chart.config.symbol = canonical;
        saveSymbol(canonical);
      }
      if (tf && TIMEFRAME_SECONDS[tf]) {
        pane.chart.setTimeframe(tf);
        saveTimeframe(tf);
      }
      const popoutEntry = loadDrawingEntry(pane.chart.config.symbol, pane.chart.config.timeframe);
      if (popoutEntry) {
        pane.chart.setDrawingsSnapshot(popoutEntry.drawings);
        pane.chart.setDrawingsVisible(popoutEntry.drawingsVisible);
      } else {
        pane.chart.setDrawingsSnapshot([]);
        pane.chart.setDrawingsVisible(true);
      }
      void pane.reloadLiveData();
    }

    paneControllers.set(paneId, pane);
    return pane;
  };

  const getActivePane = (): PaneController => {
    return ensurePane(paneState.activePaneId);
  };

  const paneManager = createPaneManager({
    state: paneState,
    paneSlots,
    ensurePane,
    getPaneIfAny: (paneId) => paneControllers.get(paneId),
    refreshTopControlIcons: () => refreshTopControlIcons(),
    updateGridByCount,
  });

  const setActivePane = (paneId: number) => {
    paneManager.setActivePane(paneId);
    applyActivePaneOutline({
      paneSlots,
      currentVisiblePaneIds: paneState.currentVisiblePaneIds,
      activePaneId: paneState.activePaneId,
    });
    refreshStrategyReport();
  };

  const renderPaneVisibility = () => {
    paneManager.renderPaneVisibility();
  };

  const applySplitLayout = (
    count: number,
    options: { resetClosed?: boolean; updatePreset?: boolean } = {},
  ) => {
    paneManager.applySplitLayout(count, options);
  };

  const togglePaneMinimize = (paneId: number) => {
    paneManager.togglePaneMinimize(paneId);
  };

  const togglePaneMaximize = (paneId: number) => {
    paneManager.togglePaneMaximize(paneId);
  };

  const closePane = (paneId: number) => {
    paneManager.closePane(paneId);
  };

  const openMultiMonitor = () => {
    monitorMode = 'multi';
    refreshTopControlIcons();
    const targets = paneState.currentVisiblePaneIds.filter((paneId) => !paneState.minimizedPaneIds.has(paneId));
    openMultiMonitorPopouts({
      sourceUrl: window.location.href,
      panes: targets.map((paneId) => {
        const pane = ensurePane(paneId);
        return {
          symbol: pane.chart.config.symbol,
          timeframe: pane.chart.config.timeframe,
        };
      }),
    });
  };

  const saveActivePaneScreenshot = () => {
    const pane = getActivePane();
    const a = document.createElement('a');
    a.download = `${pane.chart.config.symbol}_${pane.chart.config.timeframe}.png`;
    a.href = pane.chart.canvas.toDataURL();
    a.click();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  if (!isPopout) {
    const exitMaximize = () => {
      if (paneState.maximizedPaneId === null) return;
      paneState.maximizedPaneId = null;
      renderPaneVisibility();
    };

    const topBarControls = createTopBar({
      app,
      splitPresets,
      getSplitCount: () => paneState.splitCount,
      getSplitPreset: () => paneState.splitPreset,
      getMonitorMode: () => monitorMode,
      setMonitorMode: (mode) => {
        monitorMode = mode;
      },
      onApplySplitLayout: (count) => applySplitLayout(count, { resetClosed: true, updatePreset: true }),
      onOpenMultiMonitor: () => openMultiMonitor(),
      onSaveScreenshot: saveActivePaneScreenshot,
      onToggleFullscreen: toggleFullscreen,
      onOpenSettings: () => {
        const pane = getActivePane();
        openChartSettingsModal(pane.chart, () => {
          pane.refreshChartUi();
          pane.refreshHeader();
        }, pane.refreshHeader);
      },
      isPaneMaximized: () => paneState.maximizedPaneId !== null,
      onExitMaximize: exitMaximize,
    });
    refreshTopControlIcons = topBarControls.refreshTopControlIcons;

    if (isMobile) {
      // ??????????????????????????????????????????????????????????????????????
      // 모바일: 하단 44px 고정 바 + 두 개의 슬라이드업 패널
      //  - 기간 버튼 (문자) → 슬라이드업: 기간 선택
      //  - 드로잉 버튼 (연필 SVG) → 슬라이드업: 드로잉 툴 선택
      //  - 우측: 현재 UTC 시간 표시
      //  - 플로팅: >> 버튼 (최신 캔들 이동)
      // ??????????????????????????????????????????????????????????????????????

      // ── 공통 backdrop ─────────────────────────────────────────────────
      const slideBackdrop = document.createElement('div');
      slideBackdrop.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2900',
        'background:rgba(0,0,0,0)', 'pointer-events:none',
        'transition:background 0.25s',
      ].join(';');
      app.appendChild(slideBackdrop);

      // ── 슬라이드업 패널 생성 헬퍼 ─────────────────────────────────────
      let display_current_panel: HTMLDivElement | null = null;

      const display_create_slide_panel = (titleText: string): HTMLDivElement => {
        const panel = document.createElement('div');
        panel.style.cssText = [
          'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:2950',
          'background:#131d2e', 'border-top:1px solid #2a3a56',
          'border-radius:18px 18px 0 0',
          'padding-bottom:env(safe-area-inset-bottom,0px)',
          'transform:translateY(100%)',
          'transition:transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          'font-family:inherit',
        ].join(';');
        // 드래그 핸들
        const handle = document.createElement('div');
        handle.style.cssText = 'display:flex;justify-content:center;padding:12px 0 4px;cursor:pointer;';
        handle.innerHTML = '<div style="width:40px;height:4px;border-radius:2px;background:#3a4a66;"></div>';
        panel.appendChild(handle);
        // 타이틀
        const titleEl = document.createElement('div');
        titleEl.textContent = titleText;
        titleEl.style.cssText = [
          'color:#7a8aab', 'font-size:11px', 'font-weight:700',
          'letter-spacing:.9px', 'text-align:center',
          'padding:6px 0 12px', 'text-transform:uppercase',
        ].join(';');
        panel.appendChild(titleEl);
        app.appendChild(panel);
        handle.addEventListener('click', display_close_panel);
        return panel;
      };

      const display_open_panel = (panel: HTMLDivElement) => {
        if (display_current_panel && display_current_panel !== panel) {
          display_current_panel.style.transform = 'translateY(100%)';
        }
        display_current_panel = panel;
        panel.style.transform = 'translateY(0)';
        slideBackdrop.style.background    = 'rgba(0,0,0,0.5)';
        slideBackdrop.style.pointerEvents = 'auto';
      };
      const display_close_panel = () => {
        if (display_current_panel) {
          display_current_panel.style.transform = 'translateY(100%)';
          display_current_panel = null;
        }
        slideBackdrop.style.background    = 'rgba(0,0,0,0)';
        slideBackdrop.style.pointerEvents = 'none';
      };
      slideBackdrop.addEventListener('click', display_close_panel);

      // ????????????????????????????????????????????????????????????????????
      // 슬라이드업 패널 A: 기간 선택
      // ????????????????????????????????????????????????????????????????????
      const rangePanelEl = display_create_slide_panel('기간 선택');
      const rangeGrid = document.createElement('div');
      rangeGrid.style.cssText = [
        'display:grid', 'grid-template-columns:repeat(5,1fr)',
        'gap:8px', 'padding:0 16px 20px',
      ].join(';');
      rangePanelEl.appendChild(rangeGrid);

      RANGE_BTNS.forEach((label) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = [
          'background:#1c2840', 'color:#c2ccdf', 'border:1px solid #2e3f5c',
          'border-radius:8px', 'padding:11px 4px',
          'font-size:13px', 'font-family:inherit', 'font-weight:700',
          'cursor:pointer', 'touch-action:manipulation',
          '-webkit-tap-highlight-color:transparent',
          'transition:background 0.12s,color 0.12s,border-color 0.12s',
        ].join(';');
        btn.addEventListener('touchstart', () => {
          btn.style.background  = '#2962ff';
          btn.style.color       = '#fff';
          btn.style.borderColor = '#2962ff';
        }, { passive: true });
        btn.addEventListener('touchend', () => {
          setTimeout(() => {
            btn.style.background  = '#1c2840';
            btn.style.color       = '#c2ccdf';
            btn.style.borderColor = '#2e3f5c';
          }, 400);
        }, { passive: true });
        btn.addEventListener('click', () => {
          applyRangeToChart(getActivePane().chart, label);
          display_close_panel();
        });
        rangeGrid.appendChild(btn);
      });

      // ????????????????????????????????????????????????????????????????????
      // 슬라이드업 패널 B: 드로잉 툴 선택
      // ????????????????????????????????????????????????????????????????????
      const toolPanelEl = display_create_slide_panel('드로잉 도구');
      createMobileDrawingToolPanel({
        toolPanelEl,
        getActivePane: () => getActivePane() as any,
        closePanel: display_close_panel,
      });

      // ????????????????????????????????????????????????????????????????????
      // 하단 44px 고정 바
      // ????????????????????????????????????????????????????????????????????
      const mobileBarEl = document.createElement('div');
      mobileBarEl.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0',
        `height:${MOBILE_BOTTOM_BAR_HEIGHT}px`,
        'z-index:1500',
        'display:flex', 'flex-direction:row',
        'align-items:center',
        'gap:6px', 'padding:0 10px',
        'background:#0e1525',
        'border-top:1px solid #2a3244',
        'box-sizing:border-box',
        'font-family:inherit',
      ].join(';');
      app.appendChild(mobileBarEl);
      bottomBarEl = mobileBarEl as unknown as HTMLDivElement;

      // 공통 버튼 스타일
      const MOBILE_BAR_BTN = [
        'display:inline-flex', 'align-items:center', 'justify-content:center',
        'height:32px', 'padding:0 12px',
        'background:#1c2840', 'color:#c2ccdf',
        'border:1px solid #2e3f5c', 'border-radius:7px',
        'font-size:13px', 'font-family:inherit', 'font-weight:700',
        'white-space:nowrap', 'flex-shrink:0', 'cursor:pointer',
        'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
        'transition:background 0.12s,border-color 0.12s',
      ].join(';');

      // 기간 버튼 (문자)
      const rangeTriggerBtn = document.createElement('button');
      rangeTriggerBtn.textContent = '기간';
      rangeTriggerBtn.title = '기간 선택';
      rangeTriggerBtn.style.cssText = MOBILE_BAR_BTN;
      rangeTriggerBtn.addEventListener('touchstart', () => {
        rangeTriggerBtn.style.background  = '#2962ff';
        rangeTriggerBtn.style.borderColor = '#2962ff';
        rangeTriggerBtn.style.color       = '#fff';
      }, { passive: true });
      rangeTriggerBtn.addEventListener('touchend', () => {
        setTimeout(() => {
          rangeTriggerBtn.style.background  = '#1c2840';
          rangeTriggerBtn.style.borderColor = '#2e3f5c';
          rangeTriggerBtn.style.color       = '#c2ccdf';
        }, 200);
      }, { passive: true });
      rangeTriggerBtn.addEventListener('click', () => {
        if (display_current_panel === rangePanelEl) display_close_panel();
        else display_open_panel(rangePanelEl);
      });
      mobileBarEl.appendChild(rangeTriggerBtn);

      // 드로잉 버튼 (모바일 툴박스 모듈)
      const toolTriggerBtn = createMobileDrawingTriggerButton(MOBILE_BAR_BTN);
      toolTriggerBtn.addEventListener('touchstart', () => {
        toolTriggerBtn.style.background  = '#2962ff';
        toolTriggerBtn.style.borderColor = '#2962ff';
        toolTriggerBtn.style.color       = '#fff';
      }, { passive: true });
      toolTriggerBtn.addEventListener('touchend', () => {
        setTimeout(() => {
          toolTriggerBtn.style.background  = '#1c2840';
          toolTriggerBtn.style.borderColor = '#2e3f5c';
          toolTriggerBtn.style.color       = '#c2ccdf';
        }, 200);
      }, { passive: true });
      toolTriggerBtn.addEventListener('click', () => {
        if (display_current_panel === toolPanelEl) display_close_panel();
        else display_open_panel(toolPanelEl);
      });
      mobileBarEl.appendChild(toolTriggerBtn);

      // ── 우측: 시계 + 타임존 (bottom-bar.ts 와 동일) ──────────────────────
      const tzWrap = document.createElement('div');
      tzWrap.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:8px;padding-right:4px;flex-shrink:0;';

      const clockEl = document.createElement('span');
      clockEl.style.color = '#d1d4dc';

      const tzBtn = document.createElement('button');
      tzBtn.type = 'button';
      tzBtn.style.cssText = 'background:#1c2030;color:#d1d4dc;border:1px solid #2a2e3e;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;touch-action:manipulation;';

      const display_refresh_tz = () => {
        tzBtn.textContent = formatTimezoneLabel(getActivePane().chart.config.timezone);
      };
      tzBtn.addEventListener('click', () => {
        openTimezoneModal(getActivePane().chart, display_refresh_tz);
      });

      const display_update_clock = () => {
        clockEl.textContent = formatDateWithTimezone(new Date(), getActivePane().chart.config.timezone, {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        });
      };
      display_refresh_tz();
      display_update_clock();
      window.setInterval(display_update_clock, 1000);

      tzWrap.append(clockEl, tzBtn);
      mobileBarEl.appendChild(tzWrap);

      // ── 플로팅 버튼: >> (최상단 보조지표 바로 위, 가격축 안쪽) ───────────
      const JUMP_BTN_SIZE = 36;  // 40px의 10% 감소
      const jumpBtn = document.createElement('button');
      jumpBtn.innerHTML = MOBILE_JUMP_LATEST_SVG;
      jumpBtn.title = '최신 캔들로 이동';
      jumpBtn.style.cssText = [
        'position:absolute',
        `width:${JUMP_BTN_SIZE}px`, `height:${JUMP_BTN_SIZE}px`,
        'z-index:1600',
        'display:flex', 'align-items:center', 'justify-content:center',
        'background:#1e2740', 'color:#c2ccdf',
        'border:1px solid #3a4a66', 'border-radius:50%',
        'cursor:pointer', 'padding:0',
        'box-shadow:0 3px 12px rgba(0,0,0,0.55)',
        'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
        'transition:background 0.12s,border-color 0.12s',
        'opacity:0.88',
      ].join(';');

      // 위치 계산: 최상단 보조지표 패널 바로 위 + 가격축 왼쪽(최근 캔들 부근)
      const display_update_jump_pos = () => {
        const pane = getActivePane();
        const panels = pane.chart.activePanels as string[];
        const ca    = pane.chartArea;
        const rightPad: number = (pane.chart.config as any).layout?.rightPadding ?? 70;
        const side: 'left' | 'right' = ((pane.chart.config as any).layout?.marketInfoSide === 'left') ? 'left' : 'right';

        // X: 가격축 안쪽
        if (side === 'left') {
          jumpBtn.style.left = `${rightPad + 4}px`;
          jumpBtn.style.right = 'auto';
        } else {
          jumpBtn.style.right = `${rightPad + 4}px`;
          jumpBtn.style.left = 'auto';
        }

        const wsRect = workspace.getBoundingClientRect();
        const caRect = ca.getBoundingClientRect();

        if (panels.length) {
          // 첫 보조지표 패널 상단 = plotHeight × (1 - 전체 서브비율)
          const plotH  = Math.max(40, ca.clientHeight - 22); // X_AXIS_HEIGHT=22
          const subRat = panels.reduce((s: number, id: string) =>
            s + pane.chart.getPanelRatio(id), 0);
          const dividerTop = plotH * (1 - subRat); // chartArea 내 Y

          // workspace 좌표로 변환
          const dividerAbsTop = caRect.top + dividerTop;
          const dividerRelTop = dividerAbsTop - wsRect.top;

          jumpBtn.style.top    = `${dividerRelTop - JUMP_BTN_SIZE - 6}px`;
          jumpBtn.style.bottom = 'auto';
        } else {
          // 보조지표 없으면 시간축 바로 위
          const caBottomRel = caRect.bottom - wsRect.top;
          jumpBtn.style.top    = `${caBottomRel - 22 - JUMP_BTN_SIZE - 6}px`;
          jumpBtn.style.bottom = 'auto';
        }
      };

      jumpBtn.addEventListener('touchstart', () => {
        jumpBtn.style.background  = '#2962ff';
        jumpBtn.style.borderColor = '#2962ff';
        jumpBtn.style.opacity     = '1';
      }, { passive: true });
      jumpBtn.addEventListener('touchend', () => {
        setTimeout(() => {
          jumpBtn.style.background  = '#1e2740';
          jumpBtn.style.borderColor = '#3a4a66';
          jumpBtn.style.opacity     = '0.88';
        }, 250);
      }, { passive: true });
      jumpBtn.addEventListener('click', () => {
        getActivePane().chart.jumpToLatest();
      });

      workspace.appendChild(jumpBtn);

      // 초기 위치 설정 및 리사이즈·패널 변경 시 재계산
      requestAnimationFrame(display_update_jump_pos);
      window.addEventListener('resize', display_update_jump_pos);
      window.addEventListener('orientationchange', () =>
        setTimeout(display_update_jump_pos, 220));
      // 패널 크기 변경(divider 드래그) 후에도 갱신
      window.setInterval(display_update_jump_pos, 400);

    } else {
      // ── 데스크톱: 기존 하단바 ──────────────────────────────────────────
      bottomBarEl = createBottomBar({
        app,
        rangeButtons: RANGE_BTNS,
        bottomOffset: reportPanelHeight,
        leftInset: drawingToolbarDockWidth,
        getActivePane,
        onApplyRange: (label) => applyRangeToChart(getActivePane().chart, label),
        onOpenTimezone: (chart, onUpdated) => openTimezoneModal(chart, onUpdated),
        formatDateWithTimezone,
        formatTimezoneLabel,
      });
    }

    const strategyReport = createStrategyReportPanel({
      app,
      height: reportPanelHeight,
      leftInset: drawingToolbarDockWidth,
      getActiveChart: () => getActivePane().chart,
      onHeightChange: (nextHeight) => {
        reportPanelHeight = nextHeight;
        applyViewportOffsets();
      },
    });
    // 모바일에서는 전략 리포트 패널 비활성화
    if (isMobile) strategyReport.setVisible(false);
    const strategyReportOpenByPane = new Map<number, boolean>();
    const resolvePaneIdByChart = (targetChart: unknown): number | null => {
      for (const [paneId, pane] of paneControllers.entries()) {
        if (pane.chart === targetChart) return paneId;
      }
      return null;
    };
    strategyReport.setVisible(false);
    window.addEventListener('chart-toolbox-layout', (event: Event) => {
      if (isMobile) return;  // 모바일: 툴바 레이아웃 이벤트 무시
      const customEvent = event as CustomEvent<{ width?: number }>;
      const nextWidth = Number(customEvent.detail?.width ?? drawingToolbarDockMinWidth);
      const normalized = Number.isFinite(nextWidth) ? Math.max(drawingToolbarDockMinWidth, Math.round(nextWidth)) : drawingToolbarDockMinWidth;
      if (normalized === drawingToolbarDockWidth) return;
      drawingToolbarDockWidth = normalized;
      strategyReport.setLeftInset(drawingToolbarDockWidth);
      applyViewportOffsets();
    });
    window.addEventListener('chart-open-strategy-report', (event: Event) => {
      const customEvent = event as CustomEvent<{ chart?: unknown }>;
      const requestedPaneId = customEvent.detail?.chart != null
        ? resolvePaneIdByChart(customEvent.detail.chart)
        : null;
      const paneId = requestedPaneId ?? paneState.activePaneId;
      const pane = ensurePane(paneId);
      const hasActiveStrategy = Boolean(pane.chart.getActiveStrategyName());
      if (!hasActiveStrategy) {
        strategyReportOpenByPane.set(paneId, false);
      } else {
        const currentlyOpen = strategyReportOpenByPane.get(paneId) === true;
        strategyReportOpenByPane.set(paneId, !currentlyOpen);
      }
      if (paneId !== paneState.activePaneId) {
        setActivePane(paneId);
        return;
      }
      refreshStrategyReport();
    });
    refreshStrategyReport = () => {
      const activePane = getActivePane();
      const activePaneId = paneState.activePaneId;
      const hasActiveStrategy = Boolean(activePane.chart.getActiveStrategyName());
      if (!hasActiveStrategy) {
        strategyReportOpenByPane.set(activePaneId, false);
      }
      const shouldOpen = hasActiveStrategy && strategyReportOpenByPane.get(activePaneId) === true;
      strategyReport.setVisible(shouldOpen);
      if (shouldOpen) {
        strategyReport.refresh();
      }
    };
    window.setInterval(() => {
      refreshStrategyReport();
    }, 1000);
    refreshStrategyReport();
    applyViewportOffsets();
  }

  applySplitLayout(isPopout ? 1 : paneState.splitPreset, { resetClosed: true, updatePreset: true });
  setActivePane(0);
  ensurePane(0).startLive();

  // ── 모바일 화면 회전 / 리사이즈 대응 ──────────────────────────────────
  if (isMobile) {
    const onOrientationChange = () => {
      // 약간의 딜레이 후 모든 pane 차트 리사이즈
      setTimeout(() => {
        paneControllers.forEach((pane) => pane.chart.resize());
        applyViewportOffsets();
      }, 200);
    };
    window.addEventListener('orientationchange', onOrientationChange);
    window.addEventListener('resize', onOrientationChange);
  }

  if (!isPopout && !isMobile) {
    const emitToolboxTrashCounts = () => {
      const pane = getActivePane();
      window.dispatchEvent(new CustomEvent('chart-toolbox-trash-counts', {
        detail: {
          drawings: pane.chart.getDrawingCount(),
          indicators: pane.chart.getEnabledIndicatorCount(),
        },
      }));
    };
    window.addEventListener('chart-toolbox-trash-refresh', () => {
      emitToolboxTrashCounts();
    });

    window.addEventListener('chart-toolbox-select', (event: Event) => {
      const customEvent = event as CustomEvent<{ itemId?: string; includeLocked?: boolean }>;
      const toolId = customEvent.detail?.itemId ?? null;
      const includeLocked = Boolean(customEvent.detail?.includeLocked);
      const pane = getActivePane();
      if (toolId === 'hide-drawings') {
        pane.chart.setDrawingsVisible(!pane.chart.isDrawingsVisible());
        pane.refreshChartUi();
        emitToolboxTrashCounts();
        return;
      }
      if (toolId === 'hide-indicators') {
        pane.chart.setIndicatorsVisible(!pane.chart.isIndicatorsVisible());
        pane.refreshChartUi();
        emitToolboxTrashCounts();
        return;
      }
      if (toolId === 'hide-patterns') {
        pane.chart.setPatternBoxesVisible(!pane.chart.isPatternBoxesVisible());
        pane.refreshChartUi();
        emitToolboxTrashCounts();
        return;
      }
      if (toolId === 'hide-all') {
        const nextVisible = !(pane.chart.isDrawingsVisible() && pane.chart.isIndicatorsVisible() && pane.chart.isPatternBoxesVisible());
        pane.chart.setDrawingsVisible(nextVisible);
        pane.chart.setIndicatorsVisible(nextVisible);
        pane.chart.setPatternBoxesVisible(nextVisible);
        pane.refreshChartUi();
        emitToolboxTrashCounts();
        return;
      }
      if (toolId === 'delete-selected-drawing') {
        const nextTool = pane.chart['drawingTool'] === 'eraser' ? null : 'eraser';
        pane.chart.setDrawingTool(nextTool);
        pane.refreshChartUi();
        return;
      }
      if (toolId === 'trash-delete-drawings') {
        pane.chart.clearAllDrawings(includeLocked);
        pane.refreshChartUi();
        emitToolboxTrashCounts();
        return;
      }
      if (toolId === 'trash-delete-indicators') {
        pane.chart.clearAllIndicators();
        pane.refreshChartUi();
        emitToolboxTrashCounts();
        return;
      }
      if (toolId === 'trash-delete-all') {
        pane.chart.clearAllDrawings(includeLocked);
        pane.chart.clearAllIndicators();
        pane.refreshChartUi();
        emitToolboxTrashCounts();
        return;
      }
      pane.chart.setDrawingTool(toolId);
    });
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      const pane = getActivePane();
      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable),
      );

      if (isEditable) return;

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 't') {
          pane.chart.setDrawingTool('trendline');
          event.preventDefault();
          return;
        }
        if (key === 'h') {
          pane.chart.setDrawingTool('hline');
          event.preventDefault();
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        const copied = pane.chart.copySelectedDrawing();
        if (copied) event.preventDefault();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        const pasted = pane.chart.pasteCopiedDrawing();
        if (pasted) event.preventDefault();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        pane.chart.deleteSelectedDrawing();
        emitToolboxTrashCounts();
      }
    });
    window.setInterval(() => {
      emitToolboxTrashCounts();
    }, 1000);
    emitToolboxTrashCounts();
  }

  if (isPopout) {
    const paneNo = Number(pageUrl.searchParams.get('pane') || '1');
    setupPopoutView({
      app,
      paneNo,
      onSaveScreenshot: saveActivePaneScreenshot,
      onToggleFullscreen: toggleFullscreen,
    });
  }

  bindGlobalShortcuts({
    onToggleFullscreen: toggleFullscreen,
    onSaveScreenshot: saveActivePaneScreenshot,
  });
}

// Export for debugging
export {};





