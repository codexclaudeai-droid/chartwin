import {
  createDefaultPanelState,
  ensurePanelRatios,
  getActivePanels,
  getLineStyle,
  getLineVisible,
  getPanelRatio,
  movePanel,
  resizePanelBoundary,
  setLineVisible,
  updateLineStyle,
} from '../indicator-panel-module';
import {
  TIMEFRAME_SECONDS,
  type TimeframeKey,
} from '../catalog/time';
import {
  loadStrategies,
  saveStrategies,
  type StrategyDefinition,
  type StrategyParamValue,
  type StrategySignal,
} from '../strategy/strategy-service';
import {
  calculateAutoTrendlineChannel,
  simulateAutoTrendlineChannelStrategy,
  type AutoTrendlineChannelResult,
} from '../strategy/strategies/auto-trendline-channel-runtime.ts';
import {
  DEFAULT_CONFIG as DOUBLE_BREAK_DEFAULT_CONFIG,
  DoubleBreakStrategy,
  type DoubleBreakConfig,
  type DoubleBreakResult,
} from '../strategy/double-break-strategy';
import type {
  AnchoredVwapSettings,
  AnchoredVwapSource,
  DrawingAnchor,
  DrawingDraft,
  DrawingHitPart,
  DrawingShape,
  DrawingToolId,
  PatternDrawingToolId,
  TrendlineDrawingToolId,
} from '../ui/workspace/drawing-types';
import {
  canCopyDrawingShape,
  cloneDrawingShape,
  getChannelGeometry as getChannelGeometryUtil,
  getPatternPointCount,
  getTrendlineScreenLine,
  isPatternDrawingKind,
  isTrendlineKind,
  pointToSegmentDistance as pointToSegmentDistanceUtil,
} from '../ui/workspace/drawing-utils';
import { getContrastTextColor, toRgba } from './color-utils';
import {
  buildZeroLagTrendStates,
} from './indicator-render-engine';
import { renderIndicatorBlocks } from './indicator-block-renderer';
import {
  clearDrawings,
  cloneDrawingsSnapshot,
  deleteDrawingById,
  deleteDrawingsByKind,
  findDrawingById,
  hasDrawing,
  setDrawingsLocked,
  upsertDrawingShape,
} from './drawings/drawing-state.ts';
import { renderDrawingSelectionOverlay } from './drawings/drawing-selection-renderer.ts';
import {
  findDrawingAt as findDrawingAtPoint,
  hitTestDrawing as hitTestDrawingShape,
} from './drawings/drawing-hit-test.ts';
import { updateDrawingDraftAnchor } from './drawings/drawing-draft-update.ts';
import { renderDrawingLayer } from './drawings/drawing-layer-renderer.ts';
import { renderDrawingShape } from './drawings/drawing-shape-renderer.ts';
import { moveDrawingByDelta } from './drawings/drawing-transform.ts';
import {
  createAnchoredVwapDrawing,
  createFibTrendDrawing,
  createHlineDrawing,
  createPatternDrawing,
  createPositionDrawing,
  createSingleAnchorLineDrawing,
  createTextNoteDrawing,
  finishDrawingDraft,
  resolveMeasureDraftClick,
} from './drawings/factories/index.ts';
import {
  calculateBb,
  calculateCci,
  calculateCvd,
  calculateDmi,
  calculateEma,
  calculateEnvelope,
  calculateAtr,
  calculateAtrTrailingEmaSignal,
  calculateAtrTrailingStopOrigin,
  type AtrTrailingEmaSignalMode,
  type AtrTrailingEmaSignalResult,
  type AtrTrailingStopOriginOptions,
  calculateBbMtfKalmanSignal,
  type BbMtfKalmanColorOption,
  type BbMtfKalmanSignalResult,
  calculateHma,
  calculateIchimoku,
  calculateMacd,
  calculateMa,
  calculateObv,
  calculateParabolicSar,
  calculateRsi,
  buildSmartMoneyConceptsCacheKey,
  DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS,
  EMPTY_SMART_MONEY_CONCEPTS_RESULT,
  calculateSmartMoneyConcepts,
  normalizeSmartMoneyConceptsSettings,
  type SmartMoneyConceptsResult,
  type SmartMoneyConceptsSettings,
  calculateStochastic,
  calculateVwapWithBands,
  type VwapBands,
  type VwapOptions,
  type VwapResult,
  calculateWilliamsFractals,
} from './indicators/index.ts';
import { resolveChartCursor } from './interaction/chart-cursor-resolver.ts';
import { isHoveringCandleBody } from './interaction/candle-hover-hit-test.ts';
import { resolveMouseDownAxisInteraction } from './interaction/mouse-down-axis-interaction.ts';
import { isPointInCircle } from './interaction/pointer-hit-test.ts';
import {
  constrainPositionDrawingPointer,
  normalizePositionDrawingHitPart,
} from './interaction/position-drawing-hit-normalizer.ts';
import { shouldShowCrosshairGuides } from './interaction/crosshair-guide-visibility.ts';
import { resolveSubIndicatorAlertMouseDown } from './interaction/sub-indicator-alert-interaction.ts';
import { resolveWheelInteraction } from './interaction/wheel-interaction.ts';
import { renderCandles } from './renderers/candle-renderer.ts';
import { renderAutoTrendlineChannel } from './renderers/auto-trendline-channel-renderer.ts';
import { renderFootprintOverlay } from './renderers/footprint-renderer.ts';
import {
  buildIndicatorRenderInput,
  buildIndicatorRenderParams,
  type IndicatorRenderGroupedInput,
} from './renderers/indicator-render-params.ts';
import type { SubPanelHostChart } from './renderers/subpanel-render-orchestrator.ts';
import {
  renderLeftYAxisOverlay,
  renderPanelTimeSeparator,
  renderTransparentYAxisLabels,
} from './renderers/axis-overlay-renderer.ts';
import { renderCrosshairGuide } from './renderers/crosshair-guide-renderer.ts';
import { renderCrosshairPriceAxis } from './renderers/crosshair-price-axis-renderer.ts';
import { renderCrosshairTooltip, type CrosshairTooltipRow } from './renderers/crosshair-tooltip-renderer.ts';
import { renderDrawingTouchCrosshair } from './renderers/drawing-touch-crosshair-renderer.ts';
import { renderGotoDateMarker } from './renderers/goto-date-marker-renderer.ts';
import { renderLivePriceOverlay } from './renderers/live-price-overlay-renderer.ts';
import { drawPriceLineOverlay } from './renderers/price-line-overlay-renderer.ts';
import { renderTradeFocusOverlay } from './renderers/trade-focus-overlay-renderer.ts';
import { renderMainBackgroundLayers } from './renderers/main-background-layer-orchestrator.ts';
import { getMainGridAxisMetrics, renderMainGrid } from './renderers/main-grid-renderer.ts';
import { renderSignalHoverOverlay, selectSignalHoverArea } from './renderers/signal-hover-overlay-renderer.ts';
import { renderSubPanelCrosshairAxis } from './renderers/subpanel-crosshair-axis-renderer.ts';
import { resolveSubPanelCrosshairValue } from './renderers/subpanel-crosshair-value.ts';
import { renderTimeAxisLabels } from './renderers/time-axis-renderer.ts';
import {
  formatCrosshairTimelineLabel,
  formatWithComma,
  getBucketStartSec,
  getDynamicMainPricePaddingRatio,
  getMainAxisStepByRange,
  pickAxisStepCandles,
  shiftBucketSec,
} from './axis-utils';
import { getSymbolPricePrecision } from '../data/market-data-sources';
import {
  resolveMainYAxisDragScale,
  resolveSubYAxisDragScale,
  resolveXAxisDragRange,
} from './interaction/axis-drag-interaction.ts';
import {
  resolveHorizontalPanVirtualStart,
  resolveVerticalPanOffset,
} from './interaction/chart-pan-interaction.ts';
import { resolveCrosshairHlineAction } from './interaction/crosshair-hline-interaction.ts';
import {
  resolveDrawingDoubleClickAction,
  resolveDrawingMouseDownEditAction,
} from './interaction/drawing-edit-action.ts';
import { applyDrawingMove, resolveDrawingMoveEnd } from './interaction/drawing-move-interaction.ts';
import { simulateGridMartingale } from '../strategy/strategies/grid-martingale-runtime.js';
import { simulateXauGridLong } from '../strategy/strategies/xau-grid-long-runtime.ts';
import {
  detectPatternCandidates,
  getPatternSignalRange,
  pickTopPatternSignal,
  type ChartPatternType,
  type PatternAnalysisScope,
  type PatternSignal,
} from '../patterns/pattern-detector';
import {
  clearPatternPopups as clearPatternPopupsUi,
  showPatternPopup as showPatternPopupUi,
} from '../patterns/pattern-popup';
import type { CandleData } from '../types';
import type { DisplayCurrency } from '../types/market';
import { formatKUnit, formatKUnitWithComma, formatThousandAdaptive } from '../utils/format';
import { applyGapSmoothing, type GapMode } from '../utils/gap-smoothing';
import { getExchangeSessionTimezoneForSymbol } from '../utils/market-session';
type ActiveDrawingToolId = DrawingToolId | 'eraser';
type DrawingMagnetMode = 'off' | 'soft' | 'strong';
type VwapAnchorSelection = {
  active: boolean;
};
type SubPanelCrosshairData = {
  dmiD: {
    plusDI: Array<number | null>;
    minusDI: Array<number | null>;
    adx: Array<number | null>;
  };
  macdD: {
    hist: Array<number | null>;
    macdLine: Array<number | null>;
    sigLine: Array<number | null>;
  };
  cciD: Array<number | null>;
  atrD: Array<number | null>;
  obvD: number[];
  obvSignal9: Array<number | null>;
  cvdD: number[];
  cvdSignal9: Array<number | null>;
};

export const X_AXIS_HEIGHT = 22;
const MAX_CANVAS_PIXEL_RATIO = 3;
const CHART_FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;
const CHART_TEXT_PRIMARY = '#e3e8f2';
const CHART_TEXT_SECONDARY = '#c2ccdf';
const CHART_TEXT_MUTED = '#b3bfd4';
const HLINE_DEFAULT_WIDTH = 1.2;
const LOCK_ICON_CLOSED_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 1 1 8 0v3"></path></svg>';
const LOCK_ICON_OPEN_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M16 11V8a4 4 0 1 0-8 0"></path></svg>';
const ERASER_CURSOR = 'url("/eraser-cursor.svg") 4 20, pointer';
const NS_RESIZE_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"48\" viewBox=\"0 0 40 48\"><polygon points=\"20,13 24,19 16,19\" fill=\"white\"/><polygon points=\"20,35 24,29 16,29\" fill=\"white\"/><line x1=\"20\" y1=\"19\" x2=\"20\" y2=\"29\" stroke=\"white\" stroke-width=\"2\"/></svg>')}") 20 24, ns-resize`;
const X_AXIS_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"40\" viewBox=\"0 0 48 40\"><polygon points=\"35,20 29,24 29,16\" fill=\"white\"/><polygon points=\"13,20 19,24 19,16\" fill=\"white\"/><line x1=\"29\" y1=\"20\" x2=\"19\" y2=\"20\" stroke=\"white\" stroke-width=\"2\"/></svg>')}") 24 20, ew-resize`;
const EW_RESIZE_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\" viewBox=\"0 0 40 40\"><g fill=\"none\" stroke=\"white\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"7\" y1=\"20\" x2=\"33\" y2=\"20\"/><polyline points=\"13,14 7,20 13,26\"/><polyline points=\"27,14 33,20 27,26\"/></g></svg>')}") 20 20, ew-resize`;

function drawPriceArrowBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  side: 'left' | 'right',
  arrowDepth = 5,
): void {
  const half = h / 2;
  ctx.beginPath();
  if (side === 'right') {
    ctx.moveTo(x, y);
    ctx.lineTo(x + arrowDepth, y - half);
    ctx.lineTo(x + w, y - half);
    ctx.lineTo(x + w, y + half);
    ctx.lineTo(x + arrowDepth, y + half);
  } else {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w - arrowDepth, y - half);
    ctx.lineTo(x, y - half);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x + w - arrowDepth, y + half);
  }
  ctx.closePath();
}

function getPriceArrowTextAnchor(
  x: number,
  w: number,
  side: 'left' | 'right',
  arrowDepth: number,
): { align: CanvasTextAlign; x: number } {
  return { align: 'center', x: x + (w / 2) };
}

// ── 모바일 전용 상수 ──────────────────────────────────────────────────────────
export const MOBILE_BOTTOM_BAR_HEIGHT = 44;

// 플로팅 버튼 SVG: 오른쪽(최신 캔들) 방향 이중 화살표 >>
export const MOBILE_JUMP_LATEST_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline class="chev-left" points="6 17 11 12 6 7"/><polyline class="chev-right" points="13 17 18 12 13 7"/></svg>`;

type BollingerRiskConfig = {
  enabled: boolean;
  atrPeriod: number;
  slAtrMult: number;
  tp1AtrMult: number;
  tp2AtrMult: number;
  tp1Portion: number;
  maxHoldBars: number;
  moveSlToEntryOnTp1: boolean;
};

const BOLLINGER_RISK_DEFAULT_CONFIG: BollingerRiskConfig = {
  enabled: true,
  atrPeriod: 14,
  slAtrMult: 1.1,
  tp1AtrMult: 1.2,
  tp2AtrMult: 2.4,
  tp1Portion: 0.35,
  maxHoldBars: 18, // 4h 기준 약 3일
  moveSlToEntryOnTp1: true,
};

const DOUBLE_BREAK_STRATEGY_ID = 'strategy_js_double_break';
const MTF_1M_SCALPER_STRATEGY_ID = 'strategy_js_mtf_1m_scalper';
const AUTO_TRENDLINE_CHANNEL_STRATEGY_ID = 'strategy_js_auto_trendline_channel';
const DOUBLE_BREAK_PARAM_DEFAULT_KEY = '__double_break_config_default__';
const DOUBLE_BREAK_PARAM_SYMBOL_PREFIX = '__double_break_config_symbol__';
const STRATEGY_RISK_LINES_VISIBLE_STORAGE_KEY = 'my-chart-lib-strategy-risk-lines-visible-v1';

function loadStrategyRiskLinesVisiblePreference(): boolean {
  try {
    const raw = localStorage.getItem(STRATEGY_RISK_LINES_VISIBLE_STORAGE_KEY);
    if (raw == null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

type StrategyReportArgs = {
  feeBps: number;
  slippageBps: number;
  periodBars: number;
  rangeStartSec: number | null;
  rangeEndSec: number | null;
  sideFilter: 'all' | 'long' | 'short';
};

type StrategyReportFromCandlesArgs = StrategyReportArgs & {
  candles: CandleData[];
};

type StrategyReportTrade = {
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  entry: number;
  exit: number;
  pnl: number;
  stopLoss?: number | null;
  takeProfits?: number[];
  entryIndex: number;
  exitIndex: number;
  entryTime: number | null;
  exitTime: number | null;
};

type StrategyReportResult = {
  equity: number[];
  buyHold: number[];
  excursion: number[];
  runup: number[];
  drawdown: number[];
  netProfit: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  profitFactor: number;
  tradeCount: number;
  grossProfit: number;
  grossLoss: number;
  averagePnl: number;
  realizedProfit: number;
  unrealizedProfit: number;
  signalCount: number;
  adxFilteredSignalCount: number;
  closedTradeCount: number;
  openPositionCount: number;
  trades: StrategyReportTrade[];
  strategyMeta?: {
    kind: 'xau-grid-long';
    ownedCount: number;
    avgEntry: number | null;
    deployedCapital: number;
    openQty: number;
    openPnl: number;
    buyLevels: number[];
    sellLevels: number[];
    lastEventType: 'buy' | 'sell' | 'mixed' | 'none';
    highPrice: number;
    lowPrice: number;
    nLevels: number;
    gridMode: string;
  };
};

// -----------------------------------------------------------------------------
// SimpleChart 클래스

export class SimpleChart {
  private static readonly FOCUS_VISUAL_DURATION_MS = 24000;
  private static readonly MAX_RENDER_CANDLES = 9000;
  private static readonly RENDER_WINDOW_BUFFER_CANDLES = 1500;
  private containerEl: HTMLElement;
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private signalCanvas: HTMLCanvasElement;
  private signalCtx: CanvasRenderingContext2D;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private pixelRatio = 1;
  private data: CandleData[] = [];
  private gapMode: GapMode = 'raw';
  private displayDataCache: CandleData[] | null = null;
  private displayDataCacheKey = '';
  private smartMoneyConceptsCacheKey = '';
  private smartMoneyConceptsCache: SmartMoneyConceptsResult = EMPTY_SMART_MONEY_CONCEPTS_RESULT;
  private strategies: StrategyDefinition[] = loadStrategies();
  private activeStrategyId: string | null = null;
  private strategySignals: StrategySignal[] = [];
  private latestStrategySignalIndex = -1;
  private strategySignalVisible = true;
  private strategyRiskLinesVisible = loadStrategyRiskLinesVisiblePreference();
  private doubleBreakConfig: DoubleBreakConfig = { ...DOUBLE_BREAK_DEFAULT_CONFIG };
  private doubleBreakConfigSymbolKey = '';
  private doubleBreakResultCacheKey = '';
  private doubleBreakResultCache: DoubleBreakResult | null = null;
  private bollingerRiskConfig: BollingerRiskConfig = { ...BOLLINGER_RISK_DEFAULT_CONFIG };
  private signalHitAreas: Array<{
    x: number;
    y: number;
    r: number;
    signal: StrategySignal;
    entryPrice: number;
    candleIndex: number;
  }> = [];
  public onStrategyComputed: (() => void) | null = null;
  private strategyWorker: Worker | null = null;
  private strategyWorkerUrl: string | null = null;
  private signalAnimationFrame = 0;
  private signalAnimationActive = false;
  private lastSignalDrawTimeMs = 0;
  private signalLayerDrawFrame = 0;
  private lastAuxiliaryAlertEvalMs = 0;
  private strategyRequestId = 0;
  private pendingStrategyRequestId = 0;
  private strategyComputeTimer: number | null = null;
  private pendingStrategyChangedFrom: number | null = null;
  private dmiScaleRange: { lo: number; hi: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeScheduled = false;
  private mainDrawScheduled = false;
  private overlayDrawScheduled = false;
  private drawingTool: ActiveDrawingToolId | null = null;
  private drawings: DrawingShape[] = [];
  private drawingsVisible = true;
  private indicatorsVisible = true;
  private patternBoxesVisible = true;
  private drawingDraft: DrawingDraft | null = null;
  private drawingMagnetMode: DrawingMagnetMode = 'soft';
  private drawingDragActive = false;
  private selectedDrawingId: string | null = null;
  private selectedDrawingPart: DrawingHitPart = 'line';
  private drawingMoveState: {
    startX: number;
    startY: number;
    baseShape: DrawingShape;
  } | null = null;
  private drawingMoveDistance = 0;
  private drawingToolbarEl: HTMLDivElement | null = null;
  private drawingToolbarBoundId: string | null = null;
  private drawingAlertPopupEl: HTMLDivElement | null = null;
  private positionSettingsPopupEl: HTMLDivElement | null = null;
  private avwapSettingsModalEl: HTMLDivElement | null = null;
  private avwapSettingsEditingShapeId: string | null = null;
  private trendlineTextEditorEl: HTMLInputElement | null = null;
  private trendlineTextEditorShapeId: string | null = null;
  private textNoteEditorEl: HTMLInputElement | null = null;
  private textNoteEditorShapeId: string | null = null;
  private hoveredDrawingId: string | null = null;
  private hoveredDrawingPart: DrawingHitPart | null = null;
  private copiedDrawingTemplate: DrawingShape | null = null;
  private pendingChannelId: string | null = null;
  private fibTrendPointStage: 0 | 1 | 2 = 0;
  private patternPointStage = 0;
  private oneSecondIndicatorVisibilityBackup: Partial<Record<string, boolean>> | null = null;
  private subIndicatorAlerts: Array<{
    id: string;
    panelId: string;
    value: number;
    color: string;
    enabled: boolean;
    mode: 'cross' | 'up' | 'down';
    onsite: boolean;
    sound: boolean;
    lastTriggerBar?: number;
  }> = [];
  private subIndicatorAlertHitAreas: Array<{
    id: string;
    panelId: string;
    x1: number;
    x2: number;
    y: number;
    panelTop: number;
    panelHeight: number;
  }> = [];
  private hoveredSubIndicatorAddButton: {
    panelId: string;
    value: number;
    color: string;
    x: number;
    y: number;
    r: number;
  } | null = null;
  private subIndicatorAlertPopupEl: HTMLDivElement | null = null;
  private lastPatternAlertByKey = new Map<string, number>();
  private lastPatternEvalSignature = '';
  private confirmedPatternBoxes: Array<{
    id: string;
    type: ChartPatternType;
    level: PatternSignal['level'];
    startIndex: number;
    endIndex: number;
    createdAt: number;
  }> = [];

  private startIndex = 0;
  private endIndex   = 0;
  private isDragging     = false;
  private dragStartX     = 0;
  private dragStartY     = 0;
  private dragStartIndex = 0;
  private dragStartPriceOffset = 0;
  private mainPricePanOffset = 0;
  private yScaleFactor = 1.0;
  private logScale = false;
  private yAxisDragging = false;
  private yAxisDragStartY = 0;
  private yAxisDragStartFactor = 1.0;
  private subPanelScaleFactors: Record<string, number> = {};
  private subYAxisDragging: string | null = null;
  private subYAxisDragStartY = 0;
  private subYAxisDragStartFactor = 1.0;
  private xAxisDragging = false;
  private xAxisDragStartX = 0;
  private xAxisDragStartVisible = 0;
  private xAxisDragStartIndex = 0;
  private logBtn: HTMLButtonElement | null = null;
  private _logBtnHovered = false;
  private logBtnHideTimer: ReturnType<typeof setTimeout> | null = null;
  private leftPanBars = 0;
  private dragStartLeftPanBars = 0;
  private touchStartLeftPanBars = 0;
  private mouseX = 0;
  private mouseY = 0;
  private isMouseOver = false;
  private focusedSignalCandleIndex: number | null = null;
  private hoveredSignalCandleIndex: number | null = null;
  private focusedTradeRange: {
    startIndex: number;
    endIndex: number;
    style?: 'range' | 'candle';
    type: 'box' | 'connector';
    entryPrice?: number;
    exitPrice?: number;
    isProfit?: boolean;
  } | null = null;
  private focusVisualTimer: ReturnType<typeof setTimeout> | null = null;
  private focusVisualStartedAt = 0;
  private gotoDateMarker: { candleIndex: number; label: string } | null = null;
  private vwapAnchorSelection: VwapAnchorSelection | null = null;
  private lastVwapResult: VwapResult | null = null;

  // 십자선 가격박스 옆 + 아이콘 히트 영역
  private crosshairPlusHit: { x: number; y: number; r: number; price: number } | null = null;
  private crosshairPlusHovered = false;

  public onCrosshairOHLC: ((ohlc: { open: number; high: number; low: number; close: number; time: number } | null) => void) | null = null;
  private _lastCrosshairOHLCIdx = -2;
  // 기본 십자선 자동 숨김 타이머 (5초)
  private static readonly CROSSHAIR_AUTO_HIDE_MS = 5000;
  private static readonly MOUSE_TOOLTIP_LONGPRESS_MS = 350;
  private static readonly TEXT_NOTE_TOUCH_HIT_RADIUS = 52;
  private crosshairAutoHideTimer: ReturnType<typeof setTimeout> | null = null;
  // 십자선 활성 직후 터치-업 무시 플래그 (롱프레스 해제와 구분)
  private crosshairJustActivated = false;
  public onAfterResize: (() => void) | null = null;
  public onAfterDraw: (() => void) | null = null;

  public get currentAxisPad(): number {
    return this.lastDrawMeta?.axisPad ?? this.config.layout.rightPadding;
  }

  // ── 터치 제스처 상태 ──────────────────────────
  private touchStartX    = 0;
  private touchStartY    = 0;
  private touchStartIndex = 0;
  private touchStartPriceOffset = 0;
  private touchPinchDist  = 0;
  private touchPinchStartVisible = 0;
  private touchPinchAnchorIndex = 0;
  private touchPinchAnchorRatio = 0.5;
  private isTouchPanning  = false;
  private isTouchPinching = false;

  // ── 롱프레스 십자선 상태 ──────────────────────
  private static readonly LONG_PRESS_MS = 300;
  private static readonly LONG_PRESS_MOVE_THRESHOLD = 18;
  private static readonly TEXT_NOTE_TOUCH_TAP_MOVE_THRESHOLD = 16;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isCrosshairMode = false;
  private pointerMode: 'auto' | 'cross' | 'dot' | 'arrow' | 'demo' = 'auto';
  private isMouseDownForTooltip = false;
  private mouseLongPressTooltipActive = false;
  private mouseLongPressTooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private touchCrosshairX = 0;
  private touchCrosshairY = 0;

  // ── 터치 드로잉 전용 상태 (TradingView 스타일) ────────────────────
  private isTouchDrawingMode = false;          // 드로잉 준비 상태
  private touchDrawingTapCount = 0;            // 탭 카운트 (1st, 2nd, 3rd...)
  private touchDrawingCrosshairX = 0;          // 십자선 X
  private touchDrawingCrosshairY = 0;          // 십자선 Y

  public dividers: Record<string, HTMLElement> = {};

  public config = {
    symbol:    'BTCUSDT',
    timeframe: '1h' as TimeframeKey,
    patternAnalysisScope: 'lookback' as PatternAnalysisScope,
    patternAlertsEnabled: false,
    quoteCurrency: 'USDT' as DisplayCurrency,
    timezone: 'UTC+9',
    indicators: {
      maShort:  { show: false, value: 5 },
      maLong:   { show: false, value: 20 },
      ma60:     { show: false, value: 60 },
      ma120:    { show: false, value: 120 },
      ma200:    { show: false, value: 200 },
      ma: {
        show: false,
        nextId: 5,
        lines: [
          { id: 'ma1', period: 5 },
          { id: 'ma2', period: 20 },
          { id: 'ma3', period: 60 },
          { id: 'ma4', period: 120 },
        ],
      },
      ema: {
        show: false,
        nextId: 5,
        lines: [
          { id: 'ema1', period: 5 },
          { id: 'ema2', period: 20 },
          { id: 'ema3', period: 60 },
          { id: 'ema4', period: 120 },
        ],
      },
      hma:      { show: false, period: 55 },
      bb:       { show: false, period: 20, stdDev: 2 },
      rsi:      { show: false, period: 14 },
      macd:     { show: false, fast: 12, slow: 26, signal: 9 },
      dmi:      { show: false, period: 14, axisMode: 'auto' as 'auto' | 'fixed', topThreshold: 30, bottomThreshold: 20 },
      stochF:   { show: false, kPeriod: 5,  dPeriod: 3 },
      stochS:   { show: false, kPeriod: 14, dPeriod: 3 },
      cci:      { show: false, period: 20 },
      atr:      { show: false, period: 14 },
      obv:      { show: false },
      cvd:      { show: false, barMode: true },
      footprint: { show: false, showSummary: true, maxLevels: 18, priceStep: 1000 },
      vwap:     { show: false, anchorPeriod: 'session', source: 'hlc3', offset: 0, hideOnDailyOrAbove: false, sessionTimezone: 'auto', bandMode: 'standard-deviation', showFill: true, fillColor: '#ff9800', fillOpacity: 8, showUpperBand1: true, showLowerBand1: true, bandMultiplier1: 1, showUpperBand2: false, showLowerBand2: false, bandMultiplier2: 2, showUpperBand3: false, showLowerBand3: false, bandMultiplier3: 3 },
      williamsFractal: { show: false, span: 2 },
      parabolicSar: { show: false, start: 0.02, increment: 0.02, maximum: 0.2 },
      smartMoneyConcepts: { ...DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS },
      volumeProfile: { show: false, rows: 24, widthPct: 22, upOpacity: 45, downOpacity: 45, pocOpacity: 95 },
      fixedRangeVolumeProfile: {
        show: false,
        rowSize: 50,
        volumeMode: 'up_down',
        valueAreaVolume: 70,
        widthPct: 30,
        showPoc: true,
        showVahVal: true,
        showVaBackground: true,
        showRangeBox: true,
        showRangeHandles: true,
        showInfo: true,
      },
      vpvr: {
        show: false,
        rowsLayout: 'number_of_rows',
        rowSize: 50,
        volumeMode: 'up_down',
        valueAreaVolume: 70,
        placement: 'right',
        widthPct: 22,
        showPoc: true,
        pocColor: '#ffc107',
        pocWidth: 1.2,
        pocLineStyle: 'dashed',
        showVahVal: true,
        vahValColor: '#8ab4ff',
        vahValWidth: 1,
        vahValLineStyle: 'dashed',
        showVaBackground: true,
        vaBgColor: '#3a5f94',
        vaBgOpacity: 18,
        upColor: '#26a69a',
        downColor: '#ef5350',
        upOpacity: 45,
        downOpacity: 45,
        totalColor: '#7f8aa3',
        totalOpacity: 40,
        deltaPosColor: '#26a69a',
        deltaNegColor: '#ef5350',
        deltaOpacity: 50,
        valuesVisible: false,
        valuesTextColor: '#cfd8ea',
      },
      supertrend: {
        show: false,
        period: 10,
        factor: 3,
        upBgEnabled: true,
        downBgEnabled: true,
        upBgColor: 'rgba(34,171,148,0.18)',
        downBgColor: 'rgba(242,54,69,0.18)',
      },
      statisticalTrailingStop: {
        show: false,
        dataLength: 10,
        distributionLength: 100,
        baseLevel: 2,
        bullishColor: 'rgba(8,153,129,0.5)',
        bearishColor: 'rgba(242,54,69,0.5)',
        trailMarkEnabled: true,
        trailMarkStyle: 'circle',
        trailMarkLocation: 'absolute',
        showPanelLabel: false,
      },
      atrTrailingEmaSignal: {
        show: false,
        mode: 'basic' as AtrTrailingEmaSignalMode,
        sensitivity: 3,
        atrPeriod: 2,
        signalEmaLength: 1,
        trendEmaLength: 240,
        showTrendEma: true,
        showAtrStop: false,
        showSignals: true,
      },
      atrTrailingStopOrigin: {
        show: false,
        sensitivity: 3,
        atrPeriod: 2,
        trendEmaLength: 240,
        showTrendEma: true,
        showAtrStop: false,
        showSignals: true,
      },
      bbMtfKalmanSignal: {
        show: false,
        htfTimeframe: '4h',
        ltfLength: 20,
        ltfMult: 2,
        htfLength: 20,
        htfMult: 2.25,
        ltfBBLinewidth: 1,
        htfBBLinewidth: 1,
        plotLtfBb: true,
        plotHtfBb: true,
        plotLabels: false,
        signalsEnabled: true,
        colorOption: 'Gradient' as BbMtfKalmanColorOption,
        minOpacity: 55,
        maxOpacity: 99,
        bullishColor: '#089981',
        bearishColor: '#f23645',
        showErrors: true,
        showTable: false,
        textColor: '#ffffff',
      },
      zeroLagMaTrendLevels: {
        show: false,
        length: 15,
        showLevels: true,
        upColor: '#30d453',
        downColor: '#4043f1',
      },
      ichimoku: { show: false, tenkan: 9, kijun: 26, senkou: 52 },
      envelope: { show: false, period: 20, pct: 2.5 },
      volume:   { show: true },
    },
    layout: {
      mainRatio:   0.55,
      volumeRatio: 0.12,
      rsiRatio:    0.12,
      dmiRatio:    0.10,
      macdRatio:   0.11,
      subRatio:    0.12, // default ratio for unknown sub panel
      rightPadding: 0,
      rightGapBars: 0,
      marketInfoSide: 'right' as 'left' | 'right',
      yAxisTransparentBackground: true,
      leftPanEnabled: true,
      verticalPanEnabled: true,
      mobileCrosshairTooltipEnabled: true,
    },
    candleStyle: {
      upColor: '#22ab94',
      downColor: '#f23645',
    },
    panelState: createDefaultPanelState()
  };

  private getMarketInfoSide(): 'left' | 'right' {
    return this.config.layout.marketInfoSide === 'left' ? 'left' : 'right';
  }

  private isYAxisBackgroundTransparent(): boolean {
    return (this.config.layout as any).yAxisTransparentBackground !== false;
  }

  private getChartGeometry(width: number, dynamicPad?: number): {
    side: 'left' | 'right';
    axisPad: number;
    chartLeft: number;
    chartRight: number;
    chartWidth: number;
    axisLeft: number;
    axisRight: number;
    axisCenter: number;
  } {
    const side = this.getMarketInfoSide();
    const transparentAxis = this.isYAxisBackgroundTransparent();
    const axisPad = Math.max(24, dynamicPad ?? this.config.layout.rightPadding);
    const chartLeft = 0;
    // Main panel right edge: in left-mode use full width, in right-mode keep right axis area.
    const chartRight = side === 'left' ? width : Math.max(0, width - axisPad);
    const chartWidth = Math.max(1, (transparentAxis ? width : chartRight) - chartLeft);
    const axisLeft = side === 'left' ? 0 : chartRight;
    const axisRight = side === 'left' ? axisPad : width;
    const axisCenter = (axisLeft + axisRight) / 2;
    return { side, axisPad, chartLeft, chartRight, chartWidth, axisLeft, axisRight, axisCenter };
  }

  private alignLatestCandleToAxisStart(realVisibleCount: number): void {
    const realCount = Math.max(1, Math.min(this.data.length, Math.floor(realVisibleCount)));
    const futureSlots = this.getFutureSlotsForLatestAtAxisStart(realCount);
    this.startIndex = Math.max(0, this.data.length - realCount);
    this.endIndex = this.data.length + futureSlots;
  }

  // 활성 보조 패널(설정 순서 기준)
  public get activePanels(): string[] {
    if (!this.indicatorsVisible) return [];
    const panels = getActivePanels(this.config.indicators as any, this.config.panelState);
    ensurePanelRatios(this.config.panelState, panels);
    return panels;
  }

  public getPanelRatio(id: string): number {
    return getPanelRatio(this.config.panelState, id);
  }

  private createIndicatorSubPanelHost(): SubPanelHostChart {
    const chart = this;
    return {
      startIndex: chart.startIndex,
      endIndex: chart.endIndex,
      get dmiScaleRange() {
        return chart.dmiScaleRange;
      },
      set dmiScaleRange(value: { lo: number; hi: number } | null) {
        chart.dmiScaleRange = value;
      },
      subIndicatorAlerts: chart.subIndicatorAlerts,
      subIndicatorAlertHitAreas: chart.subIndicatorAlertHitAreas,
      config: chart.config,
      getPanelRatio: (id: string) => chart.getPanelRatio(id),
      getSubPanelScaledRange: (id: string, lo: number, hi: number) => chart.getSubPanelScaledRange(id, lo, hi),
    };
  }

  public shiftPanelOrder(panelId: string, direction: -1 | 1) {
    movePanel(this.config.panelState, panelId as any, direction, this.activePanels);
  }

  public setIndicatorStyle(styleKey: string, patch: { color?: string; width?: number; dash?: number[] }) {
    updateLineStyle(this.config.panelState, styleKey, patch);
  }

  public setIndicatorLineVisible(styleKey: string, visible: boolean) {
    setLineVisible(this.config.panelState, styleKey, visible);
  }

  public isIndicatorLineVisible(styleKey: string): boolean {
    return getLineVisible(this.config.panelState, styleKey);
  }

  private resolveStyle(styleKey: string, fallbackColor: string, fallbackWidth = 1.5, fallbackDash: number[] = []) {
    return getLineStyle(this.config.panelState, styleKey, {
      color: fallbackColor,
      width: fallbackWidth,
      dash: fallbackDash,
    });
  }

  private getMaLines(): Array<{ id: string; period: number }> {
    const ind = this.config.indicators as any;
    const ma = ind.ma ?? { show: false, nextId: 1, lines: [] };
    if (!Array.isArray(ma.lines)) ma.lines = [];

    const legacy = [
      { key: 'maShort', period: Number(ind.maShort?.value ?? 5), color: '#f7931a' },
      { key: 'maLong', period: Number(ind.maLong?.value ?? 20), color: '#2962ff' },
      { key: 'ma60', period: Number(ind.ma60?.value ?? 60), color: '#4caf50' },
      { key: 'ma120', period: Number(ind.ma120?.value ?? 120), color: '#9c27b0' },
      { key: 'ma200', period: Number(ind.ma200?.value ?? 200), color: '#ff5722' },
    ].filter((item) => ind[item.key]?.show);

    if (!ind.ma && legacy.length) {
      ind.ma = ma;
      ma.show = true;
      ma.lines = legacy.map((item, index) => ({ id: `ma${index + 1}`, period: item.period }));
      ma.nextId = ma.lines.length + 1;
      ma.lines.forEach((lineItem: { id: string }, index: number) => {
        updateLineStyle(this.config.panelState, lineItem.id, { color: legacy[index]?.color ?? '#ffffff' });
        setLineVisible(this.config.panelState, lineItem.id, true);
      });
      legacy.forEach((item) => {
        if (ind[item.key]) ind[item.key].show = false;
      });
    }

    return ma.show
      ? ma.lines
          .map((lineItem: any) => ({
            id: String(lineItem.id || `ma${ma.lines.indexOf(lineItem) + 1}`),
            period: Math.max(1, Math.floor(Number(lineItem.period ?? lineItem.value ?? 20) || 20)),
          }))
          .filter((lineItem: { id: string; period: number }) => Boolean(lineItem.id) && Number.isFinite(lineItem.period))
      : [];
  }

  public addMaLine(period?: number): { id: string; period: number } {
    const ind = this.config.indicators as any;
    if (!ind.ma) ind.ma = { show: true, nextId: 1, lines: [] };
    const ma = ind.ma;
    if (ind.ema) ind.ema.show = false;
    if (!Array.isArray(ma.lines)) ma.lines = [];
    const nextIndex = Math.max(1, Number(ma.nextId) || ma.lines.length + 1);
    const lineItem = {
      id: `ma${nextIndex}`,
      period: Math.max(1, Math.floor(Number(period ?? ([5, 20, 60, 120, 200][ma.lines.length] ?? 20)) || 20)),
    };
    ma.lines.push(lineItem);
    ma.nextId = nextIndex + 1;
    ma.show = true;
    const palette = ['#f7931a', '#2962ff', '#4caf50', '#9c27b0', '#ff5722', '#00bcd4', '#ffc107', '#e91e63'];
    updateLineStyle(this.config.panelState, lineItem.id, {
      color: palette[(ma.lines.length - 1) % palette.length],
      width: 1.5,
      dash: [],
    });
    setLineVisible(this.config.panelState, lineItem.id, true);
    return lineItem;
  }

  private getEmaLines(): Array<{ id: string; period: number }> {
    const ind = this.config.indicators as any;
    const ema = ind.ema ?? { show: false, nextId: 1, lines: [] };
    if (!Array.isArray(ema.lines)) ema.lines = [];
    return ema.show
      ? ema.lines
          .map((lineItem: any) => ({
            id: String(lineItem.id || ('ema' + (ema.lines.indexOf(lineItem) + 1))),
            period: Math.max(1, Math.floor(Number(lineItem.period ?? lineItem.value ?? 20) || 20)),
          }))
          .filter((lineItem: { id: string; period: number }) => Boolean(lineItem.id) && Number.isFinite(lineItem.period))
      : [];
  }

  public addEmaLine(period?: number): { id: string; period: number } {
    const ind = this.config.indicators as any;
    if (!ind.ema) ind.ema = { show: true, nextId: 1, lines: [] };
    const ema = ind.ema;
    if (ind.ma) ind.ma.show = false;
    if (!Array.isArray(ema.lines)) ema.lines = [];
    const nextIndex = Math.max(1, Number(ema.nextId) || ema.lines.length + 1);
    const lineItem = {
      id: 'ema' + nextIndex,
      period: Math.max(1, Math.floor(Number(period ?? ([5, 20, 60, 120, 200][ema.lines.length] ?? 20)) || 20)),
    };
    ema.lines.push(lineItem);
    ema.nextId = nextIndex + 1;
    ema.show = true;
    const palette = ['#ff9800', '#00b0ff', '#7cb342', '#ab47bc', '#ff7043', '#26c6da', '#ffd54f', '#ec407a'];
    updateLineStyle(this.config.panelState, lineItem.id, {
      color: palette[(ema.lines.length - 1) % palette.length],
      width: 1.5,
      dash: [],
    });
    setLineVisible(this.config.panelState, lineItem.id, true);
    return lineItem;
  }

  private getBbLines(): Array<{ id: string; period: number; stdDev: number }> {
    const ind = this.config.indicators as any;
    const bb = ind.bb;
    if (!bb?.show) return [];
    if (!Array.isArray(bb.lines)) {
      bb.lines = [{
        id: 'bb1',
        period: Math.max(1, Math.floor(Number(bb.period ?? 20) || 20)),
        stdDev: Number(bb.stdDev ?? 2) || 2,
      }];
      bb.nextId = 2;
      updateLineStyle(this.config.panelState, 'bb1Upper', this.resolveStyle('bbUpper', 'rgba(100,149,237,0.8)', 1));
      updateLineStyle(this.config.panelState, 'bb1Middle', this.resolveStyle('bbMiddle', 'rgba(100,149,237,0.5)', 1, [4, 4]));
      updateLineStyle(this.config.panelState, 'bb1Lower', this.resolveStyle('bbLower', 'rgba(100,149,237,0.8)', 1));
      setLineVisible(this.config.panelState, 'bb1Upper', this.isIndicatorLineVisible('bbUpper'));
      setLineVisible(this.config.panelState, 'bb1Middle', this.isIndicatorLineVisible('bbMiddle'));
      setLineVisible(this.config.panelState, 'bb1Lower', this.isIndicatorLineVisible('bbLower'));
    }
    return bb.lines
      .map((lineItem: any, index: number) => ({
        id: String(lineItem.id || `bb${index + 1}`),
        period: Math.max(1, Math.floor(Number(lineItem.period ?? bb.period ?? 20) || 20)),
        stdDev: Math.max(0.1, Number(lineItem.stdDev ?? bb.stdDev ?? 2) || 2),
      }))
      .filter((lineItem: { id: string; period: number; stdDev: number }) => Boolean(lineItem.id));
  }

  public addBbLine(period?: number, stdDev?: number): { id: string; period: number; stdDev: number } {
    const ind = this.config.indicators as any;
    if (!ind.bb) ind.bb = { show: true, period: 20, stdDev: 2, nextId: 1, lines: [] };
    const bb = ind.bb;
    if (!Array.isArray(bb.lines)) bb.lines = this.getBbLines();
    const nextIndex = Math.max(1, Number(bb.nextId) || bb.lines.length + 1);
    const lineItem = {
      id: `bb${nextIndex}`,
      period: Math.max(1, Math.floor(Number(period ?? 20) || 20)),
      stdDev: Math.max(0.1, Number(stdDev ?? (bb.lines.length ? 1 : 2)) || 2),
    };
    bb.lines.push(lineItem);
    bb.nextId = nextIndex + 1;
    bb.show = true;
    const palette = ['100,149,237', '255,193,7', '38,166,154', '239,83,80', '156,39,176'];
    const rgb = palette[(bb.lines.length - 1) % palette.length];
    updateLineStyle(this.config.panelState, `${lineItem.id}Upper`, { color: `rgba(${rgb},0.82)`, width: 1, dash: [] });
    updateLineStyle(this.config.panelState, `${lineItem.id}Middle`, { color: `rgba(${rgb},0.48)`, width: 1, dash: [4, 4] });
    updateLineStyle(this.config.panelState, `${lineItem.id}Lower`, { color: `rgba(${rgb},0.82)`, width: 1, dash: [] });
    setLineVisible(this.config.panelState, `${lineItem.id}Upper`, true);
    setLineVisible(this.config.panelState, `${lineItem.id}Middle`, true);
    setLineVisible(this.config.panelState, `${lineItem.id}Lower`, true);
    return lineItem;
  }

  public getStrategies(): StrategyDefinition[] {
    return [...this.strategies];
  }

  public getActiveStrategyId(): string | null {
    return this.activeStrategyId;
  }

  public getActiveStrategyName(): string | null {
    return this.getActiveStrategy()?.name ?? null;
  }

  public getCandles(): CandleData[] {
    return this.data;
  }

  public setTimeframe(timeframe: TimeframeKey): void {
    this.config.timeframe = timeframe;
    this.applyOneSecondIndicatorPolicy();
  }

  private applyOneSecondIndicatorPolicy(): void {
    const indicators = this.config.indicators as Record<string, { show?: boolean }>;
    const autoHideSubIndicators = ['rsi', 'dmi', 'macd', 'stochF', 'stochS', 'cci', 'obv'];

    if (this.config.timeframe === '1s') {
      if (!this.oneSecondIndicatorVisibilityBackup) {
        this.oneSecondIndicatorVisibilityBackup = {};
        autoHideSubIndicators.forEach((key) => {
          this.oneSecondIndicatorVisibilityBackup![key] = indicators[key]?.show === true;
        });
      }
      autoHideSubIndicators.forEach((key) => {
        if (indicators[key]) indicators[key].show = false;
      });
      if (indicators.volume) indicators.volume.show = true;
      return;
    }

    if (!this.oneSecondIndicatorVisibilityBackup) return;
    autoHideSubIndicators.forEach((key) => {
      if (!indicators[key]) return;
      const saved = this.oneSecondIndicatorVisibilityBackup?.[key];
      if (typeof saved === 'boolean') indicators[key].show = saved;
    });
    this.oneSecondIndicatorVisibilityBackup = null;
  }

  public getIndicatorPanelHeader(panelId: string): {
    title: string;
    settings: Array<{ text: string; hint: string }>;
    values: Array<{ text: string; color: string }>;
  } | null {
    const ind = this.config.indicators as any;
    const lastFinite = (arr: Array<number | null | undefined>): number | null => {
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        const v = arr[i];
        if (v != null && Number.isFinite(v)) return v as number;
      }
      return null;
    };
    const fmt = (v: number | null, digits = 2) => (v == null ? '-' : v.toFixed(digits));

    if (panelId === 'rsi') {
      const s = this.resolveStyle('rsi', '#ffeb3b');
      const rsi = lastFinite(this.calcRSI(ind.rsi.period));
      return {
        title: 'RSI',
        settings: [{ text: String(ind.rsi.period), hint: 'RSI 기간' }],
        values: [{ text: fmt(rsi, 2), color: s.color }],
      };
    }
    if (panelId === 'dmi') {
      const plusStyle = this.resolveStyle('dmiPlus', '#22ab94');
      const minusStyle = this.resolveStyle('dmiMinus', '#f23645');
      const adxStyle = this.resolveStyle('dmiAdx', '#ffffff');
      const dmi = this.calcDMI(ind.dmi.period);
      return {
        title: 'DMI',
        settings: [{ text: String(ind.dmi.period), hint: 'DMI 기간' }],
        values: [
          { text: fmt(lastFinite(dmi.plusDI), 2), color: plusStyle.color },
          { text: fmt(lastFinite(dmi.minusDI), 2), color: minusStyle.color },
          { text: fmt(lastFinite(dmi.adx), 2), color: adxStyle.color },
        ],
      };
    }
    if (panelId === 'macd') {
      const macdStyle = this.resolveStyle('macdLine', '#2962ff');
      const sigStyle = this.resolveStyle('macdSignal', '#f23645');
      const data = this.calcMACD(ind.macd.fast, ind.macd.slow, ind.macd.signal);
      return {
        title: 'MACD',
        settings: [
          { text: String(ind.macd.fast), hint: 'MACD fast' },
          { text: String(ind.macd.slow), hint: 'MACD slow' },
          { text: String(ind.macd.signal), hint: 'MACD signal' },
        ],
        values: [
          { text: fmt(lastFinite(data.macdLine), 2), color: macdStyle.color },
          { text: fmt(lastFinite(data.sigLine), 2), color: sigStyle.color },
        ],
      };
    }
    if (panelId === 'stochF') {
      const kStyle = this.resolveStyle('stochFastK', '#22ab94');
      const dStyle = this.resolveStyle('stochFastD', '#f23645');
      const data = this.calcStoch(ind.stochF.kPeriod, ind.stochF.dPeriod);
      return {
        title: 'StochF',
        settings: [
          { text: String(ind.stochF.kPeriod), hint: 'Stoch Fast %K' },
          { text: String(ind.stochF.dPeriod), hint: 'Stoch Fast %D' },
        ],
        values: [
          { text: fmt(lastFinite(data.k), 2), color: kStyle.color },
          { text: fmt(lastFinite(data.d), 2), color: dStyle.color },
        ],
      };
    }
    if (panelId === 'stochS') {
      const kStyle = this.resolveStyle('stochSlowK', '#22ab94');
      const dStyle = this.resolveStyle('stochSlowD', '#f23645');
      const data = this.calcStoch(ind.stochS.kPeriod, ind.stochS.dPeriod);
      return {
        title: 'StochS',
        settings: [
          { text: String(ind.stochS.kPeriod), hint: 'Stoch Slow %K' },
          { text: String(ind.stochS.dPeriod), hint: 'Stoch Slow %D' },
        ],
        values: [
          { text: fmt(lastFinite(data.k), 2), color: kStyle.color },
          { text: fmt(lastFinite(data.d), 2), color: dStyle.color },
        ],
      };
    }
    if (panelId === 'cci') {
      const s = this.resolveStyle('cci', '#22ab94');
      const cci = lastFinite(this.calcCCI(ind.cci.period));
      return {
        title: 'CCI',
        settings: [{ text: String(ind.cci.period), hint: 'CCI 기간' }],
        values: [{ text: fmt(cci, 2), color: s.color }],
      };
    }
    if (panelId === 'atr') {
      const s = this.resolveStyle('atr', '#00bcd4');
      const atr = lastFinite(this.calcATR(ind.atr?.period ?? 14));
      return {
        title: 'ATR',
        settings: [{ text: String(ind.atr?.period ?? 14), hint: 'ATR 기간' }],
        values: [{ text: fmt(atr, 2), color: s.color }],
      };
    }
    if (panelId === 'obv') {
      const s = this.resolveStyle('obv', '#22ab94');
      const obv = lastFinite(this.calcOBV().map((v) => v as number | null));
      return {
        title: 'OBV',
        settings: [],
        values: [{ text: fmt(obv, 0), color: s.color }],
      };
    }
    if (panelId === 'cvd') {
      const s = this.resolveStyle('cvd', '#7b68ee');
      const cvd = lastFinite(this.calcCVD().map((v) => v as number | null));
      return {
        title: 'CVD',
        settings: [],
        values: [{ text: fmt(cvd, 0), color: s.color }],
      };
    }
    if (panelId === 'volume') {
      const last = this.data[this.data.length - 1];
      const lastVol = last?.volume;
      const lastTurnover = last ? last.volume * last.close : null;
      return {
        title: 'Volume',
        settings: [],
        values: [
          { text: `V ${lastVol == null ? '-' : formatThousandAdaptive(lastVol, 0)}`, color: '#8fa2c4' },
          { text: `거래대금 ${lastTurnover == null ? '-' : formatKUnitWithComma(lastTurnover)}`, color: '#c7d2ea' },
        ],
      };
    }
    return null;
  }

  public setDrawingTool(tool: string | null): void {
    const allowed: ActiveDrawingToolId[] = [
      'trendline',
      'extended-trendline',
      'ray-trendline',
      'vertical-line',
      'cross-line',
      'draw-pencil',
      'draw-highlighter',
      'draw-box',
      'draw-circle',
      'hline',
      'channel',
      'fib-retracement',
      'fib-trend',
      'anchored-vwap',
      'long-position',
      'short-position',
      'measure',
      'text-note',
      'xabcd-pattern',
      'cypher-pattern',
      'head-shoulders-pattern',
      'abcd-pattern',
      'triangle-pattern',
      'three-drives-pattern',
      'elliott-impulse-wave',
      'elliott-correction-wave',
      'elliott-triangle-wave',
      'elliott-double-combo-wave',
      'elliott-triple-combo-wave',
      'eraser',
    ];
    if (!tool || !allowed.includes(tool as ActiveDrawingToolId)) {
      this.drawingTool = null;
      this.drawingMagnetMode = 'soft';
      window.dispatchEvent(new CustomEvent('chart-drawing-tool-changed', {
        detail: { toolId: this.drawingTool },
      }));
      window.dispatchEvent(new CustomEvent('chart-magnet-mode-changed', {
        detail: { mode: 'soft' },
      }));
      this.drawingDraft = null;
      this.drawingDragActive = false;
      this.pendingChannelId = null;
      this.fibTrendPointStage = 0;
      this.patternPointStage = 0;
      this.touchDrawingTapCount = 0;
      this._lastCrosshairOHLCIdx = -2;
      this.updateChartCursor();
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      return;
    }
    this.drawingTool = tool as ActiveDrawingToolId;
    window.dispatchEvent(new CustomEvent('chart-drawing-tool-changed', {
      detail: { toolId: this.drawingTool },
    }));
    this.drawingDraft = null;
    this.drawingDragActive = false;
    this.drawingMoveState = null;
    this.touchDrawingTapCount = 0;
    if (this.drawingTool !== 'channel') this.pendingChannelId = null;
    if (this.drawingTool !== 'fib-trend') this.fibTrendPointStage = 0;
    if (!isPatternDrawingKind(this.drawingTool)) this.patternPointStage = 0;
    // 자유 드로잉은 기본 열십자 라인을 유지
    if (this.isCrosshairMode && this.drawingTool !== 'draw-pencil' && this.drawingTool !== 'draw-highlighter') {
      this.exitCrosshairMode();
    }
    if (this.drawingTool === 'text-note' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)) {
      const metrics = this.getMainViewportMetrics();
      this.touchDrawingCrosshairX = metrics ? (metrics.chartLeft + metrics.chartRight) / 2 : this.canvas.clientWidth / 2;
      this.touchDrawingCrosshairY = metrics ? (metrics.top + metrics.mainH) / 2 : this.canvas.clientHeight / 2;
      this.mouseX = this.touchDrawingCrosshairX;
      this.mouseY = this.touchDrawingCrosshairY;
      this.isMouseOver = true;
    }
    this.updateChartCursor();
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    // 모바일: 드로잉 도구 사용 안내 가이드 (TradingView 스타일)
    if (this.drawingTool !== 'eraser') {
      this.showDrawingGuide(this.drawingTool);
    }
  }

  private showDrawingGuide(tool: DrawingToolId): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    // 터치 환경(모바일)에서만 표시
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (!isTouch) return;

    const guideMap: Partial<Record<DrawingToolId, string[]>> = {
      'trendline':       ['① 시작점을 탭하세요', '② 끝점을 탭해 추세선을 완성하세요'],
      'extended-trendline': ['① 시작점을 탭하세요', '② 끝점을 탭하면 양방향으로 연장됩니다'],
      'ray-trendline':   ['① 시작점을 탭하세요', '② 끝점을 탭하면 그 방향으로 연장됩니다'],
      'vertical-line':   ['탭한 위치에 수직선이 그려집니다'],
      'cross-line':      ['탭한 위치에 교차선이 그려집니다'],
      'draw-pencil':     ['① 시작점을 탭하세요', '② 끝점을 탭해 연필선을 완성하세요'],
      'draw-highlighter':['① 시작점을 탭하세요', '② 끝점을 탭해 형광펜선을 완성하세요'],
      'draw-box':        ['① 첫 번째 꼭짓점 탭', '② 반대 꼭짓점 탭으로 박스를 완성하세요'],
      'draw-circle':     ['① 중심점을 탭하세요', '② 크기를 정할 위치를 탭해 원을 완성하세요'],
      'hline':           ['탭한 위치에 수평선이 그려집니다'],
      'channel':         ['① 첫 번째 선의 시작점 탭', '② 끝점 탭', '③ 두 번째 선 위치 탭'],
      'fib-retracement': ['① 시작점을 탭하세요', '② 끝점을 탭해 피보나치를 완성하세요'],
      'fib-trend':       ['① 첫 번째 기준점 탭', '② 두 번째 기준점 탭', '③ 세 번째 기준점 탭'],
      'anchored-vwap':   ['앵커가 될 캔들을 탭하면 해당 시점부터 VWAP가 그려집니다'],
      'measure':         ['① 측정 시작점 탭', '② 끝점 탭으로 가격·시간 범위 측정'],
      'text-note':       ['텍스트입력 위치에 탭하세요'],
      'xabcd-pattern':   ['X, A, B, C, D 순서로 5개 점을 탭하세요'],
      'cypher-pattern':  ['X, A, B, C, D 순서로 5개 점을 탭하세요'],
      'head-shoulders-pattern': ['시작점, 왼어깨, 왼목, 머리, 오른목, 오른어깨, 끝점 순서로 7개 점을 탭하세요'],
      'abcd-pattern':    ['A, B, C, D 순서로 4개 점을 탭하세요'],
      'triangle-pattern':['A, B, C, D 순서로 4개 점을 탭하세요'],
      'three-drives-pattern': ['1, A, 2, B, 3, C, 4 순서로 7개 점을 탭하세요'],
      'elliott-impulse-wave': ['0, 1, 2, 3, 4, 5 순서로 6개 점을 탭하세요'],
      'elliott-correction-wave': ['0, A, B, C 순서로 4개 점을 탭하세요'],
      'elliott-triangle-wave': ['0, A, B, C, D, E 순서로 6개 점을 탭하세요'],
      'elliott-double-combo-wave': ['0, W, X, Y 순서로 4개 점을 탭하세요'],
      'elliott-triple-combo-wave': ['0, W, X, Y, X, Z 순서로 6개 점을 탭하세요'],
    };
    // position 툴은 전용 가이드 사용
    if (tool === 'long-position' || tool === 'short-position') {
      this.showPositionGuide(0, tool);
      return;
    }
    const steps = guideMap[tool];
    if (!steps?.length) return;

    // 기존 가이드 제거
    host.querySelectorAll('.drawing-guide-toast').forEach((el) => el.remove());

    const guide = document.createElement('div');
    guide.className = 'drawing-guide-toast';
    guide.style.cssText = [
      'position:absolute', 'left:50%', 'top:14px',
      'transform:translateX(-50%)',
      'z-index:2300',
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:4px',
      'padding:8px 16px',
      'border-radius:10px',
      'background:rgba(12,18,32,0.92)',
      'border:1px solid #3a5080',
      'color:#c8d8f4',
      'font:500 12px ' + CHART_FONT_STACK,
      'pointer-events:none',
      'box-shadow:0 6px 18px rgba(0,0,0,0.45)',
      'white-space:nowrap',
    ].join(';');
    guide.innerHTML = steps.map((s, i) =>
      `<span style="color:${i === 0 ? '#7eb8ff' : '#8fa8cc'}">${s}</span>`
    ).join('');
    host.appendChild(guide);

    // 3.5초 후 페이드아웃
    window.setTimeout(() => {
      guide.style.transition = 'opacity 300ms ease';
      guide.style.opacity = '0';
      window.setTimeout(() => guide.remove(), 310);
    }, 3500);
  }

  /** 롱/숏 포지션 드로잉 단계별 안내 토스트 */
  private showPositionGuide(stage: number, tool: string): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    host.querySelectorAll('.drawing-guide-toast').forEach((el) => el.remove());

    const isLong = tool === 'long-position';
    const messages: string[] = stage === 0
      ? [isLong ? '?? 롱 포지션' : '?? 숏 포지션', '포인트를 이동 후 탭하세요']
      : ['앵커를 드래그해 편집하세요',
        '↕ 손절가/목표가 (상하 이동)',
        '↔ 우측 앵커 (좌우 이동)',
        '박스 외부 터치로 편집 완료'];

    const guide = document.createElement('div');
    guide.className = 'drawing-guide-toast';
    guide.style.cssText = [
      'position:absolute', 'left:50%', 'top:14px',
      'transform:translateX(-50%)',
      'z-index:2300',
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:3px',
      'padding:8px 16px',
      'border-radius:10px',
      'background:rgba(12,18,32,0.93)',
      'border:1px solid #3a5080',
      'color:#c8d8f4',
      `font:500 12px ${CHART_FONT_STACK}`,
      'pointer-events:none',
      'box-shadow:0 6px 18px rgba(0,0,0,0.45)',
      'white-space:nowrap',
    ].join(';');
    guide.innerHTML = messages.map((s, i) =>
      `<span style="color:${i === 0 ? '#7eb8ff' : '#8fa8cc'}">${s}</span>`
    ).join('');
    host.appendChild(guide);

    const duration = stage === 0 ? 3000 : 4000;
    window.setTimeout(() => {
      guide.style.transition = 'opacity 300ms ease';
      guide.style.opacity = '0';
      window.setTimeout(() => guide.remove(), 310);
    }, duration);
  }

  public isDrawingsVisible(): boolean {
    return this.drawingsVisible;
  }

  public isIndicatorsVisible(): boolean {
    return this.indicatorsVisible;
  }

  public isPatternBoxesVisible(): boolean {
    return this.patternBoxesVisible;
  }

  public setDrawingsVisible(visible: boolean): void {
    this.drawingsVisible = visible;
    window.dispatchEvent(new CustomEvent('chart-drawings-visibility-changed', {
      detail: { visible: this.drawingsVisible },
    }));
    if (!visible) {
      this.drawingDraft = null;
      this.drawingDragActive = false;
      this.clearDrawingSelection();
    }
    this.requestOverlayDraw();
  }

  public setIndicatorsVisible(visible: boolean): void {
    this.indicatorsVisible = visible;
    if (!visible) this.dmiScaleRange = null;
    this.draw();
  }

  public setFixedRangeVolumeProfileToVisibleRange(): boolean {
    const ind = (this.config.indicators as any).fixedRangeVolumeProfile;
    if (!ind || this.data.length === 0) return false;
    const start = Math.max(0, Math.min(this.data.length - 1, this.startIndex));
    const end = Math.max(start, Math.min(this.data.length - 1, this.endIndex - 1));
    ind.rangeStartTime = this.data[start]?.time;
    ind.rangeEndTime = this.data[end]?.time;
    ind.show = true;
    this.draw();
    return true;
  }

  public setPatternBoxesVisible(visible: boolean): void {
    this.patternBoxesVisible = visible;
    window.dispatchEvent(new CustomEvent('chart-pattern-visibility-changed', {
      detail: { visible: this.patternBoxesVisible },
    }));
    this.draw();
  }

  public getDrawingCount(): number {
    return this.drawings.length;
  }

  public areAllDrawingsLocked(): boolean {
    return this.drawings.length > 0 && this.drawings.every((shape) => Boolean(shape.locked));
  }

  public setAllDrawingsLocked(locked: boolean): number {
    if (!this.drawings.length) return 0;
    const { drawings, changed } = setDrawingsLocked(this.drawings, locked);
    if (!changed) return 0;
    this.drawings = drawings;
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    this.emitDrawingsChanged();
    return changed;
  }

  public getDrawingsSnapshot(): DrawingShape[] {
    return cloneDrawingsSnapshot(this.drawings);
  }

  public setDrawingsSnapshot(drawings: DrawingShape[]): void {
    this.drawings = cloneDrawingsSnapshot(drawings);
    this.selectedDrawingId = null;
    this.selectedDrawingPart = 'line';
    this.drawingMoveState = null;
    this.drawingDraft = null;
    this.drawingDragActive = false;
    this.pendingChannelId = null;
    this.fibTrendPointStage = 0;
    this.patternPointStage = 0;
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    this.emitDrawingsChanged();
  }

  public getEnabledIndicatorCount(): number {
    const indicators = this.config.indicators as Record<string, { show?: boolean }>;
    let count = 0;
    Object.values(indicators).forEach((config) => {
      if (config && typeof config.show === 'boolean' && config.show) count += 1;
    });
    return count;
  }

  public clearAllDrawings(includeLocked = true): number {
    if (this.drawings.length === 0) return 0;
    const result = clearDrawings(this.drawings, includeLocked);
    this.drawings = result.drawings;
    const removed = result.removed;
    if (removed <= 0) return 0;
    if (this.selectedDrawingId && !hasDrawing(this.drawings, this.selectedDrawingId)) {
      this.clearDrawingSelection();
    } else {
      this.requestOverlayDraw();
    }
    this.emitDrawingsChanged();
    return removed;
  }

  public clearAllIndicators(): number {
    const indicators = this.config.indicators as Record<string, { show?: boolean }>;
    let removed = 0;
    Object.values(indicators).forEach((config) => {
      if (config && typeof config.show === 'boolean' && config.show) {
        config.show = false;
        removed += 1;
      }
    });
    if (removed > 0) this.draw();
    return removed;
  }

  // Default policy: any newly added drawing tool disarms after one completed draw.
  // Only explicitly multi-stage tools should return false.
  private shouldAutoDisarmAfterCreate(kind: DrawingToolId): boolean {
    return kind !== 'fib-trend';
  }

  private appendPatternPoint(kind: PatternDrawingToolId, anchor: DrawingAnchor): boolean {
    const required = getPatternPointCount(kind);
    const existing = this.drawingDraft?.kind === kind
      ? (this.drawingDraft.points ?? [this.drawingDraft.a]).slice(0, Math.max(1, this.patternPointStage))
      : [];
    const points = [...existing, anchor];
    this.drawingDraft = {
      kind,
      a: points[0],
      b: points[points.length - 1],
      points,
    };
    this.patternPointStage = points.length;
    if (points.length < required) {
      this.requestOverlayDraw();
      return false;
    }

    const created = createPatternDrawing({ kind, points });
    this.drawingDraft = null;
    this.patternPointStage = 0;
    if (!created) {
      this.requestOverlayDraw();
      return true;
    }
    this.upsertDrawing(created);
    this.selectedDrawingId = created.id;
    this.selectedDrawingPart = 'line';
    this.syncDrawingToolbar();
    this.setDrawingTool(null);
    this.requestOverlayDraw();
    return true;
  }

  private addTrianglePatternAnchorAfterD(): void {
    const selected = this.getSelectedDrawing();
    if (!selected || selected.kind !== 'triangle-pattern' || selected.locked) return;
    const points = (selected.points ?? [selected.a, selected.b ?? selected.a]).map((point) => ({ ...point }));
    if (points.length < 4 || points.length >= 9) return;
    const [a, b, c, d] = points;
    const last = points[points.length - 1];
    const previous = points[points.length - 2] ?? points[points.length - 1];
    const visibleSpan = Math.max(1, this.endIndex - this.startIndex);
    const indexStep = Math.max(2, Math.abs(last.index - previous.index), visibleSpan * 0.08);
    const projectPrice = (left: DrawingAnchor, right: DrawingAnchor, index: number): number => {
      const dx = right.index - left.index;
      if (Math.abs(dx) < 1e-9) return right.price;
      const t = (index - left.index) / dx;
      return left.price + ((right.price - left.price) * t);
    };
    const getGuideIntersectionIndex = (): number | null => {
      const acDx = c.index - a.index;
      const acDy = c.price - a.price;
      const bdDx = d.index - b.index;
      const bdDy = d.price - b.price;
      const denominator = (acDx * bdDy) - (acDy * bdDx);
      if (Math.abs(denominator) < 1e-9) return null;
      const sourceDx = b.index - a.index;
      const sourceDy = b.price - a.price;
      const t = ((sourceDx * bdDy) - (sourceDy * bdDx)) / denominator;
      return a.index + (acDx * t);
    };
    const apexIndex = getGuideIntersectionIndex();
    let nextIndex = last.index + indexStep;
    if (apexIndex != null && apexIndex > last.index + 0.5) {
      const remaining = apexIndex - last.index;
      nextIndex = last.index + Math.max(0.5, Math.min(indexStep, remaining * 0.72));
    }
    const shouldUseLowerGuide = points.length % 2 === 0;
    const guideStart = shouldUseLowerGuide ? a : b;
    const guideEnd = shouldUseLowerGuide ? c : d;
    const nextAnchor: DrawingAnchor = {
      index: nextIndex,
      price: projectPrice(guideStart, guideEnd, nextIndex),
    };
    const nextPoints = [...points, nextAnchor];
    selected.points = nextPoints;
    selected.a = nextPoints[0];
    selected.b = nextPoints[nextPoints.length - 1];
    this.upsertDrawing(selected);
    this.selectedDrawingPart = `point-${nextPoints.length - 1}` as DrawingHitPart;
    this.drawingToolbarBoundId = null;
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
  }

  private removeTrianglePatternAnchorAfterD(): void {
    const selected = this.getSelectedDrawing();
    if (!selected || selected.kind !== 'triangle-pattern' || selected.locked) return;
    const points = (selected.points ?? [selected.a, selected.b ?? selected.a]).map((point) => ({ ...point }));
    if (points.length <= 4) return;
    const nextPoints = points.slice(0, -1);
    selected.points = nextPoints;
    selected.a = nextPoints[0];
    selected.b = nextPoints[nextPoints.length - 1];
    this.upsertDrawing(selected);
    this.selectedDrawingPart = 'line';
    this.drawingToolbarBoundId = null;
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
  }

  private updatePatternDraftPreview(anchor: DrawingAnchor): void {
    if (!this.drawingTool || !isPatternDrawingKind(this.drawingTool) || !this.drawingDraft) return;
    const committed = this.drawingDraft.points?.slice(0, Math.max(1, this.patternPointStage)) ?? [this.drawingDraft.a];
    this.drawingDraft.points = [...committed, anchor];
    this.drawingDraft.b = anchor;
  }

  private getDefaultChannelOffset(a: DrawingAnchor, b: DrawingAnchor): DrawingAnchor {
    const fallbackMax = Math.max(a.price, b.price);
    const fallbackMin = Math.min(a.price, b.price);
    const meta = this.lastDrawMeta;
    const visibleRange = (meta?.maxP ?? fallbackMax) - (meta?.minP ?? fallbackMin);

    // Channel(평행 추세선) 기본 간격은 "보이는 가격 범위" 기반이되,
    // 화면 상에서 너무 붙어 보이지 않도록 최소 픽셀 간격도 함께 보장한다.
    const absRange = Math.max(0, Math.abs(visibleRange));
    const minRangeGap = Math.max(0.5, absRange * 0.02);
    const maxRangeGap = Math.max(minRangeGap, absRange * 0.15);
    let gap = minRangeGap;
    if (meta && absRange > 0) {
      const mid = (a.price + b.price) * 0.5;
      const probe = Math.max(1e-9, absRange * 0.001);
      const dy = Math.abs(meta.getY(mid + probe) - meta.getY(mid));
      if (dy > 1e-6) {
        const targetPx = 28;
        const pxGap = probe * (targetPx / dy);
        if (Number.isFinite(pxGap)) gap = Math.max(gap, Math.abs(pxGap));
      }
    }
    gap = Math.min(gap, maxRangeGap);
    const direction = b.price >= a.price ? 1 : -1;
    return { index: 0, price: gap * direction };
  }

  public deleteSelectedDrawing(): void {
    if (!this.selectedDrawingId) return;
    this.closeAnchoredVwapSettingsModal(false);
    this.drawings = deleteDrawingById(this.drawings, this.selectedDrawingId);
    this.selectedDrawingId = null;
    this.selectedDrawingPart = 'line';
    this.drawingMoveState = null;
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    this.emitDrawingsChanged();
  }

  public copySelectedDrawing(): boolean {
    const selected = this.getSelectedDrawing();
    if (!canCopyDrawingShape(selected)) return false;
    const cloned = this.cloneShape(selected);
    cloned.id = '';
    this.copiedDrawingTemplate = cloned;
    return true;
  }

  public pasteCopiedDrawing(): boolean {
    if (!this.copiedDrawingTemplate) return false;
    const base = this.cloneShape(this.copiedDrawingTemplate);
    const shiftBars = Math.max(2, Math.round((this.endIndex - this.startIndex) * 0.04));
    const priceRange = (this.lastDrawMeta?.maxP ?? 1) - (this.lastDrawMeta?.minP ?? 0);
    const shiftPrice = Math.max(0.5, priceRange * 0.01);
    const moveAnchor = (a: DrawingAnchor): DrawingAnchor => ({
      index: Math.max(0, Math.min(this.data.length - 1, a.index + shiftBars)),
      price: a.price + shiftPrice,
    });
    const pasted: DrawingShape = {
      ...base,
      id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      a: moveAnchor(base.a),
      b: base.b ? moveAnchor(base.b) : undefined,
      alert: base.alert ? { ...base.alert, lastTriggerBar: undefined } : undefined,
    };
    this.drawings = upsertDrawingShape(this.drawings, pasted);
    this.selectedDrawingId = pasted.id;
    this.selectedDrawingPart = 'line';
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    return true;
  }

  private clearDrawingSelection(): void {
    const selectedShape = this.getSelectedDrawing();
    this.closeAnchoredVwapSettingsModal(false);
    this.closeTrendlineTextEditor(false);
    this.closePositionSettingsPopup();
    this.selectedDrawingId = null;
    this.selectedDrawingPart = 'line';
    this.drawingMoveState = null;
    this.drawingDraft = null;
    this.drawingDragActive = false;
    this.pendingChannelId = null;
    this.fibTrendPointStage = 0;
    this.syncDrawingToolbar();
    this.refreshDrawingSelectionVisual(selectedShape);
  }

  private getSelectedDrawing(): DrawingShape | null {
    return findDrawingById(this.drawings, this.selectedDrawingId);
  }

  private refreshDrawingSelectionVisual(shape: DrawingShape | null): void {
    if (shape?.kind === 'anchored-vwap') {
      this.draw();
      return;
    }
    this.requestOverlayDraw();
  }

  private upsertDrawing(next: DrawingShape): void {
    this.drawings = upsertDrawingShape(this.drawings, next);
    this.emitDrawingsChanged();
  }

  private emitDrawingsChanged(): void {
    window.dispatchEvent(new CustomEvent('chart-drawings-changed', {
      detail: { symbol: this.config.symbol, timeframe: this.config.timeframe },
    }));
  }

  private showToast(message: string): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = [
      'position:absolute',
      'right:12px',
      'top:44px',
      'z-index:2200',
      'padding:8px 12px',
      'border-radius:8px',
      'background:rgba(22,30,47,0.95)',
      'border:1px solid #3f5174',
      'color:#e6eefc',
      'font:600 12px Segoe UI, Arial, sans-serif',
      'box-shadow:0 8px 20px rgba(0,0,0,0.35)',
    ].join(';');
    host.appendChild(toast);
    window.setTimeout(() => {
      toast.style.transition = 'opacity 220ms ease';
      toast.style.opacity = '0';
      window.setTimeout(() => toast.remove(), 230);
    }, 1700);
  }

  private showBottomLeftToast(message: string): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    const existing = Array.from(host.querySelectorAll('.chart-bottom-left-toast')) as HTMLDivElement[];
    const toast = document.createElement('div');
    toast.className = 'chart-bottom-left-toast';
    toast.textContent = message;
    const bottom = 12 + existing.length * 44;
    toast.style.cssText = [
      'position:absolute',
      'left:12px',
      `bottom:${bottom}px`,
      'z-index:2250',
      'padding:8px 12px',
      'border-radius:8px',
      'background:rgba(22,30,47,0.95)',
      'border:1px solid #3f5174',
      'color:#e6eefc',
      'font:600 12px Segoe UI, Arial, sans-serif',
      'box-shadow:0 8px 20px rgba(0,0,0,0.35)',
      'opacity:0',
      'transform:translateY(8px)',
      'transition:opacity 180ms ease, transform 180ms ease',
    ].join(';');
    host.appendChild(toast);
    window.requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      window.setTimeout(() => {
        toast.remove();
        const left = Array.from(host.querySelectorAll('.chart-bottom-left-toast')) as HTMLDivElement[];
        left.forEach((el, idx) => {
          el.style.bottom = `${12 + idx * 44}px`;
        });
      }, 220);
    }, 2200);
  }

  private findNearestCandleIndexByTime(candles: CandleData[], targetTime: number): number {
    if (!Number.isFinite(targetTime) || !candles.length) return -1;
    let lo = 0;
    let hi = candles.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const time = Number(candles[mid]?.time);
      if (!Number.isFinite(time)) break;
      if (time === targetTime) return mid;
      if (time < targetTime) lo = mid + 1;
      else hi = mid - 1;
    }
    const left = Math.max(0, Math.min(candles.length - 1, hi));
    const right = Math.max(0, Math.min(candles.length - 1, lo));
    const leftDiff = Math.abs((candles[left]?.time ?? 0) - targetTime);
    const rightDiff = Math.abs((candles[right]?.time ?? 0) - targetTime);
    return rightDiff < leftDiff ? right : left;
  }

  private sliceRenderWindow(data: CandleData[], prevStartTime?: number, prevEndTime?: number): CandleData[] {
    const max = SimpleChart.MAX_RENDER_CANDLES;
    if (data.length <= max) return data;
    const buffer = SimpleChart.RENDER_WINDOW_BUFFER_CANDLES;
    const hasPreviousViewport = Number.isFinite(prevStartTime) && Number.isFinite(prevEndTime);
    if (!hasPreviousViewport) return data.slice(Math.max(0, data.length - max));

    const mappedStart = this.findNearestCandleIndexByTime(data, prevStartTime as number);
    const mappedEnd = this.findNearestCandleIndexByTime(data, prevEndTime as number);
    if (mappedStart < 0 || mappedEnd < 0) return data.slice(Math.max(0, data.length - max));

    const anchorStart = Math.min(mappedStart, mappedEnd);
    const anchorEnd = Math.max(mappedStart, mappedEnd);
    let from = Math.max(0, anchorStart - buffer);
    let to = Math.min(data.length, Math.max(anchorEnd + buffer + 1, from + max));
    if (to - from > max) to = from + max;
    if (to > data.length) {
      to = data.length;
      from = Math.max(0, to - max);
    }
    if (anchorEnd >= to) {
      to = Math.min(data.length, anchorEnd + buffer + 1);
      from = Math.max(0, to - max);
    }
    return data.slice(from, to);
  }

  private showPatternPopup(signal: PatternSignal): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    showPatternPopupUi(host, signal, {
      patternVisible: this.isPatternBoxesVisible(),
      onMoveToPattern: () => {
        this.focusPatternSignalRange(signal);
      },
      onConfirmPatternVisible: () => {
        if (!this.isPatternBoxesVisible()) {
          this.setPatternBoxesVisible(true);
        }
        this.focusPatternSignalRange(signal);
      },
    });
  }

  private clearPatternPopups(): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    clearPatternPopupsUi(host);
  }

  private clearConfirmedPatternBoxes(): void {
    this.confirmedPatternBoxes = [];
  }

  private registerConfirmedPatternBox(signal: PatternSignal): void {
    const range = getPatternSignalRange(signal);
    if (!range) return;
    const id = `${this.config.symbol}:${this.config.timeframe}:${signal.type}:${range.startIndex}:${range.endIndex}`;
    const existing = this.confirmedPatternBoxes.find((box) => box.id === id);
    if (existing) {
      existing.level = signal.level;
      existing.startIndex = range.startIndex;
      existing.endIndex = range.endIndex;
      existing.createdAt = Date.now();
      return;
    }
    this.confirmedPatternBoxes.push({
      id,
      type: signal.type,
      level: signal.level,
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      createdAt: Date.now(),
    });
    if (this.confirmedPatternBoxes.length > 60) {
      this.confirmedPatternBoxes.splice(0, this.confirmedPatternBoxes.length - 60);
    }
  }

  private focusPatternSignalRange(signal: PatternSignal): void {
    const range = getPatternSignalRange(signal);
    if (!range) return;
    this.registerConfirmedPatternBox(signal);
    if (!this.moveViewportToRange(range.startIndex, range.endIndex, 8)) return;
    this.draw();
  }

  private getPriceBoundsInRange(startIndex: number, endIndex: number): { lo: number; hi: number } | null {
    const loIdx = Math.max(0, startIndex);
    const hiIdx = Math.min(this.data.length - 1, endIndex);
    if (hiIdx < loIdx) return null;
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (let i = loIdx; i <= hiIdx; i += 1) {
      const low = this.data[i]?.low;
      const high = this.data[i]?.high;
      if (Number.isFinite(low) && (low as number) < lo) lo = low as number;
      if (Number.isFinite(high) && (high as number) > hi) hi = high as number;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;
    return { lo, hi };
  }

  private drawConfirmedPatternBoxes(meta: NonNullable<typeof this.lastDrawMeta>): void {
    if (!this.patternBoxesVisible) return;
    if (!this.confirmedPatternBoxes.length) return;
    const visibleStart = this.startIndex;
    const visibleEnd = this.endIndex - 1;
    if (visibleEnd < visibleStart) return;
    const ctx = this.ctx;
    const chartTop = 0;
    const chartBottom = meta.mainH;
    const labelMap: Record<ChartPatternType, string> = {
      'double-bottom': '쌍바닥',
      'double-top': '쌍봉',
      'head-and-shoulders': 'H&S',
      'inverse-head-and-shoulders': '역H&S',
      'bullish-engulfing': '상승 장악형',
      'bearish-engulfing': '하락 장악형',
      'bearish-harami': '하락 잉태형',
      'bullish-harami': '상승 잉태형',
      harami: '하라미',
      'dark-cloud-cover': '흑운형',
      'piercing-line': '관통형',
      'three-white-soldiers': '적삼병',
      'three-black-crows': '흑삼병',
      'morning-star': '샛별형',
      'evening-star': '저녁별형',
      'morning-doji-star': '새벽십자별형',
      'evening-doji-star': '저녁십자별형',
      'shooting-star': '유성형',
      'inverted-hammer': '역망치형',
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(meta.chartLeft, chartTop, meta.chartW, chartBottom - chartTop);
    ctx.clip();
    for (const box of this.confirmedPatternBoxes) {
      if (box.endIndex < visibleStart || box.startIndex > visibleEnd) continue;
      const clampedStart = Math.max(box.startIndex, visibleStart);
      const clampedEnd = Math.min(box.endIndex, visibleEnd);
      const bounds = this.getPriceBoundsInRange(box.startIndex, box.endIndex);
      if (!bounds) continue;
      const x1 = meta.chartLeft + (clampedStart - visibleStart) * meta.totalSp + 1;
      const x2 = meta.chartLeft + (clampedEnd - visibleStart + 1) * meta.totalSp - 1;
      const range = bounds.hi - bounds.lo;
      const padding = Math.max(range * 0.04, (meta.maxP - meta.minP) * 0.006);
      const yTop = meta.getY(bounds.hi + padding);
      const yBottom = meta.getY(bounds.lo - padding);
      const left = Math.max(meta.chartLeft + 1, Math.min(x1, x2));
      const right = Math.min(meta.chartRight - 1, Math.max(x1, x2));
      const top = Math.max(chartTop + 2, Math.min(yTop, yBottom));
      const bottom = Math.min(chartBottom - 2, Math.max(yTop, yBottom));
      if (right - left < 4 || bottom - top < 4) continue;

      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 215, 64, 0.95)';
      ctx.fillStyle = 'rgba(255, 215, 64, 0.08)';
      ctx.fillRect(left, top, right - left, bottom - top);
      ctx.strokeRect(left, top, right - left, bottom - top);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 231, 130, 0.95)';
      ctx.font = `600 11px ${CHART_FONT_STACK}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const labelY = Math.max(12, top - 2);
      const levelSuffix = box.level === 'confirmed' ? ' 확정' : box.level === 'warn' ? ' 경계' : box.level === 'watch' ? ' 주시' : '';
      ctx.fillText(`${labelMap[box.type]}${levelSuffix}`, left + 4, labelY);
      ctx.restore();
    }
    ctx.restore();
  }

  private evaluatePatternAlerts(): void {
    if (!this.isPatternAlertEnabled()) return;
    const scope = this.getPatternAnalysisScope();
    const detection = detectPatternCandidates({
      data: this.data,
      timeframe: this.config.timeframe,
      scope,
      visibleStartIndex: this.startIndex,
      endIndex: this.endIndex,
    });
    if (!detection || !detection.candidates.length) return;
    const { lastBar, start, preset } = detection;
    const lastTime = this.data[lastBar]?.time ?? 0;
    const evalSignature = `${this.config.symbol}:${this.config.timeframe}:${scope}:${start}:${lastBar}:${lastTime}`;
    if (this.lastPatternEvalSignature === evalSignature) return;
    this.lastPatternEvalSignature = evalSignature;
    const candidates: PatternSignal[] = [];
    for (const signal of detection.candidates) {
      // Cooldown should be applied per pattern type (not per unique key with bar indices),
      // otherwise candlestick patterns can spam every newly formed bar.
      const tfKey = `${this.config.symbol}:${this.config.timeframe}:${scope}:${signal.type}`;
      const lastHitBar = this.lastPatternAlertByKey.get(tfKey);
      if (typeof lastHitBar === 'number' && signal.barIndex - lastHitBar < preset.cooldownBars) continue;
      this.lastPatternAlertByKey.set(tfKey, signal.barIndex);
      candidates.push(signal);
    }
    const topSignal = pickTopPatternSignal(candidates);
    if (!topSignal) return;
    this.registerConfirmedPatternBox(topSignal);
    this.showPatternPopup(topSignal);
  }

  private playBeep(): void {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    try {
      const ac = new Ctx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ac.destination);
      const now = ac.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
      osc.onended = () => { ac.close().catch(() => undefined); };
    } catch {
      // noop
    }
  }

  private linePriceAt(shape: DrawingShape, index: number): number {
    const a = shape.a;
    const b = shape.b ?? shape.a;
    const dx = b.index - a.index;
    if (Math.abs(dx) < 1e-9) return a.price;
    const t = (index - a.index) / dx;
    return a.price + (b.price - a.price) * t;
  }

  private evaluateTrendlineAlerts(): void {
    if (!this.drawingsVisible) return;
    if (this.endIndex - this.startIndex < 2 || this.data.length < 2) return;
    const lastBar = this.endIndex - 1;
    const prevBar = lastBar - 1;
    const lastClose = this.data[lastBar]?.close;
    const prevClose = this.data[prevBar]?.close;
    if (!Number.isFinite(lastClose) || !Number.isFinite(prevClose)) return;

    for (const shape of this.drawings) {
      if (!this.isTrendlineShape(shape) || !shape.b || !shape.alert?.enabled || shape.hidden) continue;
      let upCross = false;
      let downCross = false;
      if (shape.alert.target === 'price') {
        const level = Number(shape.alert.priceValue ?? shape.a.price);
        upCross = prevClose <= level && lastClose > level;
        downCross = prevClose >= level && lastClose < level;
      } else {
        const prevLine = this.linePriceAt(shape, prevBar);
        const nowLine = this.linePriceAt(shape, lastBar);
        upCross = prevClose <= prevLine && lastClose > nowLine;
        downCross = prevClose >= prevLine && lastClose < nowLine;
      }
      const hit = shape.alert.mode === 'up' ? upCross : downCross;
      if (!hit) continue;
      if (shape.alert.lastTriggerBar === lastBar) continue;
      shape.alert.lastTriggerBar = lastBar;
      if (shape.alert.onsite) {
        this.showToast(`추세선 알림: ${shape.alert.mode === 'up' ? '상승돌파' : '하락돌파'}`);
      }
      if (shape.alert.appPush) {
        window.dispatchEvent(new CustomEvent('chart-trendline-alert', { detail: { id: shape.id, mode: shape.alert.mode, bar: lastBar } }));
      }
      if (shape.alert.sound) {
        this.playBeep();
      }
    }
  }

  private evaluateSubIndicatorAlerts(seriesMap: Record<string, (number | null)[]>): void {
    if (this.endIndex - this.startIndex < 2 || this.data.length < 2) return;
    const lastBar = this.endIndex - 1;
    const prevBar = lastBar - 1;
    for (const alert of this.subIndicatorAlerts) {
      if (!alert.enabled) continue;
      const series = seriesMap[alert.panelId];
      if (!series || !series.length) continue;
      const prev = series[prevBar];
      const curr = series[lastBar];
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
      const prevN = prev as number;
      const currN = curr as number;
      const crossed = (prevN - alert.value) * (currN - alert.value) <= 0 && prevN !== currN;
      const upCross = prevN < alert.value && currN >= alert.value;
      const downCross = prevN > alert.value && currN <= alert.value;
      const hit = alert.mode === 'cross' ? crossed : (alert.mode === 'up' ? upCross : downCross);
      if (!hit) continue;
      if (alert.lastTriggerBar === lastBar) continue;
      alert.lastTriggerBar = lastBar;
      if (alert.onsite) {
        this.showBottomLeftToast(`지표 알림: ${alert.panelId.toUpperCase()} ${alert.value.toFixed(2)} 도달`);
      }
      if (alert.sound) {
        this.playBeep();
      }
      window.dispatchEvent(new CustomEvent('chart-sub-indicator-alert', {
        detail: { id: alert.id, panelId: alert.panelId, value: alert.value, mode: alert.mode, bar: lastBar },
      }));
    }
  }

  private closeSubIndicatorAlertPopup(): void {
    if (this.subIndicatorAlertPopupEl) {
      this.subIndicatorAlertPopupEl.remove();
      this.subIndicatorAlertPopupEl = null;
    }
  }

  public setDrawingMagnetMode(mode: DrawingMagnetMode): void {
    this.drawingMagnetMode = mode;
    this.requestOverlayDraw();
  }

  public getDrawingMagnetMode(): DrawingMagnetMode {
    return this.drawingMagnetMode;
  }

  private closePositionSettingsPopup(): void {
    if (this.positionSettingsPopupEl) {
      this.positionSettingsPopupEl.remove();
      this.positionSettingsPopupEl = null;
    }
  }

  private openPositionSettingsPopup(shape: DrawingShape): void {
    if (shape.kind !== 'long-position' && shape.kind !== 'short-position') return;
    const host = this.canvas.parentElement;
    if (!host) return;
    this.closePositionSettingsPopup();

    const popup = document.createElement('div');
    popup.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:48px',
      'transform:translateX(-50%)',
      'z-index:2400',
      'width:min(364px, calc(100% - 20px))',
      'padding:14px 14px 12px',
      'border-radius:16px',
      'background:#ffffff',
      'border:1px solid #d8deea',
      'box-shadow:0 18px 40px rgba(0,0,0,0.28)',
      `font:500 12px ${CHART_FONT_STACK}`,
      'color:#1f2533',
    ].join(';');
    popup.addEventListener('mousedown', (event) => event.stopPropagation());
    popup.addEventListener('click', (event) => event.stopPropagation());

    const title = document.createElement('div');
    title.textContent = shape.kind === 'long-position' ? '매수 포지션' : '매도 포지션';
    title.style.cssText = 'font:700 18px Pretendard, Segoe UI, Arial, sans-serif; margin-bottom:10px;';

    const entry = shape.a.price;
    const stop = shape.b?.price ?? shape.a.price;
    const target = shape.a.price + (shape.channelOffset?.price ?? 0);
    const symbolUpper = String(this.config.symbol || '').toUpperCase();
    const riskCurrency = (symbolUpper === 'KOSPI' || symbolUpper === 'KOSDAQ' || symbolUpper === 'KOSPI200') ? 'KRW' : 'USD';
    const digits = getSymbolPricePrecision(this.config.symbol, this.config.quoteCurrency);
    const tickSize = Math.max(10 ** -digits, 1e-12);
    const positionCfg = shape.position ?? {
      accountSize: 1000,
      accountUnit: 'default' as const,
      riskMode: 'percent' as const,
      riskPercent: 25,
      riskAmount: 250,
      leverageEnabled: false,
      leverage: 10000,
      quantityPrecision: 2,
    };
    const mkInput = (value: number, step = '0.01') => {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = step;
      input.value = step === '1' ? String(Math.round(value)) : String(value.toFixed(digits));
      input.style.cssText = 'height:34px;width:120px;border:1px solid #cfd6e5;border-radius:9px;padding:0 10px;font:600 12px Segoe UI, Arial, sans-serif;box-sizing:border-box;background:#fff;';
      return input;
    };
    const mkOptionButton = (text: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'position:relative;height:34px;width:120px;border:1px solid #cfd6e5;border-radius:9px;background:#fff;color:#1f2533;cursor:pointer;padding:0 26px 0 10px;font:600 12px Segoe UI, Arial, sans-serif;white-space:nowrap;text-align:center;';
      const txt = document.createElement('span');
      txt.textContent = text;
      txt.style.cssText = 'display:block;width:100%;text-align:center;';
      const arrow = document.createElement('span');
      arrow.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg>';
      arrow.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);display:inline-flex;';
      btn.append(txt, arrow);
      return { btn, txt };
    };

    const accountSizeInput = mkInput(positionCfg.accountSize, '1');
    const riskValueInput = mkInput(positionCfg.riskMode === 'amount' ? positionCfg.riskAmount : positionCfg.riskPercent);
    const leverageInput = mkInput(positionCfg.leverage, '0.1');
    const entryInput = mkInput(entry);
    const targetInput = mkInput(target);
    const stopInput = mkInput(stop);
    const targetTickInput = mkInput(Math.abs(target - entry) / tickSize, '1');
    const stopTickInput = mkInput(Math.abs(entry - stop) / tickSize, '1');
    targetTickInput.min = '0';
    stopTickInput.min = '0';

    let accountUnit: 'default' | 'USD' | 'KRW' = positionCfg.accountUnit ?? 'default';
    let riskMode: 'percent' | 'amount' = positionCfg.riskMode ?? 'percent';
    const accountUnitOpt = mkOptionButton(accountUnit === 'default' ? '기본설정' : accountUnit);
    const riskModeOpt = mkOptionButton(riskMode === 'percent' ? '%' : riskCurrency);
    const syncAccountUnitText = () => { accountUnitOpt.txt.textContent = accountUnit === 'default' ? '기본설정' : accountUnit; };
    const syncRiskModeText = () => { riskModeOpt.txt.textContent = riskMode === 'percent' ? '%' : riskCurrency; };
    accountUnitOpt.btn.addEventListener('click', () => {
      accountUnit = accountUnit === 'default' ? 'USD' : accountUnit === 'USD' ? 'KRW' : 'default';
      syncAccountUnitText();
    });
    riskModeOpt.btn.addEventListener('click', () => {
      const prev = riskMode;
      riskMode = riskMode === 'percent' ? 'amount' : 'percent';
      const currentVal = Math.max(0, Number(riskValueInput.value) || 0);
      const accountSize = Math.max(0, Number(accountSizeInput.value) || 0);
      if (prev === 'percent' && riskMode === 'amount') riskValueInput.value = (accountSize * (currentVal / 100)).toFixed(2);
      if (prev === 'amount' && riskMode === 'percent') riskValueInput.value = accountSize > 0 ? ((currentVal / accountSize) * 100).toFixed(2) : '0';
      syncRiskModeText();
      syncInfo();
    });

    const leverageEnabledInput = document.createElement('input');
    leverageEnabledInput.type = 'checkbox';
    leverageEnabledInput.checked = Boolean(positionCfg.leverageEnabled);
    leverageEnabledInput.style.cssText = 'width:18px;height:18px;';
    const leverageUseLabel = document.createElement('label');
    leverageUseLabel.style.cssText = 'display:flex;align-items:center;gap:6px;color:#3a4459;font-size:12px;';
    const leverageUseText = document.createElement('span');
    leverageUseText.textContent = '사용';
    leverageUseLabel.append(leverageEnabledInput, leverageUseText);
    const syncLeverageState = () => {
      leverageInput.disabled = !leverageEnabledInput.checked;
      leverageInput.style.opacity = leverageEnabledInput.checked ? '1' : '0.55';
      syncInfo();
    };
    leverageEnabledInput.addEventListener('change', syncLeverageState);

    let syncingTickAndPrice = false;
    const applyPricesFromTicks = () => {
      const ePrice = Number(entryInput.value);
      if (!Number.isFinite(ePrice)) return;
      const isLongPosition = shape.kind === 'long-position';
      const sTicks = Math.max(0, Number(stopTickInput.value) || 0);
      const tTicks = Math.max(0, Number(targetTickInput.value) || 0);
      const stopPrice = isLongPosition ? (ePrice - sTicks * tickSize) : (ePrice + sTicks * tickSize);
      const targetPrice = isLongPosition ? (ePrice + tTicks * tickSize) : (ePrice - tTicks * tickSize);
      stopInput.value = stopPrice.toFixed(digits);
      targetInput.value = targetPrice.toFixed(digits);
    };
    const syncTicksFromPrices = () => {
      const ePrice = Number(entryInput.value);
      const sPrice = Number(stopInput.value);
      const tPrice = Number(targetInput.value);
      const sTicks = Number.isFinite(ePrice) && Number.isFinite(sPrice) ? Math.max(0, Math.round(Math.abs(ePrice - sPrice) / tickSize)) : 0;
      const tTicks = Number.isFinite(ePrice) && Number.isFinite(tPrice) ? Math.max(0, Math.round(Math.abs(tPrice - ePrice) / tickSize)) : 0;
      stopTickInput.value = String(sTicks);
      targetTickInput.value = String(tTicks);
    };

    const infoBox = document.createElement('div');
    infoBox.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin:4px 0 10px;padding:8px 10px;border:1px solid #d7e0f2;border-radius:9px;background:#f8fbff;';
    const rrTextEl = document.createElement('div');
    rrTextEl.style.cssText = 'font:600 12px Segoe UI, Arial, sans-serif;color:#1f2f46;';
    const pnlTextEl = document.createElement('div');
    pnlTextEl.style.cssText = 'font:600 12px Segoe UI, Arial, sans-serif;color:#1f2f46;';
    infoBox.append(rrTextEl, pnlTextEl);
    const syncInfo = () => {
      const ePrice = Number(entryInput.value);
      const sPrice = Number(stopInput.value);
      const tPrice = Number(targetInput.value);
      const risk = Math.abs(ePrice - sPrice);
      const reward = Math.abs(tPrice - ePrice);
      const rr = risk > 1e-8 ? reward / risk : 0;
      const accountSize = Math.max(0, Number(accountSizeInput.value) || 0);
      const rv = Math.max(0, Number(riskValueInput.value) || 0);
      const riskBudget = riskMode === 'amount' ? rv : accountSize * (rv / 100);
      const leverageFactor = leverageEnabledInput.checked ? Math.max(0.1, Number(leverageInput.value) || 1) : 1;
      const qty = risk > 1e-8 ? (riskBudget / risk) * leverageFactor : 0;
      const closePnl = qty * reward;
      rrTextEl.textContent = `손익비: ${rr === 1 ? '1 : 1' : `1 : ${rr.toFixed(1)}`}`;
      pnlTextEl.textContent = `청산손익: +${Math.round(closePnl).toLocaleString('ko-KR')} ${riskCurrency}`;
    };

    const mkRow = (label: string, right: HTMLElement) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';
      const lab = document.createElement('span');
      lab.textContent = label;
      lab.style.cssText = 'color:#3a4459;font-size:12px;';
      row.append(lab, right);
      return row;
    };
    const mkDualRow = (label: string, leftEl: HTMLElement, rightEl: HTMLElement) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';
      const lab = document.createElement('span');
      lab.textContent = label;
      lab.style.cssText = 'color:#3a4459;font-size:12px;';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
      wrap.append(leftEl, rightEl);
      row.append(lab, wrap);
      return row;
    };

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:10px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '취소';
    cancelBtn.style.cssText = 'height:34px;padding:0 12px;border-radius:8px;border:1px solid #aab4c8;background:#fff;color:#243146;cursor:pointer;';
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = '확인';
    applyBtn.style.cssText = 'height:34px;padding:0 12px;border-radius:8px;border:1px solid #101828;background:#111827;color:#fff;cursor:pointer;';
    btnRow.append(cancelBtn, applyBtn);

    cancelBtn.addEventListener('click', () => this.closePositionSettingsPopup());
    applyBtn.addEventListener('click', () => {
      const nextEntry = Number(entryInput.value);
      const nextTarget = Number(targetInput.value);
      const nextStop = Number(stopInput.value);
      if (!Number.isFinite(nextEntry) || !Number.isFinite(nextTarget) || !Number.isFinite(nextStop)) {
        this.showToast('유효한 가격 값을 입력하세요.');
        return;
      }
      const next = this.cloneShape(shape);
      next.a = { index: shape.a.index, price: nextEntry };
      next.b = { index: shape.a.index, price: nextStop };
      next.channelOffset = {
        index: shape.channelOffset?.index ?? 8,
        price: nextTarget - nextEntry,
      };
      const nextAccountSize = Math.max(0, Number(accountSizeInput.value) || 0);
      const nextRiskVal = Math.max(0, Number(riskValueInput.value) || 0);
      next.position = {
        accountSize: nextAccountSize,
        accountUnit,
        riskMode,
        riskPercent: riskMode === 'percent'
          ? nextRiskVal
          : (nextAccountSize > 0 ? (nextRiskVal / nextAccountSize) * 100 : 0),
        riskAmount: riskMode === 'amount'
          ? nextRiskVal
          : nextAccountSize * (nextRiskVal / 100),
        leverageEnabled: Boolean(leverageEnabledInput.checked),
        leverage: Math.max(0.1, Number(leverageInput.value) || 1),
        quantityPrecision: positionCfg.quantityPrecision ?? 2,
      };
      this.upsertDrawing(next);
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      this.closePositionSettingsPopup();
    });

    [entryInput, targetInput, stopInput].forEach((el) => el.addEventListener('input', () => {
      if (syncingTickAndPrice) return;
      syncingTickAndPrice = true;
      syncTicksFromPrices();
      syncingTickAndPrice = false;
      syncInfo();
    }));
    [targetTickInput, stopTickInput].forEach((el) => el.addEventListener('input', () => {
      if (syncingTickAndPrice) return;
      syncingTickAndPrice = true;
      applyPricesFromTicks();
      syncingTickAndPrice = false;
      syncInfo();
    }));
    entryInput.addEventListener('input', () => {
      if (syncingTickAndPrice) return;
      syncingTickAndPrice = true;
      applyPricesFromTicks();
      syncingTickAndPrice = false;
      syncInfo();
    });
    [accountSizeInput, riskValueInput, leverageInput].forEach((el) => el.addEventListener('input', () => syncInfo()));
    syncAccountUnitText();
    syncRiskModeText();
    syncLeverageState();
    syncTicksFromPrices();
    syncInfo();

    popup.append(
      title,
      mkDualRow('계좌 규모', accountSizeInput, accountUnitOpt.btn),
      mkDualRow('리스크', riskValueInput, riskModeOpt.btn),
      mkDualRow('레버리지', leverageInput, leverageUseLabel),
      infoBox,
      mkRow('진입가', entryInput),
      mkRow('목표가', targetInput),
      mkRow('틱', targetTickInput),
      mkRow('손절가', stopInput),
      mkRow('틱', stopTickInput),
      btnRow,
    );
    host.appendChild(popup);
    this.positionSettingsPopupEl = popup;
  }

  private openSubIndicatorAlertPopup(
    x: number,
    y: number,
    draft: { panelId: string; value: number; color: string },
  ): void {
    this.closeSubIndicatorAlertPopup();
    const host = this.canvas.parentElement;
    if (!host) return;
    const placePopupInHost = (el: HTMLDivElement, preferredLeft: number, preferredTop: number) => {
      const hostW = host.clientWidth;
      const hostH = host.clientHeight;
      const popupW = el.offsetWidth || 240;
      const popupH = el.offsetHeight || 180;
      const margin = 8;
      const left = Math.max(margin, Math.min(preferredLeft, hostW - popupW - margin));
      const top = Math.max(margin, Math.min(preferredTop, hostH - popupH - margin));
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
    };
    const popup = document.createElement('div');
    popup.style.cssText = [
      'position:absolute',
      'left:8px',
      'top:8px',
      'z-index:2300',
      'min-width:220px',
      'padding:10px',
      'border-radius:10px',
      'background:rgba(20,28,44,0.98)',
      'border:1px solid #435578',
      'color:#eaf0ff',
      `font:600 12px ${CHART_FONT_STACK}`,
      'box-shadow:0 12px 24px rgba(0,0,0,0.38)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '지표 알림 생성';
    title.style.cssText = 'font-size:13px;margin-bottom:8px;';
    popup.appendChild(title);

    const info = document.createElement('div');
    info.textContent = `${draft.panelId.toUpperCase()} · ${draft.value.toFixed(2)}`;
    info.style.cssText = 'font-size:12px;color:#a9b8d6;margin-bottom:8px;';
    popup.appendChild(info);

    const modeRow = document.createElement('label');
    modeRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;';
    modeRow.innerHTML = '<span style="font-size:11px;color:#9fb1d3;">조건</span>';
    const modeSel = document.createElement('select');
    modeSel.style.cssText = 'background:#121a2b;border:1px solid #364867;color:#eaf0ff;border-radius:6px;padding:6px;font-size:12px;';
    modeSel.innerHTML = '<option value="cross">라인 도달</option><option value="up">상향 돌파</option><option value="down">하향 돌파</option>';
    modeRow.appendChild(modeSel);
    popup.appendChild(modeRow);

    const checks = document.createElement('div');
    checks.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;';
    const mkCheck = (label: string, checked = true) => {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      wrap.appendChild(input);
      const text = document.createElement('span');
      text.textContent = label;
      text.style.cssText = 'font-size:11px;color:#c5d3ee;';
      wrap.appendChild(text);
      return { wrap, input };
    };
    const onsite = mkCheck('온사이트', true);
    const sound = mkCheck('소리', true);
    checks.appendChild(onsite.wrap);
    checks.appendChild(sound.wrap);
    popup.appendChild(checks);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '취소';
    cancelBtn.style.cssText = 'padding:6px 10px;border-radius:6px;border:1px solid #3f4f6f;background:#1a2336;color:#b7c7e6;cursor:pointer;font-size:12px;';
    const addBtn = document.createElement('button');
    addBtn.textContent = '등록';
    addBtn.style.cssText = `padding:6px 10px;border-radius:6px;border:1px solid ${toRgba(draft.color, 0.85, '#5b9aff')};background:${toRgba(draft.color, 0.26, 'rgba(41,98,255,0.26)')};color:#ffffff;cursor:pointer;font-size:12px;`;
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(addBtn);
    popup.appendChild(btnRow);

    cancelBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.closeSubIndicatorAlertPopup();
    });
    addBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const duplicate = this.subIndicatorAlerts.some((a) => a.panelId === draft.panelId && Math.abs(a.value - draft.value) < 1e-6);
      if (duplicate) {
        this.showBottomLeftToast('이미 동일한 지표 알림이 등록되어 있습니다.');
        this.closeSubIndicatorAlertPopup();
        return;
      }
      this.subIndicatorAlerts.push({
        id: `sub-alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        panelId: draft.panelId,
        value: draft.value,
        color: draft.color,
        enabled: true,
        mode: (modeSel.value as 'cross' | 'up' | 'down') ?? 'cross',
        onsite: onsite.input.checked,
        sound: sound.input.checked,
      });
      this.showBottomLeftToast(`지표 알림 등록: ${draft.panelId.toUpperCase()} ${draft.value.toFixed(2)}`);
      this.closeSubIndicatorAlertPopup();
      this.draw();
    });

    popup.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    popup.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    host.appendChild(popup);
    placePopupInHost(popup, Math.round(x - 110), Math.round(y - 120));
    this.subIndicatorAlertPopupEl = popup;
  }

  private findSubIndicatorAlertHit(mx: number, my: number): (typeof this.subIndicatorAlertHitAreas)[number] | null {
    let best: (typeof this.subIndicatorAlertHitAreas)[number] | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const area of this.subIndicatorAlertHitAreas) {
      if (mx < area.x1 || mx > area.x2) continue;
      if (my < area.panelTop || my > area.panelTop + area.panelHeight) continue;
      const dist = Math.abs(my - area.y);
      if (dist > 6) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = area;
      }
    }
    return best;
  }

  private openSubIndicatorAlertEditPopup(
    alert: {
      id: string;
      panelId: string;
      value: number;
      color: string;
      enabled: boolean;
      mode: 'cross' | 'up' | 'down';
      onsite: boolean;
      sound: boolean;
    },
    area: { panelTop: number; panelHeight: number },
  ): void {
    this.closeSubIndicatorAlertPopup();
    const host = this.canvas.parentElement;
    if (!host) return;
    const width = this.viewportWidth;
    const right = this.config.layout.rightPadding;
    const chartW = width - right;
    const popupW = 252;
    const popup = document.createElement('div');
    popup.style.cssText = [
      'position:absolute',
      `left:${Math.max(8, Math.round(chartW / 2 - popupW / 2))}px`,
      `top:${Math.max(6, Math.round(area.panelTop + 6))}px`,
      `width:${popupW}px`,
      'z-index:2300',
      'padding:10px',
      'border-radius:10px',
      'background:rgba(20,28,44,0.98)',
      'border:1px solid #435578',
      'color:#eaf0ff',
      `font:600 12px ${CHART_FONT_STACK}`,
      'box-shadow:0 12px 24px rgba(0,0,0,0.38)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '지표 알림 편집';
    title.style.cssText = 'font-size:13px;margin-bottom:8px;';
    popup.appendChild(title);

    const info = document.createElement('div');
    info.textContent = `${alert.panelId.toUpperCase()} · ${alert.value.toFixed(2)}`;
    info.style.cssText = 'font-size:12px;color:#a9b8d6;margin-bottom:8px;';
    popup.appendChild(info);

    const modeRow = document.createElement('label');
    modeRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;';
    modeRow.innerHTML = '<span style="font-size:11px;color:#9fb1d3;">조건</span>';
    const modeSel = document.createElement('select');
    modeSel.style.cssText = 'background:#121a2b;border:1px solid #364867;color:#eaf0ff;border-radius:6px;padding:6px;font-size:12px;';
    modeSel.innerHTML = '<option value="cross">라인 도달</option><option value="up">상향 돌파</option><option value="down">하향 돌파</option>';
    modeSel.value = alert.mode;
    modeRow.appendChild(modeSel);
    popup.appendChild(modeRow);

    const checks = document.createElement('div');
    checks.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;';
    const mkCheck = (label: string, checked: boolean) => {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      wrap.appendChild(input);
      const text = document.createElement('span');
      text.textContent = label;
      text.style.cssText = 'font-size:11px;color:#c5d3ee;';
      wrap.appendChild(text);
      return { wrap, input };
    };
    const enabled = mkCheck('활성화', alert.enabled);
    const onsite = mkCheck('온사이트', alert.onsite);
    const sound = mkCheck('소리', alert.sound);
    checks.appendChild(enabled.wrap);
    checks.appendChild(onsite.wrap);
    checks.appendChild(sound.wrap);
    popup.appendChild(checks);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = 'padding:6px 10px;border-radius:6px;border:1px solid #3f4f6f;background:#1a2336;color:#b7c7e6;cursor:pointer;font-size:12px;';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '적용';
    saveBtn.style.cssText = `padding:6px 10px;border-radius:6px;border:1px solid ${toRgba(alert.color, 0.85, '#5b9aff')};background:${toRgba(alert.color, 0.26, 'rgba(41,98,255,0.26)')};color:#ffffff;cursor:pointer;font-size:12px;`;
    const delBtn = document.createElement('button');
    delBtn.textContent = '삭제';
    delBtn.style.cssText = 'padding:6px 10px;border-radius:6px;border:1px solid #7c3a46;background:rgba(160,48,70,0.28);color:#ffdce2;cursor:pointer;font-size:12px;';
    btnRow.appendChild(delBtn);
    btnRow.appendChild(closeBtn);
    btnRow.appendChild(saveBtn);
    popup.appendChild(btnRow);

    closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.closeSubIndicatorAlertPopup();
    });
    saveBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const target = this.subIndicatorAlerts.find((a) => a.id === alert.id);
      if (target) {
        target.mode = modeSel.value as 'cross' | 'up' | 'down';
        target.enabled = enabled.input.checked;
        target.onsite = onsite.input.checked;
        target.sound = sound.input.checked;
      }
      this.closeSubIndicatorAlertPopup();
      this.draw();
    });
    delBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.subIndicatorAlerts = this.subIndicatorAlerts.filter((a) => a.id !== alert.id);
      this.showBottomLeftToast('지표 알림이 삭제되었습니다.');
      this.closeSubIndicatorAlertPopup();
      this.draw();
    });

    popup.addEventListener('mousedown', (event) => event.stopPropagation());
    popup.addEventListener('click', (event) => event.stopPropagation());

    host.appendChild(popup);
    this.subIndicatorAlertPopupEl = popup;
  }

  public getStrategySignalSeries(): StrategySignal[] {
    return this.strategySignals;
  }

  public getCompositeDataUrl(): string {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const offCtx = off.getContext('2d')!;
    offCtx.drawImage(this.canvas, 0, 0);
    offCtx.drawImage(this.signalCanvas, 0, 0);
    offCtx.drawImage(this.overlayCanvas, 0, 0);
    return off.toDataURL('image/png');
  }

  public isStrategySignalVisible(): boolean {
    return this.strategySignalVisible;
  }

  public setStrategySignalVisible(visible: boolean): void {
    if (this.strategySignalVisible === visible) return;
    this.strategySignalVisible = visible;
    this.clearSignalLayer();
    this.requestSignalLayerDraw();
    this.updateSignalAnimationLoop();
  }

  public isStrategyRiskLinesVisible(): boolean {
    return this.strategyRiskLinesVisible;
  }

  public setStrategyRiskLinesVisible(visible: boolean): void {
    this.strategyRiskLinesVisible = Boolean(visible);
    try {
      localStorage.setItem(STRATEGY_RISK_LINES_VISIBLE_STORAGE_KEY, this.strategyRiskLinesVisible ? '1' : '0');
    } catch {
      // Ignore storage failures and keep runtime state.
    }
    this.requestSignalLayerDraw();
    this.updateSignalAnimationLoop();
  }

  private requestSignalLayerDraw(): void {
    if (this.signalLayerDrawFrame) return;
    this.signalLayerDrawFrame = window.requestAnimationFrame(() => {
      this.signalLayerDrawFrame = 0;
      this.drawSignalLayer(this.lastDrawMeta);
    });
  }

  private clearSignalLayer(): void {
    if (this.signalLayerDrawFrame) {
      window.cancelAnimationFrame(this.signalLayerDrawFrame);
      this.signalLayerDrawFrame = 0;
    }
    this.signalCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.signalHitAreas = [];
    this.hoveredSignalCandleIndex = null;
  }

  private computeLatestSignalIndex(signals: StrategySignal[]): number {
    for (let i = signals.length - 1; i >= 0; i -= 1) {
      if ((signals[i] ?? 0) !== 0) return i;
    }
    return -1;
  }

  private updateSignalAnimationLoop(): void {
    const latestIsVisible = this.latestStrategySignalIndex >= this.startIndex && this.latestStrategySignalIndex < this.endIndex;
    const shouldAnimate = this.strategySignalVisible
      && latestIsVisible
      && this.focusedTradeRange == null;
    if (shouldAnimate) {
      if (!this.signalAnimationActive) {
        this.signalAnimationActive = true;
        this.lastSignalDrawTimeMs = 0;
        const raf = window.requestAnimationFrame(this.handleSignalAnimationTick);
        this.signalAnimationFrame = raf;
      }
      return;
    }
    if (this.signalAnimationActive) {
      this.signalAnimationActive = false;
      if (this.signalAnimationFrame) {
        window.cancelAnimationFrame(this.signalAnimationFrame);
      }
      this.signalAnimationFrame = 0;
    }
  }

  private handleSignalAnimationTick = (timeMs: number) => {
    if (!this.signalAnimationActive) return;
    // Throttle to ~30fps to avoid starving crosshair interaction on desktop.
    if (timeMs - this.lastSignalDrawTimeMs >= 33) {
      this.lastSignalDrawTimeMs = timeMs;
      this.drawSignalLayer(this.lastDrawMeta, timeMs);
    }
    this.signalAnimationFrame = window.requestAnimationFrame(this.handleSignalAnimationTick);
  };

  private normalizeDoubleBreakConfig(config: Partial<DoubleBreakConfig>): DoubleBreakConfig {
    const next = { ...DOUBLE_BREAK_DEFAULT_CONFIG, ...config };
    next.bbPeriod = Math.max(1, Math.round(next.bbPeriod));
    next.bbStd = Math.max(0.1, next.bbStd);
    next.envPeriod = Math.max(1, Math.round(next.envPeriod));
    next.envPct = Math.max(0.1, next.envPct);
    next.atrPeriod = Math.max(1, Math.round(next.atrPeriod));
    next.tp1Multi = Math.max(0.05, next.tp1Multi);
    next.tp2Multi = Math.max(next.tp1Multi + 0.05, next.tp2Multi);
    next.slMulti = Math.max(0.05, next.slMulti);
    next.crossTol = Math.max(0.0001, next.crossTol);
    next.minBarGap = Math.max(0, Math.round(next.minBarGap));
    next.useAdxFilter = Boolean(next.useAdxFilter);
    next.adxPeriod = Math.max(1, Math.round(next.adxPeriod));
    next.adxMin = Math.max(1, next.adxMin);
    next.sameBarMode = next.sameBarMode === 'optimistic' || next.sameBarMode === 'candle'
      ? next.sameBarMode
      : 'conservative';
    next.runnerExitMode = next.runnerExitMode === 'opposite' ? 'opposite' : 'tp2';
    return next;
  }

  private getStrategySymbolParamSuffix(symbol = this.config.symbol): string {
    return encodeURIComponent(String(symbol || 'DEFAULT').trim().toUpperCase() || 'DEFAULT');
  }

  private getDoubleBreakConfigParamKey(symbol = this.config.symbol): string {
    return `${DOUBLE_BREAK_PARAM_SYMBOL_PREFIX}${this.getStrategySymbolParamSuffix(symbol)}`;
  }

  private invalidateDoubleBreakResultCache(): void {
    this.doubleBreakResultCacheKey = '';
    this.doubleBreakResultCache = null;
  }

  private buildDoubleBreakResultCacheKey(): string {
    const len = this.data.length;
    const first = len > 0 ? this.data[0] : null;
    const last = len > 0 ? this.data[len - 1] : null;
    return [
      this.config.symbol,
      len,
      first?.time ?? 0,
      first?.open ?? 0,
      first?.high ?? 0,
      first?.low ?? 0,
      first?.close ?? 0,
      last?.time ?? 0,
      last?.open ?? 0,
      last?.high ?? 0,
      last?.low ?? 0,
      last?.close ?? 0,
      JSON.stringify(this.doubleBreakConfig),
    ].join('|');
  }

  private readDoubleBreakConfigFromParams(symbol = this.config.symbol): DoubleBreakConfig {
    const params = this.getStrategyParams(DOUBLE_BREAK_STRATEGY_ID);
    const parseConfig = (raw: StrategyParamValue | undefined): Partial<DoubleBreakConfig> => {
      if (typeof raw !== 'string' || !raw.trim()) return {};
      try {
        const parsed = JSON.parse(raw) as Partial<DoubleBreakConfig>;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    };
    return this.normalizeDoubleBreakConfig({
      ...DOUBLE_BREAK_DEFAULT_CONFIG,
      ...parseConfig(params[DOUBLE_BREAK_PARAM_DEFAULT_KEY]),
      ...parseConfig(params[this.getDoubleBreakConfigParamKey(symbol)]),
    });
  }

  private syncDoubleBreakConfigFromParams(force = false): void {
    const symbolKey = this.getStrategySymbolParamSuffix(this.config.symbol);
    if (!force && this.doubleBreakConfigSymbolKey === symbolKey) return;
    this.doubleBreakConfig = this.readDoubleBreakConfigFromParams(this.config.symbol);
    this.doubleBreakConfigSymbolKey = symbolKey;
  }

  public getDoubleBreakConfig(): DoubleBreakConfig {
    this.syncDoubleBreakConfigFromParams();
    return { ...this.doubleBreakConfig };
  }

  public setDoubleBreakConfig(patch: Partial<DoubleBreakConfig>): void {
    this.syncDoubleBreakConfigFromParams();
    const next = this.normalizeDoubleBreakConfig({ ...this.doubleBreakConfig, ...patch });
    this.doubleBreakConfig = next;
    this.doubleBreakConfigSymbolKey = this.getStrategySymbolParamSuffix(this.config.symbol);
    this.invalidateDoubleBreakResultCache();
    this.setStrategyParams(DOUBLE_BREAK_STRATEGY_ID, {
      [DOUBLE_BREAK_PARAM_DEFAULT_KEY]: JSON.stringify(next),
      [this.getDoubleBreakConfigParamKey(this.config.symbol)]: JSON.stringify(next),
    }, { skipRefresh: true });
    this.requestStrategyCompute(0);
    this.draw();
  }

  public getBollingerRiskConfig(): BollingerRiskConfig {
    return { ...this.bollingerRiskConfig };
  }

  public getStrategyParams(strategyId: string | null = this.activeStrategyId): Record<string, StrategyParamValue> {
    if (!strategyId) return {};
    const strategy = this.strategies.find((item) => item.id === strategyId);
    return { ...(strategy?.params ?? {}) };
  }

  public setStrategyParams(
    strategyId: string,
    patch: Record<string, StrategyParamValue>,
    options: { skipRefresh?: boolean } = {},
  ): void {
    let changed = false;
    this.strategies = this.strategies.map((strategy) => {
      if (strategy.id !== strategyId) return strategy;
      changed = true;
      return {
        ...strategy,
        params: { ...(strategy.params ?? {}), ...patch },
        updatedAt: Date.now(),
      };
    });
    if (!changed) return;
    saveStrategies(this.strategies);
    if (strategyId === DOUBLE_BREAK_STRATEGY_ID) this.invalidateDoubleBreakResultCache();
    if (!options.skipRefresh && strategyId === this.activeStrategyId) this.requestStrategyCompute(0);
    if (!options.skipRefresh) this.draw();
  }

  public setBollingerRiskConfig(patch: Partial<BollingerRiskConfig>): void {
    const next = { ...this.bollingerRiskConfig, ...patch };
    next.enabled = Boolean(next.enabled);
    next.atrPeriod = Math.max(1, Math.round(next.atrPeriod));
    next.slAtrMult = Math.max(0.05, next.slAtrMult);
    next.tp1AtrMult = Math.max(0.05, next.tp1AtrMult);
    next.tp2AtrMult = Math.max(next.tp1AtrMult + 0.05, next.tp2AtrMult);
    next.tp1Portion = Math.max(0.05, Math.min(0.95, next.tp1Portion));
    next.maxHoldBars = Math.max(1, Math.round(next.maxHoldBars));
    this.bollingerRiskConfig = next;
    this.draw();
  }

  private deleteDrawing(id: string): void {
    this.drawings = deleteDrawingById(this.drawings, id);
    if (this.selectedDrawingId === id) {
      this.closePositionSettingsPopup();
      this.selectedDrawingId = null;
      this.selectedDrawingPart = 'line';
      this.drawingMoveState = null;
    }
    this.syncDrawingToolbar();
    this.draw();
    this.emitDrawingsChanged();
  }

  public setStrategies(strategies: StrategyDefinition[]): void {
    this.strategies = [...strategies];
    saveStrategies(this.strategies);
    if (this.activeStrategyId && !this.strategies.find((s) => s.id === this.activeStrategyId)) {
      this.activeStrategyId = null;
    }
    this.requestStrategyCompute(0);
  }

  public setActiveStrategy(strategyId: string | null): void {
    this.activeStrategyId = strategyId;
    this.invalidateDoubleBreakResultCache();
    if (strategyId === DOUBLE_BREAK_STRATEGY_ID) {
      this.syncDoubleBreakConfigFromParams(true);
      this.requestStrategyCompute(0);
      this.draw();
      return;
    }
    if (strategyId === 'strategy_pine_bbands_directed') {
      this.setBollingerRiskConfig({});
    }
    this.requestStrategyCompute(0);
  }

  private getActiveStrategy(): StrategyDefinition | null {
    return this.strategies.find((s) => s.id === this.activeStrategyId && s.active) ?? null;
  }

  private initStrategyWorker(): void {
    const workerSource = `
      const toSignal = (raw) => {
        if (typeof raw === 'number') return raw > 0 ? 1 : raw < 0 ? -1 : 0;
        if (typeof raw === 'boolean') return raw ? 1 : 0;
        if (raw && typeof raw === 'object') {
          if (raw.buy) return 1;
          if (raw.sell) return -1;
        }
        return 0;
      };
      const buildTa = () => ({
        sma(series, period, index) {
          if (period <= 0 || index < period - 1) return null;
          let sum = 0;
          for (let i = index - period + 1; i <= index; i += 1) sum += series[i];
          return sum / period;
        },
        crossover(a, b, index) {
          if (index <= 0) return false;
          return a[index - 1] <= b[index - 1] && a[index] > b[index];
        },
        crossunder(a, b, index) {
          if (index <= 0) return false;
          return a[index - 1] >= b[index - 1] && a[index] < b[index];
        }
      });
      self.onmessage = (event) => {
        const payload = event.data;
        if (payload.type !== 'compute') return;
        try {
          const strategyFn = new Function('return (' + payload.compiledJs + ');')();
          const candles = payload.candles;
          const close = candles.map((c) => c.close);
          const open = candles.map((c) => c.open);
          const high = candles.map((c) => c.high);
          const low = candles.map((c) => c.low);
          const volume = candles.map((c) => c.volume);
          const ta = buildTa();
          const ctx = {
            open,
            high,
            low,
            close,
            volume,
            __doubleBreakConfig: payload.doubleBreakConfig,
            __strategyParams: payload.strategyParams || {},
            __symbol: payload.symbol || '',
          };
          const previous = payload.previousSignals ?? [];
          let signals;
          if (previous.length === candles.length) {
            signals = [...previous];
          } else if (previous.length < candles.length) {
            signals = [...previous, ...new Array(candles.length - previous.length).fill(0)];
          } else {
            signals = previous.slice(0, candles.length);
          }
          // changedFrom을 유효 범위로 클램프한 뒤 룩백 버퍼 적용
          const LOOKBACK = 300;
          const effectiveChange = Math.min(payload.changedFrom, candles.length - 1);
          const from = Math.max(0, effectiveChange - LOOKBACK);
          for (let i = from; i < candles.length; i += 1) {
            signals[i] = toSignal(strategyFn(ctx, i, ta));
          }
          self.postMessage({ type: 'result', requestId: payload.requestId, signals });
        } catch (error) {
          self.postMessage({
            type: 'result',
            requestId: payload.requestId,
            signals: payload.previousSignals ?? [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };
    `;
    const blob = new Blob([workerSource], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.strategyWorkerUrl = workerUrl;
    this.strategyWorker = new Worker(workerUrl);
    this.strategyWorker.addEventListener('message', (event: MessageEvent<{
      type: 'result';
      requestId: number;
      signals: StrategySignal[];
      error?: string;
    }>) => {
      const message = event.data;
      if (message.type !== 'result') return;
      if (message.requestId < this.pendingStrategyRequestId) return;
      this.pendingStrategyRequestId = message.requestId;
      this.strategySignals = message.signals;
      this.latestStrategySignalIndex = this.computeLatestSignalIndex(this.strategySignals);
      this.drawSignalLayer(this.lastDrawMeta);
      this.updateSignalAnimationLoop();
      this.onStrategyComputed?.();
    });
  }

  public resetStrategyWorker(): void {
    this.cancelScheduledStrategyCompute();
    if (this.strategyWorker) {
      this.strategyWorker.terminate();
      this.strategyWorker = null;
    }
    if (this.strategyWorkerUrl) {
      URL.revokeObjectURL(this.strategyWorkerUrl);
      this.strategyWorkerUrl = null;
    }
    this.strategyRequestId += 1;
    this.pendingStrategyRequestId = this.strategyRequestId;
    this.strategySignals = [];
    this.signalHitAreas = [];
    this.latestStrategySignalIndex = -1;
    this.updateSignalAnimationLoop();
    this.initStrategyWorker();
  }

  private cancelScheduledStrategyCompute(): void {
    if (this.strategyComputeTimer != null) {
      window.clearTimeout(this.strategyComputeTimer);
      this.strategyComputeTimer = null;
    }
    this.pendingStrategyChangedFrom = null;
  }

  private scheduleStrategyCompute(changedFrom: number, delayMs: number): void {
    const normalizedChangedFrom = Math.max(0, Math.floor(Number(changedFrom) || 0));
    if (!this.getActiveStrategy() || !this.data.length || delayMs <= 0) {
      this.cancelScheduledStrategyCompute();
      this.requestStrategyCompute(normalizedChangedFrom);
      return;
    }
    this.pendingStrategyChangedFrom = this.pendingStrategyChangedFrom == null
      ? normalizedChangedFrom
      : Math.min(this.pendingStrategyChangedFrom, normalizedChangedFrom);
    if (this.strategyComputeTimer != null) window.clearTimeout(this.strategyComputeTimer);
    this.strategyComputeTimer = window.setTimeout(() => {
      const nextChangedFrom = this.pendingStrategyChangedFrom ?? normalizedChangedFrom;
      this.strategyComputeTimer = null;
      this.pendingStrategyChangedFrom = null;
      this.requestStrategyCompute(nextChangedFrom);
    }, Math.max(0, Math.floor(delayMs)));
  }

  private requestStrategyCompute(changedFrom: number): void {
    if (!this.strategyWorker) return;
    const strategy = this.getActiveStrategy();
    if (!strategy || !this.data.length) {
      this.strategySignals = [];
      this.signalHitAreas = [];
      this.latestStrategySignalIndex = -1;
      this.drawSignalLayer(this.lastDrawMeta);
      this.updateSignalAnimationLoop();
      return;
    }
    if (strategy.id === DOUBLE_BREAK_STRATEGY_ID) {
      this.syncDoubleBreakConfigFromParams();
      const result = this.getDoubleBreakResult();
      const signals = new Array<StrategySignal>(this.data.length).fill(0);
      if (result) {
        result.longSignals.forEach((signal) => {
          if (signal.index >= 0 && signal.index < signals.length) signals[signal.index] = 1;
        });
        result.shortSignals.forEach((signal) => {
          if (signal.index >= 0 && signal.index < signals.length) signals[signal.index] = -1;
        });
      }
      this.strategySignals = signals;
      this.latestStrategySignalIndex = this.computeLatestSignalIndex(this.strategySignals);
      this.drawSignalLayer(this.lastDrawMeta);
      this.updateSignalAnimationLoop();
      this.onStrategyComputed?.();
      return;
    }
    this.strategyRequestId += 1;
    this.strategyWorker.postMessage({
      type: 'compute',
      requestId: this.strategyRequestId,
      compiledJs: strategy.obfuscatedJs || strategy.compiledJs,
      candles: this.data,
      changedFrom,
      previousSignals: this.strategySignals,
      doubleBreakConfig: this.getDoubleBreakConfig(),
      strategyParams: strategy.params ?? {},
      symbol: this.config.symbol,
    });
  }

  private getDoubleBreakResult(): DoubleBreakResult | null {
    if (this.activeStrategyId !== DOUBLE_BREAK_STRATEGY_ID || !this.data.length) return null;
    try {
      this.syncDoubleBreakConfigFromParams();
      const cacheKey = this.buildDoubleBreakResultCacheKey();
      if (cacheKey === this.doubleBreakResultCacheKey) return this.doubleBreakResultCache;
      const result = new DoubleBreakStrategy(this.doubleBreakConfig).run(this.data);
      this.doubleBreakResultCacheKey = cacheKey;
      this.doubleBreakResultCache = result;
      return result;
    } catch {
      this.invalidateDoubleBreakResultCache();
      return null;
    }
  }

  private calcAtrSeries(period: number): Array<number | null> {
    if (!this.data.length) return [];
    const p = Math.max(1, Math.round(period));
    const tr = this.data.map((candle, i) => {
      if (i === 0) return candle.high - candle.low;
      const prevClose = this.data[i - 1].close;
      return Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose),
      );
    });
    let rolling = 0;
    return tr.map((value, i) => {
      rolling += value;
      if (i >= p) rolling -= tr[i - p];
      if (i < p - 1) return null;
      return rolling / p;
    });
  }

  private resolveStrategyReportRange(args: StrategyReportArgs): { start: number; end: number } | null {
    const nAll = this.data.length;
    let start = 0;
    let end = nAll;
    if (args.rangeStartSec != null || args.rangeEndSec != null) {
      while (start < nAll) {
        const ts = Number(this.data[start]?.time);
        if (!Number.isFinite(ts) || (args.rangeStartSec != null && ts < args.rangeStartSec)) {
          start += 1;
          continue;
        }
        break;
      }
      while (end > start) {
        const ts = Number(this.data[end - 1]?.time);
        if (!Number.isFinite(ts) || (args.rangeEndSec != null && ts > args.rangeEndSec)) {
          end -= 1;
          continue;
        }
        break;
      }
    }
    if (args.periodBars > 0 && args.periodBars < end - start) start = end - args.periodBars;
    if (end <= start) return null;
    return { start, end };
  }

  private buildSummaryReport(
    args: StrategyReportArgs,
    trades: StrategyReportTrade[],
    signalCount: number,
    openPositionCount: number,
    start: number,
    end: number,
    extras: {
      adxFilteredSignalCount?: number;
      strategyMeta?: StrategyReportResult['strategyMeta'];
    } = {},
  ): StrategyReportResult {
    const equity: number[] = [];
    const buyHold: number[] = [];
    const excursion: number[] = [];
    const runup: number[] = [];
    const drawdown: number[] = [];
    let cum = 0;
    let peak = 0;
    let trough = 0;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let cursor = 0;
    let absExcursion = 0;
    const closedTrades = trades
      .filter((trade) => trade.status === 'CLOSED')
      .slice()
      .sort((a, b) => a.exitIndex - b.exitIndex);
    const baseClose = Number(this.data[start]?.close) || 1;

    for (let i = start; i < end; i += 1) {
      while (cursor < closedTrades.length && closedTrades[cursor].exitIndex <= i) {
        cum += closedTrades[cursor].pnl;
        absExcursion += Math.abs(closedTrades[cursor].pnl);
        cursor += 1;
      }
      if (cum > peak) peak = cum;
      if (cum < trough) trough = cum;
      const dd = peak - cum;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (dd / peak) * 100);
      equity.push(cum);
      buyHold.push((Number(this.data[i]?.close) || baseClose) - baseClose);
      excursion.push(absExcursion);
      runup.push(Math.max(0, cum - trough));
      drawdown.push(Math.max(0, peak - cum));
    }

    let wins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    const openTrades = trades.filter((trade) => trade.status === 'OPEN');
    const unrealizedProfit = openTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    closedTrades.forEach((trade) => {
      if (trade.pnl > 0) {
        wins += 1;
        grossProfit += trade.pnl;
      } else if (trade.pnl < 0) {
        grossLoss += Math.abs(trade.pnl);
      }
    });
    const tradeCount = closedTrades.length;
    return {
      equity,
      buyHold,
      excursion,
      runup,
      drawdown,
      netProfit: cum,
      winRate: tradeCount > 0 ? (wins / tradeCount) * 100 : 0,
      maxDrawdown,
      maxDrawdownPct,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0),
      tradeCount,
      grossProfit,
      grossLoss,
      averagePnl: tradeCount > 0 ? cum / tradeCount : 0,
      realizedProfit: cum,
      unrealizedProfit,
      signalCount,
      adxFilteredSignalCount: extras.adxFilteredSignalCount ?? 0,
      closedTradeCount: tradeCount,
      openPositionCount,
      trades: trades.slice().sort((a, b) => a.entryIndex - b.entryIndex).slice(-350),
      strategyMeta: extras.strategyMeta,
    };
  }

  private getMtf1mScalperRiskConfig(): { atrPeriod: number; atrMult: number; tpMult: number } {
    const params = this.getStrategyParams(MTF_1M_SCALPER_STRATEGY_ID);
    return {
      atrPeriod: Math.max(1, Math.round(Number(params.atrPeriod) || 14)),
      atrMult: Math.max(0.01, Number(params.atrMult) || 1.5),
      tpMult: Math.max(0.01, Number(params.tpMult) || 1.5),
    };
  }

  private buildMtf1mScalperReport(args: StrategyReportArgs): StrategyReportResult | null {
    if (this.activeStrategyId !== MTF_1M_SCALPER_STRATEGY_ID || !this.data.length || !this.strategySignals.length) return null;
    const range = this.resolveStrategyReportRange(args);
    if (!range) return null;
    const { start, end } = range;
    const feeRate = (args.feeBps + args.slippageBps) / 10000;
    const risk = this.getMtf1mScalperRiskConfig();
    const atr = this.calcAtrSeries(risk.atrPeriod);
    const trades: StrategyReportTrade[] = [];
    const includeTrade = (tradeSide: 'LONG' | 'SHORT'): boolean => (
      args.sideFilter === 'all' || args.sideFilter === tradeSide.toLowerCase()
    );

    let side: 'LONG' | 'SHORT' | null = null;
    let entry = 0;
    let stop = 0;
    let tp = 0;
    let entryIndex = -1;
    let entryTime: number | null = null;
    let signalCount = 0;

    const closePosition = (exit: number, exitIndex: number, status: 'CLOSED' | 'OPEN') => {
      if (!side || entryIndex < 0) return;
      const gross = side === 'LONG' ? exit - entry : entry - exit;
      const net = gross - (entry + exit) * feeRate;
      if (includeTrade(side)) {
        trades.push({
          side,
          status,
          entry,
          exit,
          pnl: net,
          stopLoss: stop,
          takeProfits: [tp],
          entryIndex,
          exitIndex,
          entryTime,
          exitTime: status === 'CLOSED' && Number.isFinite(Number(this.data[exitIndex]?.time))
            ? Number(this.data[exitIndex]?.time)
            : null,
        });
      }
      side = null;
      entry = 0;
      stop = 0;
      tp = 0;
      entryIndex = -1;
      entryTime = null;
    };

    const openPosition = (nextSide: 'LONG' | 'SHORT', index: number) => {
      const candle = this.data[index];
      if (!candle) return;
      const atrNow = atr[index];
      const atrValue = atrNow && Number.isFinite(atrNow) ? atrNow : Math.max(1e-9, candle.high - candle.low);
      side = nextSide;
      entry = candle.close;
      entryIndex = index;
      entryTime = Number.isFinite(Number(candle.time)) ? Number(candle.time) : null;
      const distance = atrValue * risk.atrMult;
      if (nextSide === 'LONG') {
        stop = entry - distance;
        tp = entry + distance * risk.tpMult;
      } else {
        stop = entry + distance;
        tp = entry - distance * risk.tpMult;
      }
      if (includeTrade(nextSide)) signalCount += 1;
    };

    for (let i = start; i < end; i += 1) {
      const candle = this.data[i];
      if (!candle) continue;

      if (side && i > entryIndex) {
        if (side === 'LONG') {
          const stopHit = candle.low <= stop;
          const tpHit = candle.high >= tp;
          if (stopHit && tpHit) {
            closePosition(candle.close >= candle.open ? tp : stop, i, 'CLOSED');
          } else if (stopHit) {
            closePosition(stop, i, 'CLOSED');
          } else if (tpHit) {
            closePosition(tp, i, 'CLOSED');
          }
        } else {
          const stopHit = candle.high >= stop;
          const tpHit = candle.low <= tp;
          if (stopHit && tpHit) {
            closePosition(candle.close <= candle.open ? tp : stop, i, 'CLOSED');
          } else if (stopHit) {
            closePosition(stop, i, 'CLOSED');
          } else if (tpHit) {
            closePosition(tp, i, 'CLOSED');
          }
        }
      }

      const signal = this.strategySignals[i] ?? 0;
      if (signal > 0) {
        if (side === 'SHORT') closePosition(candle.close, i, 'CLOSED');
        if (side !== 'LONG') openPosition('LONG', i);
      } else if (signal < 0) {
        if (side === 'LONG') closePosition(candle.close, i, 'CLOSED');
        if (side !== 'SHORT') openPosition('SHORT', i);
      }
    }

    let openPositionCount = 0;
    if (side && entryIndex >= start) {
      const lastIndex = Math.max(start, end - 1);
      const lastClose = this.data[lastIndex]?.close ?? entry;
      openPositionCount = includeTrade(side) ? 1 : 0;
      closePosition(lastClose, lastIndex, 'OPEN');
    }

    return this.buildSummaryReport(args, trades, signalCount, openPositionCount, start, end);
  }

  private buildGridMartingaleReport(args: StrategyReportArgs): StrategyReportResult | null {
    if (this.activeStrategyId !== 'strategy_js_grid_martingale' || !this.data.length || !this.strategySignals.length) return null;
    const range = this.resolveStrategyReportRange(args);
    if (!range) return null;
    const { start, end } = range;
    const feeRate = (args.feeBps + args.slippageBps) / 10000;
    const simulation = simulateGridMartingale(
      this.data.map((candle) => Number(candle.close)),
      this.config.symbol,
      this.getStrategyParams('strategy_js_grid_martingale'),
    );
    const trades: StrategyReportTrade[] = [];
    const signalCount = simulation.signals.slice(start, end).reduce((count, signal) => count + (signal === 0 ? 0 : 1), 0);

    simulation.trades.forEach((trade) => {
      if (trade.entryIndex < start || trade.exitIndex >= end) return;
      const entryTime = Number.isFinite(Number(this.data[trade.entryIndex]?.time)) ? Number(this.data[trade.entryIndex]?.time) : null;
      const exitTime = Number.isFinite(Number(this.data[trade.exitIndex]?.time)) ? Number(this.data[trade.exitIndex]?.time) : null;
      const grossPnl = trade.side === 'LONG' ? (trade.exit - trade.entry) : (trade.entry - trade.exit);
      const netPnl = grossPnl - (trade.entry + trade.exit) * feeRate;
      if (args.sideFilter === 'all' || args.sideFilter === trade.side.toLowerCase()) {
        trades.push({
          side: trade.side,
          status: 'CLOSED',
          entry: trade.entry,
          exit: trade.exit,
          pnl: netPnl,
          stopLoss: null,
          takeProfits: [],
          entryIndex: trade.entryIndex,
          exitIndex: trade.exitIndex,
          entryTime,
          exitTime,
        });
      }
    });

    const lastIndex = Math.max(start, end - 1);
    const lastCandle = this.data[lastIndex];
    const appendOpenTrades = (
      side: 'LONG' | 'SHORT',
      entries: Array<{ entry: number; entryIndex: number }>,
    ) => {
      if (!lastCandle) return;
      if (!(args.sideFilter === 'all' || args.sideFilter === side.toLowerCase())) return;
      entries.forEach((leg) => {
        if (leg.entryIndex < start || leg.entryIndex >= end) return;
        const mark = lastCandle.close;
        const grossPnl = side === 'LONG' ? (mark - leg.entry) : (leg.entry - mark);
        trades.push({
          side,
          status: 'OPEN',
          entry: leg.entry,
          exit: mark,
          pnl: grossPnl - (leg.entry + mark) * feeRate,
          stopLoss: null,
          takeProfits: [],
          entryIndex: leg.entryIndex,
          exitIndex: lastIndex,
          entryTime: Number.isFinite(Number(this.data[leg.entryIndex]?.time)) ? Number(this.data[leg.entryIndex]?.time) : null,
          exitTime: null,
        });
      });
    };
    appendOpenTrades('LONG', simulation.openLongEntries);
    appendOpenTrades('SHORT', simulation.openShortEntries);

    const openPositionCount = [
      ...(args.sideFilter === 'all' || args.sideFilter === 'long' ? simulation.openLongEntries : []),
      ...(args.sideFilter === 'all' || args.sideFilter === 'short' ? simulation.openShortEntries : []),
    ].filter((leg) => leg.entryIndex >= start && leg.entryIndex < end).length;
    return this.buildSummaryReport(args, trades, signalCount, openPositionCount, start, end);
  }

  private buildXauGridLongReport(args: StrategyReportArgs): StrategyReportResult | null {
    if (this.activeStrategyId !== 'strategy_js_xau_grid_long' || !this.data.length || !this.strategySignals.length) return null;
    const range = this.resolveStrategyReportRange(args);
    if (!range) return null;
    const { start, end } = range;
    const feeRate = (args.feeBps + args.slippageBps) / 10000;
    const simulation = simulateXauGridLong(
      this.data.map((candle) => Number(candle.close)),
      this.getStrategyParams('strategy_js_xau_grid_long'),
    );
    const trades: StrategyReportTrade[] = [];
    const openByLevel = new Map<number, Array<{ entry: number; entryIndex: number; entryTime: number | null }>>();
    const signalCount = simulation.signals.slice(start, end).reduce((count, signal) => count + (signal === 0 ? 0 : 1), 0);

    for (let barIndex = 0; barIndex < simulation.bars.length; barIndex += 1) {
      const bar = simulation.bars[barIndex];
      const candle = this.data[barIndex];
      const barTime = Number.isFinite(Number(candle?.time)) ? Number(candle?.time) : null;

      bar.buyLevels.forEach((levelIndex) => {
        const entryPrice = simulation.levels[levelIndex];
        const bucket = openByLevel.get(levelIndex) ?? [];
        bucket.push({
          entry: entryPrice,
          entryIndex: barIndex,
          entryTime: barTime,
        });
        openByLevel.set(levelIndex, bucket);
      });

      bar.sellLevels.forEach((levelIndex) => {
        const bucket = openByLevel.get(levelIndex);
        const leg = bucket?.shift();
        if (!leg) return;
        const exitPrice = simulation.levels[Math.max(0, levelIndex - 1)];
        if (args.sideFilter === 'all' || args.sideFilter === 'long') {
          if (leg.entryIndex >= start && barIndex < end) {
            trades.push({
              side: 'LONG',
              status: 'CLOSED',
              entry: leg.entry,
              exit: exitPrice,
              pnl: (exitPrice - leg.entry) - (leg.entry + exitPrice) * feeRate,
              stopLoss: null,
              takeProfits: [exitPrice],
              entryIndex: leg.entryIndex,
              exitIndex: barIndex,
              entryTime: leg.entryTime,
              exitTime: barTime,
            });
          }
        }
      });
    }

    const lastIndex = Math.max(start, end - 1);
    const lastCandle = this.data[lastIndex];
    openByLevel.forEach((legs) => {
      legs.forEach((leg) => {
        if (!lastCandle) return;
        if (!(args.sideFilter === 'all' || args.sideFilter === 'long')) return;
        if (leg.entryIndex < start || leg.entryIndex >= end) return;
        const mark = Number(lastCandle.close);
        trades.push({
          side: 'LONG',
          status: 'OPEN',
          entry: leg.entry,
          exit: mark,
          pnl: (mark - leg.entry) - (leg.entry + mark) * feeRate,
          stopLoss: null,
          takeProfits: [],
          entryIndex: leg.entryIndex,
          exitIndex: lastIndex,
          entryTime: leg.entryTime,
          exitTime: null,
        });
      });
    });

    let latestEventBar = simulation.bars[lastIndex];
    for (let i = lastIndex; i >= start; i -= 1) {
      const candidate = simulation.bars[i];
      if (candidate.buyLevels.length || candidate.sellLevels.length) {
        latestEventBar = candidate;
        break;
      }
    }
    const latestBar = simulation.bars[lastIndex];
    const strategyMeta: StrategyReportResult['strategyMeta'] = {
      kind: 'xau-grid-long',
      ownedCount: latestBar.ownedCount,
      avgEntry: latestBar.avgEntry,
      deployedCapital: latestBar.deployedCapital,
      openQty: latestBar.openQty,
      openPnl: latestBar.openPnl,
      buyLevels: [...latestEventBar.buyLevels],
      sellLevels: [...latestEventBar.sellLevels],
      lastEventType: latestEventBar.eventType,
      highPrice: simulation.config.highPrice,
      lowPrice: simulation.config.lowPrice,
      nLevels: simulation.config.nLevels,
      gridMode: simulation.config.gridMode,
    };

    const openPositionCount = Array.from(openByLevel.values()).reduce((count, legs) => (
      count + legs.filter((leg) => leg.entryIndex >= start && leg.entryIndex < end).length
    ), 0);

    return this.buildSummaryReport(args, trades, signalCount, openPositionCount, start, end, {
      strategyMeta,
    });
  }

  private buildSrouterReport(args: StrategyReportArgs): StrategyReportResult | null {
    if (this.activeStrategyId !== 'strategy_js_grid_atr_bnf_srouter_v1' || !this.data.length || !this.strategySignals.length) return null;
    const range = this.resolveStrategyReportRange(args);
    if (!range) return null;
    const { start, end } = range;
    const feeRate = (args.feeBps + args.slippageBps) / 10000;
    const trades: StrategyReportTrade[] = [];
    const longLegs: Array<{ entry: number; entryIndex: number; entryTime: number | null }> = [];
    let shortLeg: { entry: number; entryIndex: number; entryTime: number | null } | null = null;
    let signalCount = 0;

    for (let i = start; i < end; i += 1) {
      const candle = this.data[i];
      if (!candle) continue;
      const signal = this.strategySignals[i] ?? 0;
      if (signal > 0) {
        if (shortLeg) {
          if (args.sideFilter === 'all' || args.sideFilter === 'short') {
            trades.push({
              side: 'SHORT',
              status: 'CLOSED',
              entry: shortLeg.entry,
              exit: candle.close,
              pnl: (shortLeg.entry - candle.close) - (shortLeg.entry + candle.close) * feeRate,
              stopLoss: null,
              takeProfits: [],
              entryIndex: shortLeg.entryIndex,
              exitIndex: i,
              entryTime: shortLeg.entryTime,
              exitTime: Number.isFinite(Number(candle.time)) ? Number(candle.time) : null,
            });
          }
          shortLeg = null;
        } else {
          signalCount += 1;
          longLegs.push({
            entry: candle.close,
            entryIndex: i,
            entryTime: Number.isFinite(Number(candle.time)) ? Number(candle.time) : null,
          });
        }
      } else if (signal < 0) {
        if (longLegs.length > 0) {
          const exitTime = Number.isFinite(Number(candle.time)) ? Number(candle.time) : null;
          while (longLegs.length > 0) {
            const leg = longLegs.shift()!;
            if (args.sideFilter === 'all' || args.sideFilter === 'long') {
              trades.push({
                side: 'LONG',
                status: 'CLOSED',
                entry: leg.entry,
                exit: candle.close,
                pnl: (candle.close - leg.entry) - (leg.entry + candle.close) * feeRate,
                stopLoss: null,
                takeProfits: [],
                entryIndex: leg.entryIndex,
                exitIndex: i,
                entryTime: leg.entryTime,
                exitTime,
              });
            }
          }
        } else if (!shortLeg) {
          signalCount += 1;
          shortLeg = {
            entry: candle.close,
            entryIndex: i,
            entryTime: Number.isFinite(Number(candle.time)) ? Number(candle.time) : null,
          };
        }
      }
    }

    const lastIndex = Math.max(start, end - 1);
    const lastCandle = this.data[lastIndex];
    if (lastCandle) {
      if (args.sideFilter === 'all' || args.sideFilter === 'long') {
        longLegs.forEach((leg) => {
          trades.push({
            side: 'LONG',
            status: 'OPEN',
            entry: leg.entry,
            exit: lastCandle.close,
            pnl: (lastCandle.close - leg.entry) - (leg.entry + lastCandle.close) * feeRate,
            stopLoss: null,
            takeProfits: [],
            entryIndex: leg.entryIndex,
            exitIndex: lastIndex,
            entryTime: leg.entryTime,
            exitTime: null,
          });
        });
      }
      if (shortLeg && (args.sideFilter === 'all' || args.sideFilter === 'short')) {
        trades.push({
          side: 'SHORT',
          status: 'OPEN',
          entry: shortLeg.entry,
          exit: lastCandle.close,
          pnl: (shortLeg.entry - lastCandle.close) - (shortLeg.entry + lastCandle.close) * feeRate,
          stopLoss: null,
          takeProfits: [],
          entryIndex: shortLeg.entryIndex,
          exitIndex: lastIndex,
          entryTime: shortLeg.entryTime,
          exitTime: null,
        });
      }
    }

    const openPositionCount =
      ((args.sideFilter === 'all' || args.sideFilter === 'long') ? longLegs.length : 0)
      + ((shortLeg && (args.sideFilter === 'all' || args.sideFilter === 'short')) ? 1 : 0);
    return this.buildSummaryReport(args, trades, signalCount, openPositionCount, start, end);
  }

  private buildBollingerRiskManagedReport(args: StrategyReportArgs): StrategyReportResult | null {
    if (this.activeStrategyId !== 'strategy_pine_bbands_directed' || !this.data.length || !this.strategySignals.length) {
      return null;
    }

    const nAll = this.data.length;
    let start = 0;
    let end = nAll;
    if (args.rangeStartSec != null || args.rangeEndSec != null) {
      while (start < nAll) {
        const ts = Number(this.data[start]?.time);
        if (!Number.isFinite(ts) || (args.rangeStartSec != null && ts < args.rangeStartSec)) {
          start += 1;
          continue;
        }
        break;
      }
      while (end > start) {
        const ts = Number(this.data[end - 1]?.time);
        if (!Number.isFinite(ts) || (args.rangeEndSec != null && ts > args.rangeEndSec)) {
          end -= 1;
          continue;
        }
        break;
      }
    }
    if (args.periodBars > 0 && args.periodBars < end - start) start = end - args.periodBars;
    if (end <= start) return null;

    const feeRate = (args.feeBps + args.slippageBps) / 10000;
    const risk = this.bollingerRiskConfig;
    const atr = this.calcAtrSeries(risk.atrPeriod);
    const trades: StrategyReportTrade[] = [];

    let side: 'LONG' | 'SHORT' | null = null;
    let entry = 0;
    let stop = 0;
    let tp1 = 0;
    let tp2 = 0;
    let entryIndex = -1;
    let entryTime: number | null = null;
    let tp1Hit = false;

    const includeTrade = (tradeSide: 'LONG' | 'SHORT'): boolean => (
      args.sideFilter === 'all' || args.sideFilter === tradeSide.toLowerCase()
    );

    const closePosition = (exit: number, exitIndex: number, reason: 'stop' | 'tp2' | 'timeout' | 'flip' | 'eod') => {
      if (!side || entryIndex < 0) return;
      const piece = risk.tp1Portion;
      let gross = 0;
      if (side === 'LONG') {
        if (reason === 'tp2') {
          gross = (tp1 - entry) * piece + (tp2 - entry) * (1 - piece);
        } else if (reason === 'stop' && tp1Hit) {
          gross = (tp1 - entry) * piece + (stop - entry) * (1 - piece);
        } else {
          gross = exit - entry;
        }
      } else {
        if (reason === 'tp2') {
          gross = (entry - tp1) * piece + (entry - tp2) * (1 - piece);
        } else if (reason === 'stop' && tp1Hit) {
          gross = (entry - tp1) * piece + (entry - stop) * (1 - piece);
        } else {
          gross = entry - exit;
        }
      }
      const net = gross - (entry + exit) * feeRate;
      if (includeTrade(side)) {
        trades.push({
          side,
          status: 'CLOSED',
          entry,
          exit,
          pnl: net,
          stopLoss: stop,
          takeProfits: [tp1, tp2],
          entryIndex,
          exitIndex,
          entryTime,
          exitTime: Number.isFinite(Number(this.data[exitIndex]?.time)) ? Number(this.data[exitIndex]?.time) : null,
        });
      }
      side = null;
      entry = 0;
      stop = 0;
      tp1 = 0;
      tp2 = 0;
      entryIndex = -1;
      entryTime = null;
      tp1Hit = false;
    };

    const openPosition = (nextSide: 'LONG' | 'SHORT', index: number) => {
      const candle = this.data[index];
      if (!candle) return;
      const atrNow = atr[index];
      const atrValue = atrNow && Number.isFinite(atrNow) ? atrNow : Math.max(1e-9, candle.high - candle.low);
      side = nextSide;
      entry = candle.close;
      entryIndex = index;
      entryTime = Number.isFinite(Number(candle.time)) ? Number(candle.time) : null;
      tp1Hit = false;
      if (nextSide === 'LONG') {
        stop = entry - atrValue * risk.slAtrMult;
        tp1 = entry + atrValue * risk.tp1AtrMult;
        tp2 = entry + atrValue * risk.tp2AtrMult;
      } else {
        stop = entry + atrValue * risk.slAtrMult;
        tp1 = entry - atrValue * risk.tp1AtrMult;
        tp2 = entry - atrValue * risk.tp2AtrMult;
      }
    };

    for (let i = start; i < end; i += 1) {
      const candle = this.data[i];
      if (!candle) continue;

      if (side && i > entryIndex) {
        if (side === 'LONG') {
          const slHit = candle.low <= stop;
          const tp1Now = candle.high >= tp1;
          const tp2Now = candle.high >= tp2;
          if (!tp1Hit && slHit) {
            closePosition(stop, i, 'stop');
          } else if (tp2Now) {
            closePosition(tp2, i, 'tp2');
          } else {
            if (tp1Now) {
              tp1Hit = true;
              if (risk.moveSlToEntryOnTp1) stop = Math.max(stop, entry);
            }
            if (tp1Hit && slHit) closePosition(stop, i, 'stop');
          }
        } else {
          const slHit = candle.high >= stop;
          const tp1Now = candle.low <= tp1;
          const tp2Now = candle.low <= tp2;
          if (!tp1Hit && slHit) {
            closePosition(stop, i, 'stop');
          } else if (tp2Now) {
            closePosition(tp2, i, 'tp2');
          } else {
            if (tp1Now) {
              tp1Hit = true;
              if (risk.moveSlToEntryOnTp1) stop = Math.min(stop, entry);
            }
            if (tp1Hit && slHit) closePosition(stop, i, 'stop');
          }
        }
      }

      if (side && i - entryIndex >= risk.maxHoldBars) {
        closePosition(candle.close, i, 'timeout');
      }

      const signal = this.strategySignals[i] ?? 0;
      if (signal > 0) {
        if (side === 'SHORT') closePosition(candle.close, i, 'flip');
        if (side !== 'LONG') openPosition('LONG', i);
      } else if (signal < 0) {
        if (side === 'LONG') closePosition(candle.close, i, 'flip');
        if (side !== 'SHORT') openPosition('SHORT', i);
      }
    }

    if (side && entryIndex >= start) {
      closePosition(this.data[end - 1]?.close ?? entry, Math.max(start, end - 1), 'eod');
    }

    const equity: number[] = [];
    const buyHold: number[] = [];
    const excursion: number[] = [];
    const runup: number[] = [];
    const drawdown: number[] = [];
    let cum = 0;
    let peak = 0;
    let trough = 0;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let cursor = 0;
    let absExcursion = 0;
    const sortedTrades = trades.slice().sort((a, b) => a.exitIndex - b.exitIndex);
    const baseClose = Number(this.data[start]?.close) || 1;

    for (let i = start; i < end; i += 1) {
      while (cursor < sortedTrades.length && sortedTrades[cursor].exitIndex <= i) {
        cum += sortedTrades[cursor].pnl;
        absExcursion += Math.abs(sortedTrades[cursor].pnl);
        cursor += 1;
      }
      if (cum > peak) peak = cum;
      if (cum < trough) trough = cum;
      const dd = peak - cum;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (dd / peak) * 100);
      equity.push(cum);
      buyHold.push((Number(this.data[i]?.close) || baseClose) - baseClose);
      excursion.push(absExcursion);
      runup.push(Math.max(0, cum - trough));
      drawdown.push(Math.max(0, peak - cum));
    }

    let wins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    sortedTrades.forEach((trade) => {
      if (trade.pnl > 0) {
        wins += 1;
        grossProfit += trade.pnl;
      } else if (trade.pnl < 0) {
        grossLoss += Math.abs(trade.pnl);
      }
    });
    const tradeCount = sortedTrades.length;

    return {
      equity,
      buyHold,
      excursion,
      runup,
      drawdown,
      netProfit: cum,
      winRate: tradeCount > 0 ? (wins / tradeCount) * 100 : 0,
      maxDrawdown,
      maxDrawdownPct,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0),
      tradeCount,
      grossProfit,
      grossLoss,
      averagePnl: tradeCount > 0 ? cum / tradeCount : 0,
      realizedProfit: cum,
      unrealizedProfit: 0,
      signalCount: sortedTrades.length,
      adxFilteredSignalCount: 0,
      closedTradeCount: sortedTrades.length,
      openPositionCount: 0,
      trades: sortedTrades.slice(-350),
    };
  }

  private computeStrategySignalsForCandles(candles: CandleData[]): StrategySignal[] {
    const strategy = this.getActiveStrategy();
    if (!strategy || !candles.length) return [];

    if (strategy.id === DOUBLE_BREAK_STRATEGY_ID) {
      try {
        this.syncDoubleBreakConfigFromParams();
        const result = new DoubleBreakStrategy(this.doubleBreakConfig).run(candles);
        const signals = new Array<StrategySignal>(candles.length).fill(0);
        result.longSignals.forEach((signal) => {
          if (signal.index >= 0 && signal.index < signals.length) signals[signal.index] = 1;
        });
        result.shortSignals.forEach((signal) => {
          if (signal.index >= 0 && signal.index < signals.length) signals[signal.index] = -1;
        });
        return signals;
      } catch {
        return [];
      }
    }

    const toSignal = (raw: unknown): StrategySignal => {
      if (typeof raw === 'number') return raw > 0 ? 1 : raw < 0 ? -1 : 0;
      if (typeof raw === 'boolean') return raw ? 1 : 0;
      if (raw && typeof raw === 'object') {
        const value = raw as { buy?: unknown; sell?: unknown };
        if (value.buy) return 1;
        if (value.sell) return -1;
      }
      return 0;
    };
    const ta = {
      sma(series: number[], period: number, index: number) {
        if (period <= 0 || index < period - 1) return null;
        let sum = 0;
        for (let i = index - period + 1; i <= index; i += 1) sum += series[i];
        return sum / period;
      },
      crossover(a: number[], b: number[], index: number) {
        if (index <= 0) return false;
        return a[index - 1] <= b[index - 1] && a[index] > b[index];
      },
      crossunder(a: number[], b: number[], index: number) {
        if (index <= 0) return false;
        return a[index - 1] >= b[index - 1] && a[index] < b[index];
      },
    };

    try {
      const strategyFn = new Function('return (' + (strategy.obfuscatedJs || strategy.compiledJs) + ');')();
      const context = {
        open: candles.map((candle) => Number(candle.open)),
        high: candles.map((candle) => Number(candle.high)),
        low: candles.map((candle) => Number(candle.low)),
        close: candles.map((candle) => Number(candle.close)),
        volume: candles.map((candle) => Number(candle.volume)),
        __doubleBreakConfig: this.getDoubleBreakConfig(),
        __strategyParams: strategy.params ?? {},
        __symbol: this.config.symbol,
      };
      return candles.map((_, index) => toSignal(strategyFn(context, index, ta)));
    } catch {
      return [];
    }
  }

  public buildStrategyReportFromCandles(args: StrategyReportFromCandlesArgs): StrategyReportResult | null {
    const candles = args.candles
      .map((candle) => ({
        time: Math.floor(Number(candle.time)),
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume),
      }))
      .filter((candle) => (
        Number.isFinite(candle.time)
        && Number.isFinite(candle.open)
        && Number.isFinite(candle.high)
        && Number.isFinite(candle.low)
        && Number.isFinite(candle.close)
        && Number.isFinite(candle.volume)
      ))
      .sort((a, b) => a.time - b.time);
    if (!candles.length) return null;

    const previousData = this.data;
    const previousSignals = this.strategySignals;
    const previousLatestStrategySignalIndex = this.latestStrategySignalIndex;
    try {
      this.data = candles;
      this.strategySignals = this.computeStrategySignalsForCandles(candles);
      this.latestStrategySignalIndex = this.computeLatestSignalIndex(this.strategySignals);
      return this.buildStrategyReport({
        feeBps: args.feeBps,
        slippageBps: args.slippageBps,
        periodBars: args.periodBars,
        rangeStartSec: args.rangeStartSec,
        rangeEndSec: args.rangeEndSec,
        sideFilter: args.sideFilter,
      });
    } finally {
      this.data = previousData;
      this.strategySignals = previousSignals;
      this.latestStrategySignalIndex = previousLatestStrategySignalIndex;
    }
  }

  public buildStrategyReport(args: StrategyReportArgs): StrategyReportResult | null {
    const gridMartingale = this.buildGridMartingaleReport(args);
    if (gridMartingale) return gridMartingale;

    const xauGridLong = this.buildXauGridLongReport(args);
    if (xauGridLong) return xauGridLong;

    const srouter = this.buildSrouterReport(args);
    if (srouter) return srouter;

    if (this.activeStrategyId === 'strategy_pine_bbands_directed' && this.bollingerRiskConfig.enabled) {
      return this.buildBollingerRiskManagedReport(args);
    }

    const mtf1mScalper = this.buildMtf1mScalperReport(args);
    if (mtf1mScalper) return mtf1mScalper;

    const doubleBreak = this.getDoubleBreakResult();
    if (!doubleBreak) return null;

    const nAll = this.data.length;
    let start = 0;
    let end = nAll;
    if (args.rangeStartSec != null || args.rangeEndSec != null) {
      while (start < nAll) {
        const ts = Number(this.data[start]?.time);
        if (!Number.isFinite(ts) || (args.rangeStartSec != null && ts < args.rangeStartSec)) {
          start += 1;
          continue;
        }
        break;
      }
      while (end > start) {
        const ts = Number(this.data[end - 1]?.time);
        if (!Number.isFinite(ts) || (args.rangeEndSec != null && ts > args.rangeEndSec)) {
          end -= 1;
          continue;
        }
        break;
      }
    }
    if (args.periodBars > 0 && args.periodBars < end - start) start = end - args.periodBars;

    type DoubleBreakReportSignal = {
      side: 'LONG' | 'SHORT';
      index: number;
      price: number;
      tp1: number;
      tp2: number;
      sl: number;
    };
    const allSignals: DoubleBreakReportSignal[] = [
      ...doubleBreak.longSignals.map((signal) => ({
        side: 'LONG' as const,
        index: signal.index,
        price: signal.price,
        tp1: signal.tp1,
        tp2: signal.tp2,
        sl: signal.sl,
      })),
      ...doubleBreak.shortSignals.map((signal) => ({
        side: 'SHORT' as const,
        index: signal.index,
        price: signal.price,
        tp1: signal.tp1,
        tp2: signal.tp2,
        sl: signal.sl,
      })),
    ]
      .filter((signal) => signal.index >= start && signal.index < end)
      .sort((a, b) => a.index - b.index);

    const includeTrade = (side: 'LONG' | 'SHORT') => (
      args.sideFilter === 'all' || args.sideFilter === side.toLowerCase()
    );
    const sameBarPriority = (candle: CandleData): 'target' | 'stop' => {
      if (this.doubleBreakConfig.sameBarMode === 'optimistic') return 'target';
      if (this.doubleBreakConfig.sameBarMode === 'candle') {
        if (candle.close > candle.open) return 'target';
        if (candle.close < candle.open) return 'stop';
      }
      return 'stop';
    };
    const feeRate = (args.feeBps + args.slippageBps) / 10000;
    const tp1Portion = 0.3;
    const runnerPortion = 0.7;
    const trades: StrategyReportTrade[] = [];
    const signalByIndex = new Map<number, DoubleBreakReportSignal[]>();
    allSignals.forEach((signal) => {
      const bucket = signalByIndex.get(signal.index);
      if (bucket) bucket.push(signal);
      else signalByIndex.set(signal.index, [signal]);
    });

    let side: 'LONG' | 'SHORT' | null = null;
    let activeSignal: DoubleBreakReportSignal | null = null;
    let entryIndex = -1;
    let entryTime: number | null = null;
    let tp1Hit = false;
    let realizedGross = 0;
    let realizedCost = 0;
    let signalCount = 0;
    let openPositionCount = 0;

    const finalizeTrade = (exitPrice: number, exitIndex: number) => {
      if (!side || !activeSignal || entryIndex < 0) return;
      const net = realizedGross - realizedCost;
      if (includeTrade(side)) {
        trades.push({
          side,
          status: 'CLOSED',
          entry: activeSignal.price,
          exit: exitPrice,
          pnl: net,
          stopLoss: activeSignal.sl,
          takeProfits: [activeSignal.tp1, activeSignal.tp2],
          entryIndex,
          exitIndex,
          entryTime,
          exitTime: Number.isFinite(Number(this.data[exitIndex]?.time)) ? Number(this.data[exitIndex]?.time) : null,
        });
      }
      side = null;
      activeSignal = null;
      entryIndex = -1;
      entryTime = null;
      tp1Hit = false;
      realizedGross = 0;
      realizedCost = 0;
    };

    const realizePiece = (piece: number, exitPrice: number) => {
      if (!side || !activeSignal) return;
      if (side === 'LONG') realizedGross += (exitPrice - activeSignal.price) * piece;
      else realizedGross += (activeSignal.price - exitPrice) * piece;
      realizedCost += (activeSignal.price + exitPrice) * piece * feeRate;
    };

    const openPosition = (signal: DoubleBreakReportSignal) => {
      side = signal.side;
      activeSignal = signal;
      entryIndex = signal.index;
      entryTime = Number.isFinite(Number(this.data[signal.index]?.time)) ? Number(this.data[signal.index]?.time) : null;
      tp1Hit = false;
      realizedGross = 0;
      realizedCost = 0;
      if (includeTrade(signal.side)) signalCount += 1;
    };

    for (let i = start; i < end; i += 1) {
      const candle = this.data[i];
      if (!candle) continue;

      if (side && activeSignal && i > entryIndex) {
        const active: DoubleBreakReportSignal = activeSignal;
        if (side === 'LONG') {
          const stopHit = candle.low <= active.sl;
          const tp1Now = candle.high >= active.tp1;
          const tp2Now = candle.high >= active.tp2;
          const targetFirst = sameBarPriority(candle) === 'target';

          if (!tp1Hit) {
            if (stopHit && tp1Now) {
              if (targetFirst) {
                realizePiece(tp1Portion, active.tp1);
                tp1Hit = true;
                if (this.doubleBreakConfig.runnerExitMode === 'tp2' && tp2Now) {
                  realizePiece(runnerPortion, active.tp2);
                  finalizeTrade(active.tp2, i);
                } else {
                  realizePiece(runnerPortion, active.sl);
                  finalizeTrade(active.sl, i);
                }
              } else {
                realizePiece(1, active.sl);
                finalizeTrade(active.sl, i);
              }
            } else if (stopHit) {
              realizePiece(1, active.sl);
              finalizeTrade(active.sl, i);
            } else if (tp1Now) {
              realizePiece(tp1Portion, active.tp1);
              tp1Hit = true;
              if (this.doubleBreakConfig.runnerExitMode === 'tp2' && tp2Now) {
                realizePiece(runnerPortion, active.tp2);
                finalizeTrade(active.tp2, i);
              }
            }
          } else if (side && activeSignal) {
            const stopAfterTp1 = candle.low <= active.sl;
            if (this.doubleBreakConfig.runnerExitMode === 'tp2') {
              const tp2AfterTp1 = candle.high >= active.tp2;
              if (stopAfterTp1 && tp2AfterTp1) {
                const targetWins = sameBarPriority(candle) === 'target';
                realizePiece(runnerPortion, targetWins ? active.tp2 : active.sl);
                finalizeTrade(targetWins ? active.tp2 : active.sl, i);
              } else if (tp2AfterTp1) {
                realizePiece(runnerPortion, active.tp2);
                finalizeTrade(active.tp2, i);
              } else if (stopAfterTp1) {
                realizePiece(runnerPortion, active.sl);
                finalizeTrade(active.sl, i);
              }
            } else if (stopAfterTp1) {
              realizePiece(runnerPortion, active.sl);
              finalizeTrade(active.sl, i);
            }
          }
        } else {
          const stopHit = candle.high >= active.sl;
          const tp1Now = candle.low <= active.tp1;
          const tp2Now = candle.low <= active.tp2;
          const targetFirst = sameBarPriority(candle) === 'target';

          if (!tp1Hit) {
            if (stopHit && tp1Now) {
              if (targetFirst) {
                realizePiece(tp1Portion, active.tp1);
                tp1Hit = true;
                if (this.doubleBreakConfig.runnerExitMode === 'tp2' && tp2Now) {
                  realizePiece(runnerPortion, active.tp2);
                  finalizeTrade(active.tp2, i);
                } else {
                  realizePiece(runnerPortion, active.sl);
                  finalizeTrade(active.sl, i);
                }
              } else {
                realizePiece(1, active.sl);
                finalizeTrade(active.sl, i);
              }
            } else if (stopHit) {
              realizePiece(1, active.sl);
              finalizeTrade(active.sl, i);
            } else if (tp1Now) {
              realizePiece(tp1Portion, active.tp1);
              tp1Hit = true;
              if (this.doubleBreakConfig.runnerExitMode === 'tp2' && tp2Now) {
                realizePiece(runnerPortion, active.tp2);
                finalizeTrade(active.tp2, i);
              }
            }
          } else if (side && activeSignal) {
            const stopAfterTp1 = candle.high >= active.sl;
            if (this.doubleBreakConfig.runnerExitMode === 'tp2') {
              const tp2AfterTp1 = candle.low <= active.tp2;
              if (stopAfterTp1 && tp2AfterTp1) {
                const targetWins = sameBarPriority(candle) === 'target';
                realizePiece(runnerPortion, targetWins ? active.tp2 : active.sl);
                finalizeTrade(targetWins ? active.tp2 : active.sl, i);
              } else if (tp2AfterTp1) {
                realizePiece(runnerPortion, active.tp2);
                finalizeTrade(active.tp2, i);
              } else if (stopAfterTp1) {
                realizePiece(runnerPortion, active.sl);
                finalizeTrade(active.sl, i);
              }
            } else if (stopAfterTp1) {
              realizePiece(runnerPortion, active.sl);
              finalizeTrade(active.sl, i);
            }
          }
        }
      }

      const signalsNow = signalByIndex.get(i) ?? [];
      for (const signal of signalsNow) {
        if (side && activeSignal && signal.side !== side && tp1Hit && this.doubleBreakConfig.runnerExitMode === 'opposite') {
          const active: DoubleBreakReportSignal = activeSignal;
          realizePiece(runnerPortion, this.data[i]?.close ?? active.price);
          finalizeTrade(this.data[i]?.close ?? active.price, i);
        }

        if (!side) {
          openPosition(signal);
        }
      }
    }

    if (side && activeSignal && includeTrade(side)) {
      const active: DoubleBreakReportSignal = activeSignal;
      openPositionCount = 1;
      const lastIndex = Math.max(entryIndex, end - 1, start);
      const lastCandle = this.data[lastIndex];
      const markPrice = Number.isFinite(Number(lastCandle?.close))
        ? Number(lastCandle?.close)
        : active.price;
      let openGross = realizedGross;
      let openCost = realizedCost;
      if (tp1Hit) {
        if (side === 'LONG') openGross += (markPrice - active.price) * runnerPortion;
        else openGross += (active.price - markPrice) * runnerPortion;
        openCost += (active.price + markPrice) * runnerPortion * feeRate;
      } else {
        if (side === 'LONG') openGross += markPrice - active.price;
        else openGross += active.price - markPrice;
        openCost += (active.price + markPrice) * feeRate;
      }
      trades.push({
        side,
        status: 'OPEN',
        entry: active.price,
        exit: markPrice,
        pnl: openGross - openCost,
        stopLoss: active.sl,
        takeProfits: [active.tp1, active.tp2],
        entryIndex,
        exitIndex: lastIndex,
        entryTime,
        exitTime: null,
      });
    }

    const equity: number[] = [];
    const buyHold: number[] = [];
    const excursion: number[] = [];
    const runup: number[] = [];
    const drawdown: number[] = [];
    let cum = 0;
    let peak = 0;
    let trough = 0;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let tradeCursor = 0;
    let absExcursion = 0;
    const sortedTrades = trades.slice().sort((a, b) => a.exitIndex - b.exitIndex);
    const baseClose = Number(this.data[start]?.close) || 1;

    for (let i = start; i < end; i += 1) {
      while (tradeCursor < sortedTrades.length && sortedTrades[tradeCursor].exitIndex <= i) {
        cum += sortedTrades[tradeCursor].pnl;
        absExcursion += Math.abs(sortedTrades[tradeCursor].pnl);
        tradeCursor += 1;
      }
      if (cum > peak) peak = cum;
      if (cum < trough) trough = cum;
      const dd = peak - cum;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (dd / peak) * 100);
      equity.push(cum);
      buyHold.push((Number(this.data[i]?.close) || baseClose) - baseClose);
      excursion.push(absExcursion);
      runup.push(Math.max(0, cum - trough));
      drawdown.push(Math.max(0, peak - cum));
    }

    let wins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    sortedTrades.forEach((trade) => {
      if (trade.pnl > 0) {
        wins += 1;
        grossProfit += trade.pnl;
      } else if (trade.pnl < 0) {
        grossLoss += Math.abs(trade.pnl);
      }
    });

    const tradeCount = sortedTrades.length;
    return {
      equity,
      buyHold,
      excursion,
      runup,
      drawdown,
      netProfit: cum,
      winRate: tradeCount > 0 ? (wins / tradeCount) * 100 : 0,
      maxDrawdown,
      maxDrawdownPct,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0),
      tradeCount,
      grossProfit,
      grossLoss,
      averagePnl: tradeCount > 0 ? cum / tradeCount : 0,
      realizedProfit: cum,
      unrealizedProfit: 0,
      signalCount,
      adxFilteredSignalCount: doubleBreak.adxFilteredSignalCount,
      closedTradeCount: tradeCount,
      openPositionCount,
      trades: sortedTrades.slice(-350),
    };
  }

  private lastDrawMeta: null | {
    chartLeft: number;
    chartRight: number;
    chartW: number;
    axisPad: number;
    axisSide: 'left' | 'right';
    totalSp: number;
    candleW: number;
    candleSlotOffset: number;
    mainH: number;
    minP: number;
    maxP: number;
    leftGap: number;
    getY: (p: number) => number;
    getYLinear: (p: number) => number;
    panelTops: Record<string, number>;
    subPanelHeights: Record<string, number>;
    subAxisStart: number;
    subPanelCrosshairData: SubPanelCrosshairData;
  } = null;

  private buildSignalRiskDetails(startIndex = 0, endIndex = this.strategySignals.length): Map<number, {
    side: 'LONG' | 'SHORT';
    stopLoss: number | null;
    takeProfits: number[];
  }> {
    const start = Math.max(0, Math.floor(startIndex));
    const end = Math.max(start, Math.min(this.strategySignals.length, Math.ceil(endIndex)));
    const details = new Map<number, {
      side: 'LONG' | 'SHORT';
      stopLoss: number | null;
      takeProfits: number[];
    }>();

    if (this.activeStrategyId === DOUBLE_BREAK_STRATEGY_ID) {
      const doubleBreakResult = this.getDoubleBreakResult();
      if (!doubleBreakResult) return details;
      doubleBreakResult.longSignals.forEach((signal) => {
        if (signal.index < start || signal.index >= end) return;
        details.set(signal.index, {
          side: 'LONG',
          stopLoss: signal.sl,
          takeProfits: [signal.tp1, signal.tp2],
        });
      });
      doubleBreakResult.shortSignals.forEach((signal) => {
        if (signal.index < start || signal.index >= end) return;
        details.set(signal.index, {
          side: 'SHORT',
          stopLoss: signal.sl,
          takeProfits: [signal.tp1, signal.tp2],
        });
      });
      return details;
    }

    if (this.activeStrategyId === 'strategy_pine_bbands_directed' && this.bollingerRiskConfig.enabled) {
      const risk = this.bollingerRiskConfig;
      for (let i = start; i < end; i += 1) {
        const signal = this.strategySignals[i] ?? 0;
        if (!signal) continue;
        const candle = this.data[i];
        if (!candle) continue;
        const atrNow = this.calcAtrAtIndex(i, risk.atrPeriod);
        const atrValue = atrNow && Number.isFinite(atrNow) ? atrNow : Math.max(1e-9, candle.high - candle.low);
        if (signal > 0) {
          details.set(i, {
            side: 'LONG',
            stopLoss: candle.close - atrValue * risk.slAtrMult,
            takeProfits: [
              candle.close + atrValue * risk.tp1AtrMult,
              candle.close + atrValue * risk.tp2AtrMult,
            ],
          });
        } else if (signal < 0) {
          details.set(i, {
            side: 'SHORT',
            stopLoss: candle.close + atrValue * risk.slAtrMult,
            takeProfits: [
              candle.close - atrValue * risk.tp1AtrMult,
              candle.close - atrValue * risk.tp2AtrMult,
            ],
          });
        }
      }
    }

    if (this.activeStrategyId === MTF_1M_SCALPER_STRATEGY_ID) {
      const risk = this.getMtf1mScalperRiskConfig();
      for (let i = start; i < end; i += 1) {
        const signal = this.strategySignals[i] ?? 0;
        if (!signal) continue;
        const candle = this.data[i];
        if (!candle) continue;
        const atrNow = this.calcAtrAtIndex(i, risk.atrPeriod);
        const atrValue = atrNow && Number.isFinite(atrNow) ? atrNow : Math.max(1e-9, candle.high - candle.low);
        const distance = atrValue * risk.atrMult;
        if (signal > 0) {
          details.set(i, {
            side: 'LONG',
            stopLoss: candle.close - distance,
            takeProfits: [candle.close + distance * risk.tpMult],
          });
        } else if (signal < 0) {
          details.set(i, {
            side: 'SHORT',
            stopLoss: candle.close + distance,
            takeProfits: [candle.close - distance * risk.tpMult],
          });
        }
      }
    }

    if (this.activeStrategyId === AUTO_TRENDLINE_CHANNEL_STRATEGY_ID) {
      const result = simulateAutoTrendlineChannelStrategy(this.data, this.getActiveStrategy()?.params ?? {});
      for (let i = start; i < end; i += 1) {
        const signal = this.strategySignals[i] ?? 0;
        if (!signal) continue;
        const stop = result.stopLoss[i];
        const target = result.takeProfit[i];
        if (target == null) continue;
        details.set(i, {
          side: signal > 0 ? 'LONG' : 'SHORT',
          stopLoss: stop,
          takeProfits: [target],
        });
      }
    }

    return details;
  }

  private drawSignalLayer(meta: {
    chartLeft: number;
    chartRight: number;
    chartW: number;
    axisPad: number;
    axisSide: 'left' | 'right';
    totalSp: number;
    candleW: number;
    mainH: number;
    minP: number;
    maxP: number;
    leftGap: number;
    getY: (p: number) => number;
    getYLinear: (p: number) => number;
  } | null, timeMs = performance.now()): void {
    const ctx = this.signalCtx;
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    ctx.clearRect(0, 0, w, h);
    this.signalHitAreas = [];
    if (!meta || !this.strategySignals.length || !this.strategySignalVisible) return;

    const visible = this.data.slice(this.startIndex, this.endIndex);
    const strategy = this.getActiveStrategy();
    if (!strategy) return;

    ctx.font = `600 12px ${CHART_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbolPriceDigits = getSymbolPricePrecision(this.config.symbol, this.config.quoteCurrency);
    const baseRadius = Math.max(8, Math.min(12, meta.candleW * 0.8));
    const signalRiskDetails = this.buildSignalRiskDetails(this.startIndex, this.endIndex);
    const riskDrawJobs: Array<{
      fromX: number;
      price: number;
      label: string;
      color: string;
      dash: number[];
      alpha: number;
    }> = [];

    const drawExitLine = (
      x1: number,
      price: number,
      label: string,
      color: string,
      dash: number[],
      alpha = 0.92,
    ) => {
      drawPriceLineOverlay({
        ctx,
        chartLeft: meta.chartLeft,
        chartRight: meta.chartRight,
        axisPad: meta.axisPad,
        axisSide: meta.axisSide,
        totalSp: meta.totalSp,
        mainH: meta.mainH,
        minP: meta.minP,
        maxP: meta.maxP,
        getY: meta.getY,
        fromX: x1,
        price,
        label,
        color,
        dash,
        alpha,
        fontStack: CHART_FONT_STACK,
        priceDigits: symbolPriceDigits,
      });
    };

    const latestSignalIndex = this.focusedTradeRange ? -1 : this.latestStrategySignalIndex;

    ctx.save();
    ctx.beginPath();
    ctx.rect(meta.chartLeft, 0, Math.max(1, meta.chartRight - meta.chartLeft), Math.max(1, meta.mainH));
    ctx.clip();

    for (let i = 0; i < visible.length; i += 1) {
      const gi = this.startIndex + i;
      const signal = this.strategySignals[gi] ?? 0;
      if (!signal) continue;
      const candle = visible[i];
      const x = meta.chartLeft + (i + meta.leftGap) * meta.totalSp + meta.candleW / 2;
      const entryPrice = candle.close;
      const entryY = meta.getY(entryPrice);
      const isLatest = gi === latestSignalIndex;
      const detail = signalRiskDetails.get(gi);
      if (this.strategyRiskLinesVisible && detail && (gi === this.hoveredSignalCandleIndex || gi === this.focusedSignalCandleIndex)) {
        const fromX = x + meta.candleW * 0.55;
        riskDrawJobs.push({
          fromX,
          price: entryPrice,
          label: 'ENTRY',
          color: '#6ea8ff',
          dash: [6, 3],
          alpha: isLatest ? 0.95 : 0.7,
        });
        const stopColor = '#ff6b6b';
        if (typeof detail.stopLoss === 'number' && Number.isFinite(detail.stopLoss)) {
          riskDrawJobs.push({
            fromX,
            price: detail.stopLoss,
            label: 'SL',
            color: stopColor,
            dash: [2, 3],
            alpha: isLatest ? 1 : 0.72,
          });
        }
        detail.takeProfits.forEach((price, idx) => {
          if (!Number.isFinite(price)) return;
          const label = detail.takeProfits.length > 1 ? `TP${idx + 1}` : 'TP';
          const takeProfitPalette = ['#37d67a', '#21b86b', '#139b5a'];
          const color = takeProfitPalette[idx] ?? takeProfitPalette[takeProfitPalette.length - 1];
          riskDrawJobs.push({
            fromX,
            price,
            label,
            color,
            dash: idx === 0 ? [4, 3] : [8, 4],
            alpha: isLatest ? 1 : (idx === 0 ? 0.68 : 0.64),
          });
        });
      }
      const isLong = signal > 0;
      const boxColor = isLong ? '#1a9e6e' : '#c0392b';
      const label = isLong ? 'B' : 'S';

      const phase = (Math.sin(timeMs * 0.008) + 1) / 2;
      const pulseAlpha = isLatest ? (0.65 + phase * 0.35) : 1;

      // callout box dimensions
      const bW = 18;
      const bH = 14;
      const ptrH = 8;
      const bX = x - bW / 2;
      const anchorY = isLong
        ? meta.getY(candle.low) + 4
        : meta.getY(candle.high) - 4;
      const bY = isLong ? anchorY + ptrH : anchorY - ptrH - bH;
      const boxCx = x;
      const boxCy = bY + bH / 2;
      const radius = bW * 0.5; // for hit area

      // latest: expanding glow ring
      if (isLatest) {
        const ringR = (bW * 0.525) + phase * (bW * 0.675);
        const ringAlpha = (1 - phase) * 0.55;
        ctx.save();
        ctx.beginPath();
        ctx.arc(boxCx, boxCy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = toRgba(boxColor, ringAlpha, boxColor);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = pulseAlpha;

      // unified callout path (box + pointer as one shape)
      const r = 3;
      const pb = 3; // pointer half-base width (4 * 0.7 ? 3)
      ctx.beginPath();
      if (isLong) {
        // pointer at top edge, pointing up
        ctx.moveTo(bX + r, bY);
        ctx.lineTo(x - pb, bY);
        ctx.lineTo(x, anchorY);
        ctx.lineTo(x + pb, bY);
        ctx.lineTo(bX + bW - r, bY);
        ctx.arcTo(bX + bW, bY, bX + bW, bY + r, r);
        ctx.lineTo(bX + bW, bY + bH - r);
        ctx.arcTo(bX + bW, bY + bH, bX + bW - r, bY + bH, r);
        ctx.lineTo(bX + r, bY + bH);
        ctx.arcTo(bX, bY + bH, bX, bY + bH - r, r);
        ctx.lineTo(bX, bY + r);
        ctx.arcTo(bX, bY, bX + r, bY, r);
      } else {
        // pointer at bottom edge, pointing down
        ctx.moveTo(bX + r, bY);
        ctx.lineTo(bX + bW - r, bY);
        ctx.arcTo(bX + bW, bY, bX + bW, bY + r, r);
        ctx.lineTo(bX + bW, bY + bH - r);
        ctx.arcTo(bX + bW, bY + bH, bX + bW - r, bY + bH, r);
        ctx.lineTo(x + pb, bY + bH);
        ctx.lineTo(x, anchorY);
        ctx.lineTo(x - pb, bY + bH);
        ctx.lineTo(bX + r, bY + bH);
        ctx.arcTo(bX, bY + bH, bX, bY + bH - r, r);
        ctx.lineTo(bX, bY + r);
        ctx.arcTo(bX, bY, bX + r, bY, r);
      }
      ctx.closePath();
      ctx.fillStyle = boxColor;
      ctx.fill();

      // label
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 10px ${CHART_FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, boxCy + 0.5);

      ctx.restore();

      const showRiskOverlayForSignal = this.strategyRiskLinesVisible
        && !!detail
        && (gi === this.hoveredSignalCandleIndex || gi === this.focusedSignalCandleIndex);

      // Mark the entry-price Y level beside the signal candle body with a small triangle.
      if (!showRiskOverlayForSignal && entryY >= 0 && entryY <= meta.mainH) {
        const triW = Math.max(7, Math.min(12, meta.candleW * 0.55));
        const triH = Math.max(5, Math.min(9, meta.candleW * 0.4));
        const tipX = x;
        const baseX = x - triW;
        ctx.save();
        ctx.globalAlpha = isLatest ? 1 : 0.82;
        ctx.beginPath();
        ctx.moveTo(tipX, entryY);
        ctx.lineTo(baseX, entryY - triH);
        ctx.lineTo(baseX, entryY + triH);
        ctx.closePath();
        ctx.fillStyle = boxColor;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      this.signalHitAreas.push({
        x,
        y: bY + bH / 2,
        r: radius,
        signal,
        entryPrice,
        candleIndex: gi,
      });
    }

    ctx.restore();
    riskDrawJobs.forEach((job) => {
      drawExitLine(job.fromX, job.price, job.label, job.color, job.dash, job.alpha);
    });
  }

  constructor(container: HTMLElement) {
    this.containerEl = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);

    this.signalCanvas = document.createElement('canvas');
    this.signalCtx = this.signalCanvas.getContext('2d')!;
    Object.assign(this.signalCanvas.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    });
    container.appendChild(this.signalCanvas);

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCtx    = this.overlayCanvas.getContext('2d')!;
    Object.assign(this.overlayCanvas.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    });
    container.appendChild(this.overlayCanvas);

    // Y축 로그 스케일 버튼
    const logBtn = document.createElement('button');
    this.logBtn = logBtn;
    logBtn.textContent = 'Log';
    Object.assign(logBtn.style, {
      position: 'absolute', zIndex: '10',
      border: '1px solid #4a5568', borderRadius: '3px',
      background: '#1a2035', color: '#8899b4',
      fontSize: '11px', fontWeight: '500',
      padding: '2px 6px', cursor: 'pointer',
      lineHeight: '1.4', userSelect: 'none', display: 'none',
    });
    logBtn.addEventListener('click', () => {
      this.logScale = !this.logScale;
      logBtn.style.background = this.logScale ? '#2563eb' : '#1a2035';
      logBtn.style.color = this.logScale ? '#ffffff' : '#8899b4';
      logBtn.style.borderColor = this.logScale ? '#3b82f6' : '#4a5568';
      this.draw();
    });
    logBtn.addEventListener('mouseenter', () => {
      this._logBtnHovered = true;
      if (this.logBtnHideTimer) { clearTimeout(this.logBtnHideTimer); this.logBtnHideTimer = null; }
      logBtn.style.display = 'block';
    });
    logBtn.addEventListener('mouseleave', () => {
      this._logBtnHovered = false;
      this.scheduleLogBtnHide();
    });
    container.appendChild(logBtn);

    this.ensureDrawingToolbar();
    [this.ctx, this.signalCtx, this.overlayCtx].forEach((ctx) => {
      ctx.imageSmoothingEnabled = false;
    });

    this.initStrategyWorker();
    this.resize();
    this.canvas.style.cursor = 'none';
    const scheduleResize = () => {
      if (this.resizeScheduled) return;
      this.resizeScheduled = true;
      window.requestAnimationFrame(() => {
        this.resizeScheduled = false;
        this.resize();
      });
    };
    const ResizeObserverCtor = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (ResizeObserverCtor) {
      this.resizeObserver = new ResizeObserverCtor(() => {
        scheduleResize();
      });
      this.resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', scheduleResize);
    }
    this.canvas.addEventListener('wheel',     this.handleWheel.bind(this),     { passive: false });
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup',   this.handleMouseUp.bind(this));
    document.addEventListener('mouseup', () => {
      if (this.isDragging || this.yAxisDragging || this.subYAxisDragging || this.drawingMoveState || this.drawingDragActive) {
        this.handleMouseUp();
      }
    });
    this.canvas.addEventListener('dblclick',  this.handleDoubleClick.bind(this));
    this.canvas.addEventListener('mouseleave', () => {
      const keepCrosshair = Boolean(this.drawingTool && this.drawingTool !== 'eraser')
        || Boolean(this.drawingDraft)
        || Boolean(this.drawingMoveState);
      this.isMouseOver = keepCrosshair;
      this.isMouseDownForTooltip = false;
      this.stopMouseLongPressTooltip();
      this.hoveredDrawingId = null;
      this.hoveredDrawingPart = null;
      this.canvas.style.cursor = 'default';
      if (!this.yAxisDragging) this.scheduleLogBtnHide();
      this.requestOverlayDraw();
    });
    // ── 터치 이벤트 (모바일 핀치줌 + 스와이프 패닝) ──
    this.canvas.addEventListener('touchstart',  this.handleTouchStart.bind(this),  { passive: false });
    this.canvas.addEventListener('touchmove',   this.handleTouchMove.bind(this),   { passive: false });
    this.canvas.addEventListener('touchend',    this.handleTouchEnd.bind(this),    { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this),    { passive: false });
    document.addEventListener('mousedown', (event) => {
      const target = event.target as Node | null;
      const host = this.canvas.parentElement;
      if (!host || !target) return;
      if (this.trendlineTextEditorEl && this.trendlineTextEditorEl.contains(target)) return;
      if (host.contains(target)) return;
      if (!this.selectedDrawingId) return;
      this.clearDrawingSelection();
    });
  }

  public setData(data: CandleData[]) {
    const prevData = this.data;
    const prevStart = this.startIndex;
    const prevEnd = this.endIndex;
    const prevVisible = Math.max(1, prevEnd - prevStart);
    const prevWasNearLatest = Math.max(0, prevData.length - prevEnd) <= 2;
    const prevStartTime = prevData[Math.max(0, Math.min(prevData.length - 1, prevStart))]?.time;
    const prevEndTime = prevData[Math.max(0, Math.min(prevData.length - 1, Math.max(prevStart, prevEnd - 1)))]?.time;
    const nextData = this.sliceRenderWindow(data, prevStartTime, prevEndTime);

    this.data = nextData;
    this.displayDataCache = null;
    this.displayDataCacheKey = '';
    this.invalidateDoubleBreakResultCache();
    this.lastPatternEvalSignature = '';
    this.lastPatternAlertByKey.clear();
    this.clearPatternPopups();
    this.clearConfirmedPatternBoxes();

    if (!prevData.length) {
      this.alignLatestCandleToAxisStart(Math.min(80, data.length));
    } else if (prevWasNearLatest) {
      this.alignLatestCandleToAxisStart(Math.min(prevVisible, data.length));
    } else {
      const findNearestIndexByTime = (targetTime: number): number => {
        if (!Number.isFinite(targetTime) || !this.data.length) return -1;
        let bestIdx = -1;
        let bestDiff = Number.POSITIVE_INFINITY;
        for (let i = 0; i < this.data.length; i += 1) {
          const t = Number(this.data[i]?.time);
          if (!Number.isFinite(t)) continue;
          const diff = Math.abs(t - targetTime);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }
        return bestIdx;
      };

      const mappedStart = Number.isFinite(prevStartTime) ? findNearestIndexByTime(prevStartTime as number) : -1;
      const mappedEnd = Number.isFinite(prevEndTime) ? findNearestIndexByTime(prevEndTime as number) : -1;
      if (mappedStart >= 0 && mappedEnd >= 0) {
        this.startIndex = Math.max(0, Math.min(mappedStart, mappedEnd));
        this.endIndex = Math.min(this.data.length, Math.max(this.startIndex + 1, Math.max(mappedStart, mappedEnd) + 1));
      } else {
        const prevRightDistance = Math.max(0, prevData.length - prevEnd);
        this.endIndex = Math.max(1, this.data.length - prevRightDistance);
        this.startIndex = Math.max(0, this.endIndex - prevVisible);
      }
      // Keep original zoom level when possible.
      if (this.endIndex - this.startIndex !== prevVisible) {
        this.endIndex = Math.min(this.data.length, this.startIndex + prevVisible);
        if (this.endIndex - this.startIndex < prevVisible) {
          this.startIndex = Math.max(0, this.endIndex - prevVisible);
        }
      }
    }

    this.mainPricePanOffset = 0;
    this.dmiScaleRange = null;
    if (this.getActiveStrategy()) {
      this.strategySignals = [];
      this.signalHitAreas = [];
      this.latestStrategySignalIndex = -1;
    }
    this.scheduleStrategyCompute(0, 300);
    this.draw();
  }

  public setVisibleCandles(candles: number) {
    const count = Math.max(5, Math.floor(candles));
    this.endIndex = this.data.length;
    this.startIndex = Math.max(0, this.endIndex - count);
    this.draw();
  }

  public setVisibleBySeconds(seconds: number) {
    const tfSec = TIMEFRAME_SECONDS[this.config.timeframe];
    this.setVisibleCandles(Math.max(5, Math.floor(seconds / tfSec)));
  }

  public setVisibleAll() {
    this.startIndex = 0;
    this.endIndex = this.data.length;
    this.draw();
  }

  public setVisibleByDateRange(fromSec: number, toSec: number) {
    if (!this.data.length) return;
    let from = 0;
    let to = this.data.length;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].time >= fromSec) { from = i; break; }
    }
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (this.data[i].time <= toSec) { to = i + 1; break; }
    }
    this.startIndex = Math.max(0, from);
    this.endIndex = Math.min(this.data.length, Math.max(this.startIndex + 2, to));
    this.draw();
  }

  private findNearestCandleIndexByEpochSec(epochSec: number): number {
    if (!this.data.length) return 0;
    if (!Number.isFinite(epochSec)) return Math.max(0, Math.min(this.data.length - 1, this.endIndex - 1));
    let lo = 0;
    let hi = this.data.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const t = Number(this.data[mid]?.time ?? 0);
      if (t < epochSec) lo = mid + 1;
      else if (t > epochSec) hi = mid - 1;
      else return mid;
    }
    const left = Math.max(0, Math.min(this.data.length - 1, hi));
    const right = Math.max(0, Math.min(this.data.length - 1, lo));
    const leftDiff = Math.abs(Number(this.data[left]?.time ?? 0) - epochSec);
    const rightDiff = Math.abs(Number(this.data[right]?.time ?? 0) - epochSec);
    return rightDiff < leftDiff ? right : left;
  }

  public goToDateTime(epochSec: number, label: string): void {
    if (!this.data.length || !Number.isFinite(epochSec)) return;
    const targetIndex = this.findNearestCandleIndexByEpochSec(epochSec);
    const visibleCount = Math.max(24, this.endIndex - this.startIndex);
    const geometry = this.getChartGeometry(this.viewportWidth, this.lastDrawMeta?.axisPad);
    const chartW = Math.max(1, geometry.chartWidth);
    const gapBars = Math.min(
      Math.max(0, this.config.layout.rightGapBars ?? 0),
      50 / Math.max(1, chartW / Math.max(1, visibleCount)),
    );
    const totalSp = chartW / (visibleCount + gapBars);
    const candleCenterOffset = totalSp * 0.4;
    const desiredX = this.viewportWidth * 0.5;
    const desiredLocal = ((desiredX - geometry.chartLeft - candleCenterOffset) / totalSp);
    let start = Math.max(0, Math.round(targetIndex - desiredLocal));
    if (start + visibleCount > this.data.length) {
      start = Math.max(0, this.data.length - visibleCount);
    }
    this.startIndex = start;
    this.endIndex = Math.min(this.data.length, Math.max(this.startIndex + 2, this.startIndex + visibleCount));
    this.leftPanBars = 0;
    this.gotoDateMarker = {
      candleIndex: targetIndex,
      label: String(label || ''),
    };
    this.draw();
    this.focusSignalVisual(targetIndex, { showCrosshair: true });
  }

  private clearFocusVisualTimer(): void {
    if (this.focusVisualTimer == null) return;
    clearTimeout(this.focusVisualTimer);
    this.focusVisualTimer = null;
  }

  private clearTradeFocusVisual(): void {
    this.focusedTradeRange = null;
    this.focusedSignalCandleIndex = null;
    this.focusVisualStartedAt = 0;
    this.clearFocusVisualTimer();
    this.updateSignalAnimationLoop();
    this.drawSignalLayer(this.lastDrawMeta);
  }

  private shouldHideLivePriceOverlay(): boolean {
    return this.focusedTradeRange != null;
  }

  private getCandleCenterX(candleIndex: number): number | null {
    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const geometry = this.getChartGeometry(this.viewportWidth, this.lastDrawMeta?.axisPad);
    const chartW = geometry.chartWidth;
    const gapBars = Math.min(
      Math.max(0, this.config.layout.rightGapBars ?? 0),
      50 / Math.max(1, chartW / Math.max(1, this.endIndex - this.startIndex)),
    );
    const leftGap = Math.max(0, this.leftPanBars);
    const totalSp = chartW / (visibleCount + gapBars + leftGap);
    const candleW = Math.max(totalSp * 0.8, 1);
    const localIndex = candleIndex - this.startIndex;
    if (!Number.isFinite(localIndex) || localIndex < 0 || localIndex > visibleCount) return null;
    return geometry.chartLeft + (leftGap + localIndex) * totalSp + candleW / 2;
  }

  private focusSignalVisual(candleIndex: number, options?: { showCrosshair?: boolean; focusStyle?: 'range' | 'candle' }): void {
    const showCrosshair = options?.showCrosshair !== false;
    const clamped = Math.max(0, Math.min(this.data.length - 1, Math.floor(candleIndex)));
    this.focusedSignalCandleIndex = clamped;
    this.focusVisualStartedAt = Date.now();

    const signalIndexInRange = (() => {
      const lo = Math.max(0, Math.min(this.focusedTradeRange?.startIndex ?? clamped, this.focusedTradeRange?.endIndex ?? clamped));
      const hi = Math.min(this.data.length - 1, Math.max(this.focusedTradeRange?.startIndex ?? clamped, this.focusedTradeRange?.endIndex ?? clamped));
      for (let i = lo; i <= hi; i += 1) {
        if ((this.strategySignals[i] ?? 0) !== 0) return i;
      }
      return clamped;
    })();
    this.focusedSignalCandleIndex = signalIndexInRange;

    const x = this.getCandleCenterX(signalIndexInRange);
    if (x != null) this.mouseX = x;
    const focusY = this.lastDrawMeta
      ? Math.max(20, Math.min(this.lastDrawMeta.mainH - 20, this.lastDrawMeta.mainH * 0.35))
      : Math.max(20, this.viewportHeight * 0.35);
    this.mouseY = focusY;
    if (showCrosshair) {
      this.isMouseOver = true;
    } else {
      this.isMouseOver = false;
      this.crosshairPlusHit = null;
      this.crosshairPlusHovered = false;
      if (this.onCrosshairOHLC && this._lastCrosshairOHLCIdx !== -1) {
        this._lastCrosshairOHLCIdx = -1;
        this.onCrosshairOHLC(null);
      }
    }

    this.clearFocusVisualTimer();
    this.focusVisualTimer = setTimeout(() => {
      this.clearTradeFocusVisual();
      this.focusVisualTimer = null;
      this.requestOverlayDraw();
    }, SimpleChart.FOCUS_VISUAL_DURATION_MS);
  }

  public focusRangeByIndex(
    startIndex: number,
    endIndex: number,
    paddingBars = 8,
    options?: {
      showCrosshair?: boolean;
      focusStyle?: 'range' | 'candle';
      focusType?: 'box' | 'connector';
      preserveVisibleCount?: boolean;
      entryPrice?: number;
      exitPrice?: number;
      isProfit?: boolean;
    },
  ): void {
    if (!this.data.length) return;

    let normalizedRange;
    if (options?.preserveVisibleCount) {
      normalizedRange = this.moveViewportToIndexWithVisibleCount(startIndex, paddingBars);
    } else {
      normalizedRange = this.moveViewportToRange(startIndex, endIndex, paddingBars);
    }
    if (!normalizedRange) return;
    const lastIndex = this.data.length - 1;
    this.focusedTradeRange = {
      startIndex: Math.max(0, Math.min(lastIndex, normalizedRange.startIndex)),
      endIndex: Math.max(0, Math.min(lastIndex, normalizedRange.endIndex)),
      style: options?.focusStyle ?? 'range',
      type: options?.focusType ?? 'box',
      entryPrice: options?.entryPrice,
      exitPrice: options?.exitPrice,
      isProfit: options?.isProfit,
    };
    this.updateSignalAnimationLoop();
    this.draw();
    this.focusSignalVisual(this.focusedTradeRange.startIndex, options);
  }

  private moveViewportToIndexWithVisibleCount(
    targetIndex: number,
    paddingBars = 0,
  ): { startIndex: number; endIndex: number } | null {
    if (!this.data.length) return null;
    const lastIndex = this.data.length - 1;
    const clampedTarget = Math.max(0, Math.min(lastIndex, Math.floor(targetIndex)));
    const currentVisibleCount = Math.max(1, Math.min(this.data.length, this.endIndex - this.startIndex));
    const pad = Math.max(0, Math.floor(paddingBars));
    const desiredVisibleCount = Math.max(24, currentVisibleCount);
    const centerIndex = clampedTarget + pad;
    let lo = Math.round(centerIndex - desiredVisibleCount / 2);
    let hi = lo + desiredVisibleCount - 1;
    if (lo < 0) {
      hi = Math.min(lastIndex, hi - lo);
      lo = 0;
    }
    if (hi > lastIndex) {
      lo = Math.max(0, lo - (hi - lastIndex));
      hi = lastIndex;
    }
    this.startIndex = lo;
    this.endIndex = Math.max(this.startIndex + 1, hi + 1);
    this.focusedTradeRange = null;
    this.focusedSignalCandleIndex = null;
    this.focusVisualStartedAt = 0;
    this.clearFocusVisualTimer();
    return {
      startIndex: clampedTarget,
      endIndex: clampedTarget,
    };
  }

  private moveViewportToRange(
    startIndex: number,
    endIndex: number,
    paddingBars = 8,
  ): { startIndex: number; endIndex: number } | null {
    if (!this.data.length) return null;

    const lastIndex = this.data.length - 1;
    const normalizedStart = Number.isFinite(startIndex) ? Math.floor(startIndex) : 0;
    const normalizedEnd = Number.isFinite(endIndex) ? Math.floor(endIndex) : normalizedStart;
    const pad = Math.max(0, Math.floor(paddingBars));

    let lo = Math.max(0, Math.min(lastIndex, Math.min(normalizedStart, normalizedEnd)));
    let hi = Math.max(0, Math.min(lastIndex, Math.max(normalizedStart, normalizedEnd)));
    lo = Math.max(0, lo - pad);
    hi = Math.min(lastIndex, hi + pad);

    const minVisible = 24;
    let visibleCount = hi - lo + 1;
    if (visibleCount < minVisible) {
      const deficit = minVisible - visibleCount;
      const addLeft = Math.floor(deficit / 2);
      const addRight = deficit - addLeft;
      lo = Math.max(0, lo - addLeft);
      hi = Math.min(lastIndex, hi + addRight);
      visibleCount = hi - lo + 1;
      if (visibleCount < minVisible) {
        const remain = minVisible - visibleCount;
        if (lo === 0) hi = Math.min(lastIndex, hi + remain);
        else if (hi === lastIndex) lo = Math.max(0, lo - remain);
      }
    }

    this.startIndex = lo;
    this.endIndex = Math.max(this.startIndex + 1, hi + 1);
    this.focusedTradeRange = null;
    this.focusedSignalCandleIndex = null;
    this.focusVisualStartedAt = 0;
    this.clearFocusVisualTimer();
    return {
      startIndex: Math.max(0, Math.min(lastIndex, Math.min(normalizedStart, normalizedEnd))),
      endIndex: Math.max(0, Math.min(lastIndex, Math.max(normalizedStart, normalizedEnd))),
    };
  }

  /** 최신(가장 오른쪽) 캔들로 뷰포트 이동 */
  public jumpToLatest(): void {
    if (!this.data.length) return;
    const realVisibleCount = Math.max(
      10,
      Math.min(this.data.length, Math.min(this.endIndex, this.data.length) - this.startIndex),
    );
    const futureSlots = this.getFutureSlotsForLatestAtAxisStart(realVisibleCount);
    this.startIndex = Math.max(0, this.data.length - realVisibleCount);
    this.endIndex = this.data.length + futureSlots;
    this.leftPanBars = 0;
    this.draw();
  }

  private getFutureSlotsForLatestAtAxisStart(realVisibleCount: number): number {
    const geometry = this.getChartGeometry(this.viewportWidth, this.lastDrawMeta?.axisPad);
    if (geometry.side !== 'right') return 0;
    const realCount = Math.max(1, Math.min(this.data.length || 1, Math.floor(realVisibleCount)));
    const chartW = Math.max(1, geometry.chartWidth);
    const opaqueChartW = Math.max(1, geometry.axisLeft - geometry.chartLeft);
    const opaqueGapBars = Math.min(
      Math.max(0, this.config.layout.rightGapBars ?? 0),
      50 / Math.max(1, opaqueChartW / Math.max(1, realCount)),
    );
    const opaqueTotalSp = opaqueChartW / Math.max(1, realCount + opaqueGapBars);
    const opaqueCandleW = Math.max(opaqueTotalSp * 0.8, 1);
    const targetX = geometry.chartLeft + (realCount - 1) * opaqueTotalSp + opaqueCandleW;
    const maxSlots = Math.max(8, Math.min(500, Math.ceil(realCount * 0.35)));
    let bestSlots = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let futureSlots = 0; futureSlots <= maxSlots; futureSlots += 1) {
      const visibleSlots = realCount + futureSlots;
      const gapBars = Math.min(
        Math.max(0, this.config.layout.rightGapBars ?? 0),
        50 / Math.max(1, chartW / Math.max(1, visibleSlots)),
      );
      const totalSp = chartW / Math.max(1, visibleSlots + gapBars);
      const candleW = Math.max(totalSp * 0.8, 1);
      const latestRightX = geometry.chartLeft + (realCount - 1) * totalSp + candleW;
      const delta = Math.abs(latestRightX - targetX);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestSlots = futureSlots;
      }
      if (latestRightX <= targetX) break;
    }
    return bestSlots;
  }

  /** 뷰포트를 좌/우로 이동 (음수: 왼쪽, 양수: 오른쪽) */
  public panViewport(shiftBars: number): void {
    if (!this.data.length) return;
    const shift = Number.isFinite(shiftBars) ? Math.trunc(shiftBars) : 0;
    if (!shift) return;
    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const baseVirtualStart = this.startIndex - this.leftPanBars;
    const virtualStart = this.normalizeHorizontalVirtualStart(baseVirtualStart + shift, baseVirtualStart);
    this.applyHorizontalPan(virtualStart, visibleCount);
    this.requestMainDraw();
  }

  /** 캔들 표시 개수 기반 확대/축소 (음수: 확대, 양수: 축소) */
  public zoomByCandles(deltaVisible: number): void {
    if (!this.data.length) return;
    const delta = Number.isFinite(deltaVisible) ? Math.trunc(deltaVisible) : 0;
    if (!delta) return;
    const minVisible = 5;
    const maxVisible = this.data.length;
    const currentVisible = Math.max(minVisible, this.endIndex - this.startIndex);
    const nextVisible = Math.max(minVisible, Math.min(maxVisible, currentVisible + delta));
    this.endIndex = this.data.length;
    this.startIndex = Math.max(0, this.endIndex - nextVisible);
    this.leftPanBars = 0;
    this.requestMainDraw();
  }

  public getVisibleCandleRange(): { startIndex: number; endIndex: number } {
    return { startIndex: this.startIndex, endIndex: this.endIndex };
  }

  public get totalCandleCount(): number { return this.data.length; }

  public setLeftPanEnabled(enabled: boolean): void {
    (this.config.layout as any).leftPanEnabled = enabled === true;
    this.leftPanBars = 0;
    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const ns = this.clampPanStartIndex(this.startIndex, visibleCount);
    this.startIndex = ns;
    this.endIndex = ns + visibleCount;
    this.draw();
  }

  public setVerticalPanEnabled(enabled: boolean): void {
    (this.config.layout as any).verticalPanEnabled = enabled === true;
    if (!(this.config.layout as any).verticalPanEnabled) {
      this.mainPricePanOffset = 0;
    }
    this.draw();
  }

  public setMobileCrosshairTooltipEnabled(enabled: boolean): void {
    (this.config.layout as any).mobileCrosshairTooltipEnabled = enabled !== false;
    this.draw();
  }

  public setYAxisTransparentBackground(enabled: boolean): void {
    (this.config.layout as any).yAxisTransparentBackground = enabled !== false;
    this.draw();
  }

  public setPointerMode(mode: 'auto' | 'cross' | 'dot' | 'arrow' | 'demo'): void {
    this.pointerMode = mode;
    this.updateChartCursor();
    this.draw();
  }

  private startMouseLongPressTooltip(): void {
    this.stopMouseLongPressTooltip();
    if (!this.isMobileCrosshairTooltipEnabled()) return;
    if (this.drawingTool || this.selectedDrawingId || this.drawingMoveState || this.isDragging) return;
    this.mouseLongPressTooltipTimer = setTimeout(() => {
      this.mouseLongPressTooltipTimer = null;
      if (!this.isMouseDownForTooltip) return;
      if (this.drawingTool || this.selectedDrawingId || this.drawingMoveState || this.isDragging) return;
      this.mouseLongPressTooltipActive = true;
      this.requestOverlayDraw();
    }, SimpleChart.MOUSE_TOOLTIP_LONGPRESS_MS);
  }

  private stopMouseLongPressTooltip(): void {
    if (this.mouseLongPressTooltipTimer) {
      clearTimeout(this.mouseLongPressTooltipTimer);
      this.mouseLongPressTooltipTimer = null;
    }
    if (this.mouseLongPressTooltipActive) {
      this.mouseLongPressTooltipActive = false;
      this.requestOverlayDraw();
    }
  }

  private clampPanStartIndex(startIndex: number, visibleCount: number): number {
    if (visibleCount <= 0) return 0;
    const dataLength = this.data.length;
    const leftPanEnabled = Boolean((this.config.layout as any).leftPanEnabled);
    const maxStart = leftPanEnabled
      // Keep at least one real candle visible so draw/overlay layers never lose anchor data.
      ? Math.max(0, dataLength - 1)
      : Math.max(0, dataLength - visibleCount);
    return Math.max(0, Math.min(maxStart, startIndex));
  }

  /** 가상 시작 인덱스(음수 가능)를 적용 ? 좌측 여백 처리 포함 */
  private applyHorizontalPan(virtualStart: number, visibleCount: number): boolean {
    // Right-shift(empty-left) is intentionally disabled.
    const newLeft = 0;
    const ns = this.clampPanStartIndex(virtualStart, visibleCount);
    const changed = ns !== this.startIndex || newLeft !== this.leftPanBars;
    this.leftPanBars = newLeft;
    this.startIndex = ns;
    this.endIndex = ns + visibleCount;
    return changed;
  }

  private isLeftPanEnabled(): boolean {
    return Boolean((this.config.layout as any).leftPanEnabled);
  }

  private isVerticalPanEnabled(): boolean {
    return Boolean((this.config.layout as any).verticalPanEnabled);
  }

  // When left-pan is OFF:
  // - right-move (<) is always allowed
  // - restore-move (>) is allowed only until latest-anchor (no right-side gap)
  private normalizeHorizontalVirtualStart(virtualStart: number, baseVirtualStart: number): number {
    if (this.isLeftPanEnabled()) return virtualStart;
    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const latestAnchorStart = Math.max(0, this.data.length - visibleCount);
    // Attempting to move toward latest-anchor direction (>)
    if (virtualStart >= baseVirtualStart) {
      if (baseVirtualStart >= latestAnchorStart) return baseVirtualStart;
      return Math.min(virtualStart, latestAnchorStart);
    }
    // Opposite direction (<): always allow
    return virtualStart;
  }

  private isMobileCrosshairTooltipEnabled(): boolean {
    return (this.config.layout as any).mobileCrosshairTooltipEnabled !== false;
  }

  private getMainPricePerPixel(): number {
    const range = Math.max(1e-12, (this.lastDrawMeta?.maxP ?? 1) - (this.lastDrawMeta?.minP ?? 0));
    const plotHeight = Math.max(1, (this.lastDrawMeta?.mainH ?? this.viewportHeight) - 10);
    return range / plotHeight;
  }

  public updateLastCandle(td: Partial<CandleData>) {
    const i = this.data.length - 1;
    this.data[i] = { ...this.data[i], ...td };
    this.displayDataCache = null;
    this.displayDataCacheKey = '';
    this.invalidateDoubleBreakResultCache();
    this.scheduleStrategyCompute(Math.max(0, i - 1), 50);
    this.draw();
  }

  public addNewCandle(c: CandleData) {
    this.data.push(c);
    this.displayDataCache = null;
    this.displayDataCacheKey = '';
    this.invalidateDoubleBreakResultCache();
    this.endIndex++; this.startIndex++;
    this.scheduleStrategyCompute(Math.max(0, this.data.length - 3), 50);
    this.draw();
  }

  public setGapMode(mode: GapMode): void {
    const next: GapMode = mode === 'smooth' ? 'smooth' : 'raw';
    if (this.gapMode === next) return;
    this.gapMode = next;
    this.displayDataCache = null;
    this.displayDataCacheKey = '';
    this.draw();
  }

  public getPatternAnalysisScope(): PatternAnalysisScope {
    return this.config.patternAnalysisScope === 'visible-only' ? 'visible-only' : 'lookback';
  }

  public isPatternAlertEnabled(): boolean {
    return this.config.patternAlertsEnabled !== false;
  }

  public setPatternAlertEnabled(enabled: boolean): void {
    const next = enabled !== false;
    if (this.config.patternAlertsEnabled === next) return;
    this.config.patternAlertsEnabled = next;
    this.lastPatternEvalSignature = '';
    this.lastPatternAlertByKey.clear();
    this.clearPatternPopups();
    this.clearConfirmedPatternBoxes();
    this.draw();
  }

  public setPatternAnalysisScope(scope: PatternAnalysisScope): void {
    const next: PatternAnalysisScope = scope === 'visible-only' ? 'visible-only' : 'lookback';
    if (this.config.patternAnalysisScope === next) return;
    this.config.patternAnalysisScope = next;
    this.lastPatternEvalSignature = '';
    this.lastPatternAlertByKey.clear();
    this.clearPatternPopups();
    this.clearConfirmedPatternBoxes();
    this.draw();
  }

  private getDisplayCandles(): CandleData[] {
    if (this.gapMode !== 'smooth') return this.data;
    const len = this.data.length;
    const first = len > 0 ? this.data[0] : null;
    const last = len > 0 ? this.data[len - 1] : null;
    const key = [
      this.gapMode,
      len,
      first?.time ?? 0,
      first?.open ?? 0,
      first?.close ?? 0,
      last?.time ?? 0,
      last?.open ?? 0,
      last?.close ?? 0,
    ].join('|');
    if (this.displayDataCache && this.displayDataCacheKey === key) return this.displayDataCache;
    this.displayDataCache = applyGapSmoothing(this.data);
    this.displayDataCacheKey = key;
    return this.displayDataCache;
  }

  public resize() {
    const p = this.canvas.parentElement!;
    const nextViewportWidth = p.clientWidth;
    const nextViewportHeight = p.clientHeight;
    const nextPixelRatio = Math.max(1, Math.min(MAX_CANVAS_PIXEL_RATIO, window.devicePixelRatio || 1));

    const backingWidth = Math.floor(nextViewportWidth * nextPixelRatio);
    const backingHeight = Math.floor(nextViewportHeight * nextPixelRatio);
    const unchanged = this.viewportWidth === nextViewportWidth
      && this.viewportHeight === nextViewportHeight
      && this.pixelRatio === nextPixelRatio
      && this.canvas.width === backingWidth
      && this.canvas.height === backingHeight;
    if (unchanged) return;

    this.viewportWidth = nextViewportWidth;
    this.viewportHeight = nextViewportHeight;
    this.pixelRatio = nextPixelRatio;

    [this.canvas, this.signalCanvas, this.overlayCanvas].forEach((canvas) => {
      canvas.style.width = `${this.viewportWidth}px`;
      canvas.style.height = `${this.viewportHeight}px`;
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    });

    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.signalCtx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.overlayCtx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    this.draw();
    this.onAfterResize?.();
    this.syncDrawingToolbar();
  }

  private snapToDevice(value: number): number {
    return Math.round(value * this.pixelRatio) / this.pixelRatio;
  }

  private snapStrokeCenter(value: number, lineWidth = 1): number {
    const lineWidthDevicePx = Math.max(1, Math.round(lineWidth * this.pixelRatio));
    const centerOffset = lineWidthDevicePx % 2 === 0 ? 0 : 0.5;
    return (Math.round(value * this.pixelRatio) + centerOffset) / this.pixelRatio;
  }

  private snapSize(value: number, minCssPx = 1): number {
    const min = minCssPx / this.pixelRatio;
    return Math.max(min, Math.round(value * this.pixelRatio) / this.pixelRatio);
  }

  private getIndicatorSourceData(): CandleData[] {
    return this.data;
  }

  // 지표 계산 함수

  private calcMA(period: number): (number | null)[] {
    return calculateMa(this.getIndicatorSourceData(), period);
  }

  private calcEMA(period: number): (number | null)[] {
    return calculateEma(this.getIndicatorSourceData(), period);
  }

  private calcHMA(period: number): (number | null)[] {
    return calculateHma(this.getIndicatorSourceData(), period);
  }

  private calcATR(period: number): (number | null)[] {
    return calculateAtr(this.getIndicatorSourceData(), period);
  }

  private calcRSI(period: number): (number | null)[] {
    return calculateRsi(this.getIndicatorSourceData(), period);
  }

  private calcBB(period: number, mult: number) {
    return calculateBb(this.getIndicatorSourceData(), period, mult);
  }

  private calcDMI(period: number) {
    return calculateDmi(this.getIndicatorSourceData(), period);
  }

  private calcMACD(fast: number, slow: number, sig: number) {
    return calculateMacd(this.getIndicatorSourceData(), fast, slow, sig);
  }

  private sma(src: (number | null)[], p: number): (number | null)[] {
    return src.map((_, i) => {
      const sl = src.slice(Math.max(0, i - p + 1), i + 1).filter(v => v != null) as number[];
      return sl.length === p ? sl.reduce((a, b) => a + b) / p : null;
    });
  }

  private calcStoch(kp: number, dp: number) {
    return calculateStochastic(this.getIndicatorSourceData(), kp, dp);
  }

  private calcCCI(period: number): (number | null)[] {
    return calculateCci(this.getIndicatorSourceData(), period);
  }

  private calcCVD(): number[] {
    return calculateCvd(this.getIndicatorSourceData());
  }

  private calcOBV(): number[] {
    return calculateObv(this.getIndicatorSourceData());
  }

  private getEmptyVwapResult(): VwapResult {
    return {
      vwap: [],
      anchorStarts: [],
      bands: {
        upper: [[], [], []],
        lower: [[], [], []],
      },
    };
  }

  private calcVWAP(): VwapResult {
    const vwapOptions = this.config.indicators.vwap as VwapOptions & { sessionTimezone?: string };
    const multipliers: [number, number, number] = [
      Math.max(0, Number((vwapOptions as any).bandMultiplier1 ?? 1) || 1),
      Math.max(0, Number((vwapOptions as any).bandMultiplier2 ?? 2) || 2),
      Math.max(0, Number((vwapOptions as any).bandMultiplier3 ?? 3) || 3),
    ];
    return calculateVwapWithBands(this.getIndicatorSourceData(), {
      ...vwapOptions,
      anchorPeriod: vwapOptions.anchorPeriod ?? 'session',
      bandMultipliers: multipliers,
      sessionTimezone: vwapOptions.sessionTimezone === 'auto' || !vwapOptions.sessionTimezone
        ? getExchangeSessionTimezoneForSymbol(this.config.symbol)
        : vwapOptions.sessionTimezone,
    });
  }

  private calcAtrAtIndex(index: number, period: number): number | null {
    if (!this.data.length || index < 0 || index >= this.data.length) return null;
    const p = Math.max(1, Math.round(period));
    const start = Math.max(0, index - p + 1);
    let sum = 0;
    let count = 0;
    for (let i = start; i <= index; i += 1) {
      const candle = this.data[i];
      if (!candle) continue;
      if (i === 0) {
        sum += candle.high - candle.low;
      } else {
        const prevClose = this.data[i - 1]?.close ?? candle.close;
        sum += Math.max(
          candle.high - candle.low,
          Math.abs(candle.high - prevClose),
          Math.abs(candle.low - prevClose),
        );
      }
      count += 1;
    }
    return count > 0 ? sum / count : null;
  }

  private getVwapInteractionResult(): VwapResult {
    if (this.lastVwapResult && this.lastVwapResult.vwap.length === this.data.length) {
      return this.lastVwapResult;
    }
    const result = this.calcVWAP();
    this.lastVwapResult = result;
    return result;
  }

  private shouldRenderVWAP(): boolean {
    const vwap = this.config.indicators.vwap as { show?: boolean; hideOnDailyOrAbove?: boolean };
    if (!vwap.show) return false;
    if (!vwap.hideOnDailyOrAbove) return true;
    return (TIMEFRAME_SECONDS[this.config.timeframe as TimeframeKey] ?? 0) < 86400;
  }

  private getVisibleVwapBandValues(bands: VwapBands, index: number): Array<number | null> {
    const settings = this.config.indicators.vwap as Record<string, any>;
    const values: Array<number | null> = [];
    [0, 1, 2].forEach((bandIndex) => {
      const bandNumber = bandIndex + 1;
      if (settings[`showUpperBand${bandNumber}`] === true) values.push(bands.upper[bandIndex][index] ?? null);
      if (settings[`showLowerBand${bandNumber}`] === true) values.push(bands.lower[bandIndex][index] ?? null);
    });
    return values;
  }

  private getVwapSeriesData(result: VwapResult, seriesKey: string): Array<number | null> | null {
    if (seriesKey === 'vwap') return result.vwap;
    const match = seriesKey.match(/^vwap(Upper|Lower)([123])$/);
    if (!match) return null;
    const bandIndex = Number(match[2]) - 1;
    return match[1] === 'Upper' ? result.bands.upper[bandIndex] : result.bands.lower[bandIndex];
  }

  private getVisibleVwapSeries(result: VwapResult): Array<{ key: string; data: Array<number | null>; fallbackColor: string }> {
    const settings = this.config.indicators.vwap as Record<string, any>;
    const series: Array<{ key: string; data: Array<number | null>; fallbackColor: string }> = [];
    if (this.isIndicatorLineVisible('vwap')) {
      series.push({ key: 'vwap', data: result.vwap, fallbackColor: '#ff9800' });
    }
    [0, 1, 2].forEach((bandIndex) => {
      const bandNumber = bandIndex + 1;
      const fallbackColor = bandIndex === 0 ? 'rgba(255,152,0,0.62)' : bandIndex === 1 ? 'rgba(255,193,7,0.52)' : 'rgba(255,214,10,0.45)';
      const upperKey = `vwapUpper${bandNumber}`;
      const lowerKey = `vwapLower${bandNumber}`;
      if (settings[`showUpperBand${bandNumber}`] === true && this.isIndicatorLineVisible(upperKey)) {
        series.push({ key: upperKey, data: result.bands.upper[bandIndex], fallbackColor });
      }
      if (settings[`showLowerBand${bandNumber}`] === true && this.isIndicatorLineVisible(lowerKey)) {
        series.push({ key: lowerKey, data: result.bands.lower[bandIndex], fallbackColor });
      }
    });
    return series;
  }

  private findVwapLineHit(mx: number, my: number): boolean {
    if (!this.indicatorsVisible || !this.shouldRenderVWAP()) return false;
    const metrics = this.getMainViewportMetrics();
    if (!metrics || mx < metrics.chartLeft || mx > metrics.chartRight || my < metrics.top || my > metrics.mainH) return false;
    const result = this.getVwapInteractionResult();
    const threshold = Math.max(6, Math.min(12, metrics.candleW * 0.7));
    let hit = false;
    this.getVisibleVwapSeries(result).forEach((series) => {
      if (hit) return;
      for (let dataIndex = this.startIndex; dataIndex < this.endIndex - 1; dataIndex += 1) {
        const left = series.data[dataIndex];
        const right = series.data[dataIndex + 1];
        if (left == null || right == null) continue;
        const visibleIndex = dataIndex - this.startIndex;
        const x1 = metrics.effectiveChartLeft + visibleIndex * metrics.totalSp + metrics.candleW / 2;
        const x2 = metrics.effectiveChartLeft + (visibleIndex + 1) * metrics.totalSp + metrics.candleW / 2;
        const distance = pointToSegmentDistanceUtil(mx, my, x1, metrics.getY(left), x2, metrics.getY(right));
        if (distance <= threshold) {
          hit = true;
          break;
        }
      }
    });
    return hit;
  }

  private getVwapAnchorMarkerIndices(result: VwapResult): number[] {
    const visibleIndices: number[] = [];
    for (let dataIndex = this.startIndex; dataIndex < this.endIndex; dataIndex += 1) {
      if (result.vwap[dataIndex] != null) visibleIndices.push(dataIndex);
    }
    if (visibleIndices.length <= 1) return visibleIndices;
    const desiredMarkers = Math.min(7, Math.max(3, Math.floor(visibleIndices.length / 24) + 2));
    const lastSlot = Math.max(1, desiredMarkers - 1);
    const markerIndices: number[] = [];
    for (let slot = 0; slot < desiredMarkers; slot += 1) {
      const sourceIndex = Math.round((slot * (visibleIndices.length - 1)) / lastSlot);
      const dataIndex = visibleIndices[sourceIndex];
      if (dataIndex != null && markerIndices[markerIndices.length - 1] !== dataIndex) {
        markerIndices.push(dataIndex);
      }
    }
    return markerIndices;
  }

  private isVwapAnchorSelectionHit(mx: number, my: number): boolean {
    const selection = this.vwapAnchorSelection;
    if (!selection?.active || !this.shouldRenderVWAP()) return false;
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return false;
    const result = this.getVwapInteractionResult();
    const markerIndices = this.getVwapAnchorMarkerIndices(result);
    const seriesList = this.getVisibleVwapSeries(result);
    return markerIndices.some((dataIndex) => {
      const visibleIndex = dataIndex - this.startIndex;
      const markerX = metrics.effectiveChartLeft + visibleIndex * metrics.totalSp + metrics.candleW / 2;
      if (markerX < metrics.chartLeft - 8 || markerX > metrics.chartRight + 8) return false;
      return seriesList.some((series) => {
        const value = series.data[dataIndex];
        return value != null && Math.hypot(mx - markerX, my - metrics.getY(value)) <= 12;
      });
    });
  }

  private openVwapSettingsFromAnchor(): void {
    this.canvas.dispatchEvent(new CustomEvent('chart-open-indicator-settings', {
      bubbles: true,
      detail: { indicatorKey: 'vwap' },
    }));
  }

  private drawVwapAnchorSelection(
    ctx: CanvasRenderingContext2D,
    result: VwapResult,
    getY: (price: number) => number,
    chartLeft: number,
    chartRight: number,
    effectiveChartLeft: number,
    totalSp: number,
    candleW: number,
    top: number,
    bottom: number,
  ): void {
    const selection = this.vwapAnchorSelection;
    if (!selection?.active || !this.shouldRenderVWAP()) return;
    const markerIndices = this.getVwapAnchorMarkerIndices(result);
    const seriesList = this.getVisibleVwapSeries(result);
    if (!markerIndices.length || !seriesList.length) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(chartLeft, top, Math.max(1, chartRight - chartLeft), Math.max(1, bottom - top));
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    ctx.setLineDash([]);
    markerIndices.forEach((dataIndex) => {
      const visibleIndex = dataIndex - this.startIndex;
      const markerX = effectiveChartLeft + visibleIndex * totalSp + candleW / 2;
      if (markerX < chartLeft - 8 || markerX > chartRight + 8) return;
      seriesList.forEach((series) => {
        const value = series.data[dataIndex];
        if (value == null) return;
        const markerY = getY(value);
        if (markerY < top || markerY > bottom) return;
        const style = this.resolveStyle(series.key, series.fallbackColor, 1.5);
        ctx.strokeStyle = style.color;
        ctx.fillStyle = '#0f172a';
        ctx.lineWidth = Math.max(1.4, style.width + 0.45);
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    });
    ctx.restore();
  }

  private getAnchoredVwapSeries(anchorIndex: number): Array<{ index: number; price: number }> {
    const start = Math.max(0, Math.min(this.data.length - 1, Math.round(anchorIndex)));
    if (!this.data.length || start >= this.data.length) return [];
    const points: Array<{ index: number; price: number }> = [];
    let cumulativePriceVolume = 0;
    let cumulativeVolume = 0;
    for (let i = start; i < this.data.length; i += 1) {
      const candle = this.data[i];
      const volume = Number(candle?.volume ?? 0);
      if (!Number.isFinite(volume) || volume < 0) continue;
      cumulativePriceVolume += ((candle.high + candle.low + candle.close) / 3) * volume;
      cumulativeVolume += volume;
      if (cumulativeVolume <= 0) continue;
      points.push({
        index: i,
        price: cumulativePriceVolume / cumulativeVolume,
      });
    }
    return points;
  }

  private getDefaultAnchoredVwapSettings(): AnchoredVwapSettings {
    return {
      source: 'hlc3',
      bandMode: 'standard-deviation',
      showLine: true,
      showPriceLabels: true,
      showBackground: true,
      backgroundColor: '#22ab94',
      backgroundOpacity: 14,
      bands: [
        { enabled: true, multiplier: 1, color: '#4caf50', visible: true },
        { enabled: false, multiplier: 2, color: '#9a9800', visible: true },
        { enabled: false, multiplier: 3, color: '#0f9488', visible: true },
      ],
    };
  }

  private cloneAnchoredVwapSettings(settings?: AnchoredVwapSettings | null): AnchoredVwapSettings {
    const base = settings ?? this.getDefaultAnchoredVwapSettings();
    return {
      ...base,
      bands: base.bands.map((band) => ({ ...band })) as AnchoredVwapSettings['bands'],
    };
  }

  private getAnchoredVwapSourceValue(candle: CandleData, source: AnchoredVwapSource): number {
    switch (source) {
      case 'open': return candle.open;
      case 'high': return candle.high;
      case 'low': return candle.low;
      case 'hl2': return (candle.high + candle.low) / 2;
      case 'ohlc4': return (candle.open + candle.high + candle.low + candle.close) / 4;
      case 'hlc3':
      default:
        return (candle.high + candle.low + candle.close) / 3;
      case 'close':
        return candle.close;
    }
  }

  private getAnchoredVwapPlot(shape: DrawingShape): Array<{
    index: number;
    vwap: number;
    stdDev: number;
  }> {
    const start = Math.max(0, Math.min(this.data.length - 1, Math.round(shape.a.index)));
    if (!this.data.length || start >= this.data.length) return [];
    const source = shape.avwap?.source ?? 'hlc3';
    let weightedSum = 0;
    let weightedSquareSum = 0;
    let weightedVolume = 0;
    const points: Array<{ index: number; vwap: number; stdDev: number }> = [];
    for (let i = start; i < this.data.length; i += 1) {
      const candle = this.data[i];
      const volume = Number(candle?.volume ?? 0);
      if (!Number.isFinite(volume) || volume < 0) continue;
      const sourceValue = this.getAnchoredVwapSourceValue(candle, source);
      weightedSum += sourceValue * volume;
      weightedSquareSum += sourceValue * sourceValue * volume;
      weightedVolume += volume;
      if (weightedVolume <= 0) continue;
      const vwap = weightedSum / weightedVolume;
      const variance = Math.max(0, (weightedSquareSum / weightedVolume) - (vwap * vwap));
      points.push({
        index: i,
        vwap,
        stdDev: Math.sqrt(variance),
      });
    }
    return points;
  }

  private createAnchoredVwapDrawing(anchor: DrawingAnchor): DrawingShape {
    return createAnchoredVwapDrawing({
      anchor,
      settings: this.getDefaultAnchoredVwapSettings(),
    });
  }

  private calcIchimoku(tenkan: number, kijun: number, senkou: number) {
    return calculateIchimoku(this.getIndicatorSourceData(), tenkan, kijun, senkou);
  }

  private calcEnvelope(period: number, pct: number) {
    return calculateEnvelope(this.getIndicatorSourceData(), period, pct);
  }

  private getEmptyAtrTrailingEmaSignalResult(): AtrTrailingEmaSignalResult {
    return {
      atr: [],
      atrStop: [],
      signalEma: [],
      trendEma: [],
      position: [],
      buySignal: [],
      sellSignal: [],
    };
  }

  private calcAtrTrailingEmaSignal(settings: {
    mode?: AtrTrailingEmaSignalMode;
    sensitivity?: number;
    atrPeriod?: number;
    signalEmaLength?: number;
    trendEmaLength?: number;
  }): AtrTrailingEmaSignalResult {
    return calculateAtrTrailingEmaSignal(this.getIndicatorSourceData(), settings);
  }

  private calcAtrTrailingStopOrigin(settings: AtrTrailingStopOriginOptions): AtrTrailingEmaSignalResult {
    return calculateAtrTrailingStopOrigin(this.getIndicatorSourceData(), settings);
  }

  private getEmptyBbMtfKalmanSignalResult(): BbMtfKalmanSignalResult {
    return {
      ltfBasis: [],
      ltfUpper: [],
      ltfLower: [],
      htfBasis: [],
      htfUpper: [],
      htfLower: [],
      htfRawBasis: [],
      htfRawUpper: [],
      htfRawLower: [],
      buySignal: [],
      sellSignal: [],
      upperFillOpacity: [],
      lowerFillOpacity: [],
      htfCandleStartIndex: [],
      warning: null,
    };
  }

  private calcBbMtfKalmanSignal(settings: {
    htfTimeframe?: string;
    ltfLength?: number;
    ltfMult?: number;
    htfLength?: number;
    htfMult?: number;
    minOpacity?: number;
    maxOpacity?: number;
    colorOption?: BbMtfKalmanColorOption;
  }): BbMtfKalmanSignalResult {
    return calculateBbMtfKalmanSignal(this.getIndicatorSourceData(), {
      ...settings,
      chartTimeframe: this.config.timeframe,
    });
  }

  private calcSmartMoneyConcepts(settings: SmartMoneyConceptsSettings): SmartMoneyConceptsResult {
    if (!settings.show) return EMPTY_SMART_MONEY_CONCEPTS_RESULT;
    const cacheKey = buildSmartMoneyConceptsCacheKey(this.data, settings);
    if (cacheKey === this.smartMoneyConceptsCacheKey) return this.smartMoneyConceptsCache;
    this.smartMoneyConceptsCacheKey = cacheKey;
    this.smartMoneyConceptsCache = calculateSmartMoneyConcepts(this.data, settings);
    return this.smartMoneyConceptsCache;
  }

  private calcEmaSeries(values: (number | null)[], period: number): (number | null)[] {
    const p = Math.max(1, Math.floor(Number(period) || 1));
    const out: (number | null)[] = new Array(values.length).fill(null);
    if (!values.length) return out;
    const k = 2 / (p + 1);
    let seedIndex = -1;
    for (let i = p - 1; i < values.length; i += 1) {
      let sum = 0;
      let valid = true;
      for (let j = i - p + 1; j <= i; j += 1) {
        const v = values[j];
        if (v == null || !Number.isFinite(v)) {
          valid = false;
          break;
        }
        sum += v;
      }
      if (valid) {
        out[i] = sum / p;
        seedIndex = i;
        break;
      }
    }
    if (seedIndex < 0) return out;
    let prev = out[seedIndex]!;
    for (let i = seedIndex + 1; i < values.length; i += 1) {
      const v = values[i];
      if (v == null || !Number.isFinite(v)) {
        out[i] = null;
        continue;
      }
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  private calcAtrRma(period: number): (number | null)[] {
    const source = this.getIndicatorSourceData();
    const p = Math.max(1, Math.floor(Number(period) || 1));
    const out: (number | null)[] = new Array(source.length).fill(null);
    if (!source.length) return out;
    const tr: number[] = new Array(source.length).fill(0);
    for (let i = 0; i < source.length; i += 1) {
      const c = source[i];
      if (i === 0) tr[i] = c.high - c.low;
      else {
        const prevClose = source[i - 1].close;
        tr[i] = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
      }
    }
    if (source.length < p) return out;
    let seed = 0;
    for (let i = 0; i < p; i += 1) seed += tr[i];
    seed /= p;
    out[p - 1] = seed;
    let prev = seed;
    for (let i = p; i < source.length; i += 1) {
      prev = ((prev * (p - 1)) + tr[i]) / p;
      out[i] = prev;
    }
    return out;
  }

  private calcZeroLagMaTrendLevels(length: number) {
    const source = this.getIndicatorSourceData();
    const n = source.length;
    const p = Math.max(1, Math.floor(Number(length) || 15));
    const closes = source.map((d) => d.close);
    const closeSeries = closes.map((v) => (Number.isFinite(v) ? v : null));
    const emaValue = this.calcEmaSeries(closeSeries, p);
    const correction = closeSeries.map((v, i) => {
      const e = emaValue[i];
      if (v == null || e == null) return null;
      return v + (v - e);
    });
    const zlma = this.calcEmaSeries(correction, p);
    const atr = this.calcAtrRma(200);

    const signalUp: boolean[] = new Array(n).fill(false);
    const signalDn: boolean[] = new Array(n).fill(false);
    const zlmaColor: ('up' | 'down' | null)[] = new Array(n).fill(null);
    const emaColor: ('up' | 'down' | null)[] = new Array(n).fill(null);
    const breakUp: (number | null)[] = new Array(n).fill(null);
    const breakDown: (number | null)[] = new Array(n).fill(null);
    const boxes: Array<{
      left: number;
      right: number;
      leftX: number;
      rightX: number;
      top: number;
      bottom: number;
      isUp: boolean;
      price: number;
    }> = [];

    for (let i = 1; i < n; i += 1) {
      const z = zlma[i];
      const e = emaValue[i];
      const zPrev = zlma[i - 1];
      const ePrev = emaValue[i - 1];
      if (z != null && e != null && zPrev != null && ePrev != null) {
        signalUp[i] = zPrev <= ePrev && z > e;
        signalDn[i] = zPrev >= ePrev && z < e;
      }
      const z3 = i >= 3 ? zlma[i - 3] : null;
      if (z != null && z3 != null) {
        zlmaColor[i] = z > z3 ? 'up' : (z < z3 ? 'down' : null);
      }
      if (e != null && z != null) {
        emaColor[i] = e < z ? 'up' : 'down';
      }
    }

    let activeBoxIndex: number | null = null;
    for (let i = 0; i < n; i += 1) {
      const z = zlma[i];
      const a = atr[i];
      if (signalUp[i] && z != null && a != null) {
        const crossX = i;
        boxes.push({
          left: i,
          right: i + 4,
          leftX: crossX,
          rightX: i + 4,
          top: z,
          bottom: z - a,
          isUp: true,
          price: closes[i],
        });
        activeBoxIndex = boxes.length - 1;
      } else if (signalDn[i] && z != null && a != null) {
        const crossX = i;
        boxes.push({
          left: i,
          right: i + 4,
          leftX: crossX,
          rightX: i + 4,
          top: z + a,
          bottom: z,
          isUp: false,
          price: closes[i],
        });
        activeBoxIndex = boxes.length - 1;
      }
      if (activeBoxIndex != null) {
        boxes[activeBoxIndex].right = i + 4;
        boxes[activeBoxIndex].rightX = i + 4;
      }

      const checkSignals = signalUp[i] || signalDn[i];
      const prevCheckSignals = i > 0 ? (signalUp[i - 1] || signalDn[i - 1]) : false;
      if (activeBoxIndex != null && i > 0 && !checkSignals && !prevCheckSignals) {
        const box = boxes[activeBoxIndex];
        const highPrev = source[i - 1].high;
        const highCurr = source[i].high;
        const lowPrev = source[i - 1].low;
        const lowCurr = source[i].low;
        const e = emaValue[i];
        const z = zlma[i];
        // Match ta.crossunder(high, boxBottom) / ta.crossover(low, boxTop) semantics
        // as closely as possible: prev >= and current < (crossunder), prev <= and current > (crossover).
        const downCross = highPrev >= box.bottom && highCurr < box.bottom;
        const upCross = lowPrev <= box.top && lowCurr > box.top;
        if (downCross && e != null && z != null && e > z) {
          breakDown[i - 1] = source[i - 1].high;
        }
        if (upCross && e != null && z != null && e < z) {
          breakUp[i - 1] = source[i - 1].low;
        }
      }
    }

    return { emaValue, zlma, signalUp, signalDn, zlmaColor, emaColor, boxes, breakUp, breakDown };
  }

  private calcSupertrend(period: number, factor: number) {
    const source = this.getIndicatorSourceData();
    const n = source.length;
    const line: (number | null)[] = new Array(n).fill(null);
    const direction: number[] = new Array(n).fill(1);
    if (!n) return { line, direction };

    const tr = new Array(n).fill(0);
    const atr = new Array(n).fill(0);
    const finalUpper = new Array(n).fill(0);
    const finalLower = new Array(n).fill(0);

    for (let i = 0; i < n; i += 1) {
      const c = source[i];
      if (i === 0) {
        tr[i] = c.high - c.low;
        atr[i] = tr[i];
      } else {
        const prevClose = source[i - 1].close;
        tr[i] = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
      }

      const hl2 = (c.high + c.low) / 2;
      const upperBasic = hl2 + factor * atr[i];
      const lowerBasic = hl2 - factor * atr[i];

      if (i === 0) {
        finalUpper[i] = upperBasic;
        finalLower[i] = lowerBasic;
        direction[i] = 1;
      } else {
        const prevClose = source[i - 1].close;
        finalUpper[i] = (upperBasic < finalUpper[i - 1] || prevClose > finalUpper[i - 1]) ? upperBasic : finalUpper[i - 1];
        finalLower[i] = (lowerBasic > finalLower[i - 1] || prevClose < finalLower[i - 1]) ? lowerBasic : finalLower[i - 1];
        if (c.close > finalUpper[i - 1]) direction[i] = -1;
        else if (c.close < finalLower[i - 1]) direction[i] = 1;
        else direction[i] = direction[i - 1];
      }

      line[i] = direction[i] < 0 ? finalLower[i] : finalUpper[i];
    }
    return { line, direction };
  }

  private calcStatisticalTrailingStop(dataLength: number, distributionLength: number, baseLevel: number) {
    const source = this.getIndicatorSourceData();
    const n = source.length;
    const BEARISH = 0;
    const BULLISH = 1;

    const level: (number | null)[] = new Array(n).fill(null);
    const anchor: (number | null)[] = new Array(n).fill(null);
    const extreme: (number | null)[] = new Array(n).fill(null);
    const bias: (number | null)[] = new Array(n).fill(null);
    const newTrail: boolean[] = new Array(n).fill(false);
    const deltaSeries: (number | null)[] = new Array(n).fill(null);

    if (!n) return { level, anchor, extreme, bias, newTrail };

    // Pine source uses trueRange(10) directly.
    const trLength = 10;
    const normLength = Math.max(10, Math.floor(Number(distributionLength) || 100));
    const parsedBaseLevel = Math.max(0, Math.min(3, Math.floor(Number(baseLevel) || 2)));

    const trueRangeAt = (idx: number): number | null => {
      const start = idx - trLength + 1;
      const prevCloseIndex = idx - trLength - 1;
      if (start < 0 || prevCloseIndex < 0) return null;
      let hh = -Infinity;
      let ll = Infinity;
      for (let j = start; j <= idx; j += 1) {
        const c = source[j];
        if (!c) return null;
        hh = Math.max(hh, c.high);
        ll = Math.min(ll, c.low);
      }
      const prevClose = source[prevCloseIndex]?.close;
      if (!Number.isFinite(prevClose)) return null;
      return Math.max(hh - ll, Math.abs(hh - prevClose), Math.abs(ll - prevClose));
    };

    const trLog: (number | null)[] = new Array(n).fill(null);
    for (let i = 0; i < n; i += 1) {
      const tr = trueRangeAt(i);
      if (tr == null || tr <= 0) continue;
      trLog[i] = Math.log(tr);
    }

    const stdevSample = (arr: number[]): number => {
      const count = arr.length;
      if (count < 2) return 0;
      const mean = arr.reduce((acc, v) => acc + v, 0) / count;
      const variance = arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (count - 1);
      return Math.sqrt(Math.max(0, variance));
    };

    for (let i = 0; i < n; i += 1) {
      const start = i - normLength + 1;
      if (start < 0) continue;
      const window: number[] = [];
      for (let j = start; j <= i; j += 1) {
        const v = trLog[j];
        if (v == null || !Number.isFinite(v)) {
          window.length = 0;
          break;
        }
        window.push(v);
      }
      if (window.length !== normLength) continue;
      const avg = window.reduce((acc, v) => acc + v, 0) / window.length;
      const stdev = stdevSample(window);
      deltaSeries[i] = Math.exp(avg + parsedBaseLevel * stdev);
    }

    let currentBias = BEARISH;
    let currentLevel: number | null = null;
    let currentExtreme: number | null = null;
    let currentAnchor: number | null = null;

    for (let i = 0; i < n; i += 1) {
      const c = source[i];
      const delta = deltaSeries[i];
      const hlc3 = (c.high + c.low + c.close) / 3;

      if (currentLevel == null && delta != null) {
        currentLevel = currentBias === BEARISH
          ? hlc3 + delta
          : Math.max(hlc3 - delta, 0);
      }

      if (currentLevel != null && delta != null) {
        if (currentBias === BEARISH) {
          currentExtreme = currentExtreme == null ? c.low : Math.min(currentExtreme, c.low);
          currentLevel = Math.min(currentLevel, hlc3 + delta);
        } else {
          currentExtreme = currentExtreme == null ? c.high : Math.max(currentExtreme, c.high);
          currentLevel = Math.max(currentLevel, Math.max(hlc3 - delta, 0));
        }

        const trailTrigger = (currentBias === BEARISH && c.close >= currentLevel)
          || (currentBias === BULLISH && c.close <= currentLevel);

        if (trailTrigger) {
          currentAnchor = c.close;
          currentBias = currentBias === BEARISH ? BULLISH : BEARISH;
          currentLevel = currentBias === BEARISH
            ? hlc3 + delta
            : Math.max(hlc3 - delta, 0);
          currentExtreme = currentBias === BEARISH ? c.low : c.high;
          newTrail[i] = true;
        }
      }

      bias[i] = currentBias;
      level[i] = currentLevel;
      extreme[i] = currentExtreme;
      anchor[i] = currentAnchor;
    }

    return { level, anchor, extreme, bias, newTrail };
  }

  // 메인 렌더링

  public draw() {
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const ctx = this.ctx;
    const displayData = this.getDisplayCandles();
    const symbolPriceDigits = getSymbolPricePrecision(this.config.symbol, this.config.quoteCurrency);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    this.signalCtx.clearRect(0, 0, width, height);
    this.subIndicatorAlertHitAreas = [];
    if (!displayData.length || this.startIndex >= this.endIndex) {
      this.signalHitAreas = [];
      this.lastDrawMeta = null;
      this.lastVwapResult = null;
      this.requestOverlayDraw();
      return;
    }
    // Recover from stale pan state so render/overlay never run with an empty visible slice.
    const renderVisibleCount = Math.max(1, this.endIndex - this.startIndex);
    const normalizedStart = this.clampPanStartIndex(this.startIndex, renderVisibleCount);
    if (normalizedStart !== this.startIndex) {
      this.startIndex = normalizedStart;
      this.endIndex = this.startIndex + renderVisibleCount;
    }

    const plotHeight = Math.max(40, height - X_AXIS_HEIGHT);

    // 가격 텍스트 폭을 측정해 축 너비를 동적 계산
    let dynamicAxisPad = this.config.layout.rightPadding;
    {
      const quickVis = displayData.slice(this.startIndex, this.endIndex);
      let quickMax = -Infinity;
      quickVis.forEach(d => { quickMax = Math.max(quickMax, d.high); });
      if (isFinite(quickMax)) {
        ctx.font = `400 11px ${CHART_FONT_STACK}`;
        const measured = ctx.measureText(formatWithComma(quickMax, symbolPriceDigits)).width;
        const minRef = ctx.measureText(formatWithComma(99.99, 2)).width;
        dynamicAxisPad = Math.max(44, Math.ceil(Math.max(measured, minRef) + 16));
      }
    }
    const geometry = this.getChartGeometry(width, dynamicAxisPad);
    const R     = { top: 10 };
    const panels = this.activePanels;
    const hiddenPanels = new Set<string>(((this.config.panelState as any).hiddenPanels ?? []) as string[]);
    const subRat = panels.reduce((s, id) => s + this.getPanelRatio(id), 0);
    const mainH  = plotHeight * (1 - subRat);
    const chartLeft = geometry.chartLeft;
    const chartRight = geometry.chartRight;
    const chartW = geometry.chartWidth;
    const subAxisStart = geometry.side === 'left' ? 0 : width - geometry.axisPad;
    const subChartRight = geometry.side === 'left' ? width : subAxisStart;
    const subChartW = Math.max(1, subChartRight - chartLeft);
    const yAxisTransparent = this.isYAxisBackgroundTransparent();
    const axisClearLeft = geometry.side === 'left' ? 0 : chartRight;
    const axisClearTop = 0;
    const axisClearWidth = geometry.axisPad;
    const axisClearHeight = plotHeight;
    if (yAxisTransparent) {
      // Force the Y-axis strip to remain transparent regardless of base canvas fill.
      ctx.clearRect(axisClearLeft, axisClearTop, axisClearWidth, axisClearHeight);
    } else {
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(axisClearLeft, axisClearTop, axisClearWidth, axisClearHeight);
      ctx.strokeStyle = '#2a3142';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const boundaryX = geometry.side === 'left' ? geometry.axisPad + 0.5 : chartRight - 0.5;
      ctx.moveTo(boundaryX, 0);
      ctx.lineTo(boundaryX, plotHeight);
      ctx.stroke();
      ctx.restore();
    }

    // 보조 패널 top 계산
    const panelTops: Record<string, number> = {};
    let cur = mainH;
    for (const id of panels) { panelTops[id] = cur; cur += plotHeight * this.getPanelRatio(id); }

    const ind     = this.config.indicators;
    const indicatorLayerOn = this.indicatorsVisible;
    const visData = displayData.slice(this.startIndex, this.endIndex);
    const visRawData = this.data.slice(this.startIndex, this.endIndex);
    const count   = visData.length;
    const visibleSlots = Math.max(1, this.endIndex - this.startIndex);
    if (!count) {
      this.requestOverlayDraw();
      return;
    }

    const footprintLayoutEnabled = Boolean(indicatorLayerOn && (ind as any).footprint?.show);
    const footprintSpacingMultiplier = footprintLayoutEnabled ? 2.55 : 1;
    const gapBars = Math.min(Math.max(0, this.config.layout.rightGapBars ?? 0), 50 / Math.max(1, chartW / Math.max(1, visibleSlots)));
    const leftGap = Math.max(0, this.leftPanBars);
    const totalSp = chartW / Math.max(1, (visibleSlots + gapBars + leftGap) / footprintSpacingMultiplier);
    const candleW = footprintLayoutEnabled
      ? Math.max(3, Math.min(10, totalSp * 0.16))
      : Math.max(totalSp * 0.8, 1);
    const candleSlotOffset = footprintLayoutEnabled ? Math.max(0, (totalSp - candleW) / 2) : 0;
    const effectiveChartLeft = chartLeft + leftGap * totalSp + candleSlotOffset;
    const targetPx = 110;
    const rawStepCandles = targetPx / Math.max(totalSp, 1);
    const stepCandles = pickAxisStepCandles(rawStepCandles, this.config.timeframe);
    const tickIndices: number[] = [];
    // Extend tick range across the full visible area including the right gap (future bars),
    // so that grid lines appear even when most of the viewport is future/empty area.
    const totalVisibleSlots = Math.ceil(visibleSlots + gapBars);
    for (let i = 0; i <= totalVisibleSlots; i++) {
      if (i % stepCandles !== 0) continue;
      tickIndices.push(i);
    }

    // 지표 데이터 계산
    const maLines = indicatorLayerOn ? this.getMaLines() : [];
    const maSeries = maLines.map((maLine) => ({
      ...maLine,
      data: this.calcMA(maLine.period),
    }));
    const emaLines = indicatorLayerOn ? this.getEmaLines() : [];
    const emaSeries = emaLines.map((emaLine) => ({
      ...emaLine,
      data: this.calcEMA(emaLine.period),
    }));
    const maS  = indicatorLayerOn && ind.maShort.show  ? this.calcMA(ind.maShort.value) : [];
    const maL  = indicatorLayerOn && ind.maLong.show   ? this.calcMA(ind.maLong.value)  : [];
    const ma60 = indicatorLayerOn && ind.ma60.show     ? this.calcMA(ind.ma60.value)    : [];
    const ma120 = indicatorLayerOn && ind.ma120.show   ? this.calcMA(ind.ma120.value)   : [];
    const ma200 = indicatorLayerOn && ind.ma200.show   ? this.calcMA(ind.ma200.value)   : [];
    if (!ind.hma) ind.hma = { show: false, period: 55 };
    if (!Number.isFinite(Number(ind.hma.period)) || Number(ind.hma.period) < 1) ind.hma.period = 55;
    const hmaD = indicatorLayerOn && ind.hma.show ? this.calcHMA(ind.hma.period) : [];
    const bbLines = indicatorLayerOn ? this.getBbLines() : [];
    const bbSeries = bbLines.map((bbLine) => ({
      ...bbLine,
      data: this.calcBB(bbLine.period, bbLine.stdDev),
    }));
    const rsiD = indicatorLayerOn && ind.rsi.show      ? this.calcRSI(ind.rsi.period)   : [];
    const dmiD = indicatorLayerOn && ind.dmi.show      ? this.calcDMI(ind.dmi.period)
                                   : { plusDI: [] as (number|null)[], minusDI: [] as (number|null)[], adx: [] as (number|null)[] };
    const macdD  = indicatorLayerOn && ind.macd.show   ? this.calcMACD(ind.macd.fast, ind.macd.slow, ind.macd.signal)
                                   : { macdLine: [] as (number|null)[], sigLine: [] as (number|null)[], hist: [] as (number|null)[] };
    const stFD   = indicatorLayerOn && ind.stochF.show ? this.calcStoch(ind.stochF.kPeriod, ind.stochF.dPeriod) : null;
    const stSD   = indicatorLayerOn && ind.stochS.show ? this.calcStoch(ind.stochS.kPeriod, ind.stochS.dPeriod) : null;
    const cciD   = indicatorLayerOn && ind.cci.show    ? this.calcCCI(ind.cci.period)   : [];
    if (!ind.atr) ind.atr = { show: false, period: 14 };
    if (!Number.isFinite(Number(ind.atr.period)) || Number(ind.atr.period) < 1) ind.atr.period = 14;
    const atrD   = indicatorLayerOn && ind.atr.show    ? this.calcATR(ind.atr.period)   : [];
    const obvD   = indicatorLayerOn && ind.obv.show    ? this.calcOBV()                  : [];
    const obvSignal9 = indicatorLayerOn && ind.obv.show ? this.sma(obvD.map(v => v as number | null), 9) : [];
    const cvdD   = indicatorLayerOn && ind.cvd.show    ? this.calcCVD()                  : [];
    const cvdSignal9 = indicatorLayerOn && ind.cvd.show ? this.sma(cvdD.map(v => v as number | null), 9) : [];
    const vwapResult = indicatorLayerOn && this.shouldRenderVWAP() ? this.calcVWAP() : this.getEmptyVwapResult();
    this.lastVwapResult = vwapResult;
    const vwapD = vwapResult.vwap;
    const vwapBandsD = vwapResult.bands;
    if (!ind.williamsFractal) ind.williamsFractal = { show: false, span: 2 };
    if (!Number.isFinite(Number(ind.williamsFractal.span)) || Number(ind.williamsFractal.span) < 1) {
      ind.williamsFractal.span = 2;
    }
    const williamsFractalD = indicatorLayerOn && ind.williamsFractal.show
      ? calculateWilliamsFractals(this.data, ind.williamsFractal.span)
      : { highs: [] as Array<number | null>, lows: [] as Array<number | null>, span: 2 };
    if (!ind.parabolicSar) ind.parabolicSar = { show: false, start: 0.02, increment: 0.02, maximum: 0.2 };
    if (!Number.isFinite(Number(ind.parabolicSar.start)) || Number(ind.parabolicSar.start) <= 0) ind.parabolicSar.start = 0.02;
    if (!Number.isFinite(Number(ind.parabolicSar.increment)) || Number(ind.parabolicSar.increment) <= 0) ind.parabolicSar.increment = 0.02;
    if (!Number.isFinite(Number(ind.parabolicSar.maximum)) || Number(ind.parabolicSar.maximum) <= 0) ind.parabolicSar.maximum = 0.2;
    const parabolicSarD = indicatorLayerOn && ind.parabolicSar.show
      ? calculateParabolicSar(this.data, ind.parabolicSar.start, ind.parabolicSar.increment, ind.parabolicSar.maximum)
      : [];
    ind.smartMoneyConcepts = normalizeSmartMoneyConceptsSettings(ind.smartMoneyConcepts);
    const smartMoneyConceptsD = indicatorLayerOn ? this.calcSmartMoneyConcepts(ind.smartMoneyConcepts) : EMPTY_SMART_MONEY_CONCEPTS_RESULT;
    if (!ind.zeroLagMaTrendLevels) {
      ind.zeroLagMaTrendLevels = {
        show: false,
        length: 15,
        showLevels: true,
        upColor: '#30d453',
        downColor: '#4043f1',
      };
    }
    if (!Number.isFinite(Number(ind.zeroLagMaTrendLevels.length)) || Number(ind.zeroLagMaTrendLevels.length) < 1) {
      ind.zeroLagMaTrendLevels.length = 15;
    }
    if (typeof ind.zeroLagMaTrendLevels.showLevels !== 'boolean') ind.zeroLagMaTrendLevels.showLevels = true;
    if (typeof ind.zeroLagMaTrendLevels.upColor !== 'string' || !ind.zeroLagMaTrendLevels.upColor) ind.zeroLagMaTrendLevels.upColor = '#30d453';
    if (typeof ind.zeroLagMaTrendLevels.downColor !== 'string' || !ind.zeroLagMaTrendLevels.downColor) ind.zeroLagMaTrendLevels.downColor = '#4043f1';
    if (!ind.volumeProfile) ind.volumeProfile = { show: false, rows: 24, widthPct: 22, upOpacity: 45, downOpacity: 45, pocOpacity: 95 };
    if (!ind.fixedRangeVolumeProfile) {
      ind.fixedRangeVolumeProfile = {
        show: false,
        rowSize: 50,
        volumeMode: 'up_down',
        valueAreaVolume: 70,
        widthPct: 30,
        showPoc: true,
        showVahVal: true,
        showVaBackground: true,
        showRangeBox: true,
        showRangeHandles: true,
        showInfo: true,
      };
    }
    if (!Number.isFinite(Number(ind.fixedRangeVolumeProfile.rowSize)) || Number(ind.fixedRangeVolumeProfile.rowSize) < 1) ind.fixedRangeVolumeProfile.rowSize = 50;
    if (!Number.isFinite(Number(ind.fixedRangeVolumeProfile.valueAreaVolume))) ind.fixedRangeVolumeProfile.valueAreaVolume = 70;
    if (!Number.isFinite(Number(ind.fixedRangeVolumeProfile.widthPct))) ind.fixedRangeVolumeProfile.widthPct = 30;
    if (typeof ind.fixedRangeVolumeProfile.showInfo !== 'boolean') ind.fixedRangeVolumeProfile.showInfo = true;
    if (!ind.statisticalTrailingStop) {
      ind.statisticalTrailingStop = {
        show: false,
        dataLength: 10,
        distributionLength: 100,
        baseLevel: 2,
        bullishColor: 'rgba(8,153,129,0.5)',
        bearishColor: 'rgba(242,54,69,0.5)',
        trailMarkEnabled: true,
        trailMarkStyle: 'circle',
        trailMarkLocation: 'absolute',
        showPanelLabel: false,
      };
    }
    if (typeof ind.statisticalTrailingStop.trailMarkEnabled !== 'boolean') ind.statisticalTrailingStop.trailMarkEnabled = true;
    if (typeof ind.statisticalTrailingStop.trailMarkStyle !== 'string' || !ind.statisticalTrailingStop.trailMarkStyle) ind.statisticalTrailingStop.trailMarkStyle = 'circle';
    if (typeof ind.statisticalTrailingStop.trailMarkLocation !== 'string' || !ind.statisticalTrailingStop.trailMarkLocation) ind.statisticalTrailingStop.trailMarkLocation = 'absolute';
    if (typeof ind.statisticalTrailingStop.showPanelLabel !== 'boolean') ind.statisticalTrailingStop.showPanelLabel = false;
    if (!ind.atrTrailingEmaSignal) {
      ind.atrTrailingEmaSignal = {
        show: false,
        mode: 'basic',
        sensitivity: 3,
        atrPeriod: 2,
        signalEmaLength: 1,
        trendEmaLength: 240,
        showTrendEma: true,
        showAtrStop: false,
        showSignals: true,
      };
    }
    if (ind.atrTrailingEmaSignal.mode !== 'filtered') ind.atrTrailingEmaSignal.mode = 'basic';
    if (!Number.isFinite(Number(ind.atrTrailingEmaSignal.sensitivity)) || Number(ind.atrTrailingEmaSignal.sensitivity) <= 0) ind.atrTrailingEmaSignal.sensitivity = 3;
    if (!Number.isFinite(Number(ind.atrTrailingEmaSignal.atrPeriod)) || Number(ind.atrTrailingEmaSignal.atrPeriod) < 1) ind.atrTrailingEmaSignal.atrPeriod = 2;
    if (!Number.isFinite(Number(ind.atrTrailingEmaSignal.signalEmaLength)) || Number(ind.atrTrailingEmaSignal.signalEmaLength) < 1) ind.atrTrailingEmaSignal.signalEmaLength = 1;
    if (!Number.isFinite(Number(ind.atrTrailingEmaSignal.trendEmaLength)) || Number(ind.atrTrailingEmaSignal.trendEmaLength) < 1) ind.atrTrailingEmaSignal.trendEmaLength = 240;
    if (typeof ind.atrTrailingEmaSignal.showTrendEma !== 'boolean') ind.atrTrailingEmaSignal.showTrendEma = true;
    if (typeof ind.atrTrailingEmaSignal.showAtrStop !== 'boolean') ind.atrTrailingEmaSignal.showAtrStop = false;
    if (typeof ind.atrTrailingEmaSignal.showSignals !== 'boolean') ind.atrTrailingEmaSignal.showSignals = true;
    if (!ind.atrTrailingStopOrigin) {
      ind.atrTrailingStopOrigin = {
        show: false,
        sensitivity: 3,
        atrPeriod: 2,
        trendEmaLength: 240,
        showTrendEma: true,
        showAtrStop: false,
        showSignals: true,
      };
    }
    if (!Number.isFinite(Number(ind.atrTrailingStopOrigin.sensitivity)) || Number(ind.atrTrailingStopOrigin.sensitivity) <= 0) ind.atrTrailingStopOrigin.sensitivity = 3;
    if (!Number.isFinite(Number(ind.atrTrailingStopOrigin.atrPeriod)) || Number(ind.atrTrailingStopOrigin.atrPeriod) < 1) ind.atrTrailingStopOrigin.atrPeriod = 2;
    if (!Number.isFinite(Number(ind.atrTrailingStopOrigin.trendEmaLength)) || Number(ind.atrTrailingStopOrigin.trendEmaLength) < 1) ind.atrTrailingStopOrigin.trendEmaLength = 240;
    if (typeof ind.atrTrailingStopOrigin.showTrendEma !== 'boolean') ind.atrTrailingStopOrigin.showTrendEma = true;
    if (typeof ind.atrTrailingStopOrigin.showAtrStop !== 'boolean') ind.atrTrailingStopOrigin.showAtrStop = false;
    if (typeof ind.atrTrailingStopOrigin.showSignals !== 'boolean') ind.atrTrailingStopOrigin.showSignals = true;
    if (!ind.bbMtfKalmanSignal) {
      ind.bbMtfKalmanSignal = {
        show: false,
        htfTimeframe: '4h',
        ltfLength: 20,
        ltfMult: 2,
        htfLength: 20,
        htfMult: 2.25,
        ltfBBLinewidth: 1,
        htfBBLinewidth: 1,
        plotLtfBb: true,
        plotHtfBb: true,
        plotLabels: false,
        signalsEnabled: true,
        colorOption: 'Gradient',
        minOpacity: 55,
        maxOpacity: 99,
        bullishColor: '#089981',
        bearishColor: '#f23645',
        showErrors: true,
        showTable: false,
        textColor: '#ffffff',
      };
    }
    if (typeof ind.bbMtfKalmanSignal.htfTimeframe !== 'string' || !ind.bbMtfKalmanSignal.htfTimeframe) ind.bbMtfKalmanSignal.htfTimeframe = '4h';
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.ltfLength)) || Number(ind.bbMtfKalmanSignal.ltfLength) < 1) ind.bbMtfKalmanSignal.ltfLength = 20;
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.ltfMult)) || Number(ind.bbMtfKalmanSignal.ltfMult) <= 0) ind.bbMtfKalmanSignal.ltfMult = 2;
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.htfLength)) || Number(ind.bbMtfKalmanSignal.htfLength) < 1) ind.bbMtfKalmanSignal.htfLength = 20;
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.htfMult)) || Number(ind.bbMtfKalmanSignal.htfMult) <= 0) ind.bbMtfKalmanSignal.htfMult = 2.25;
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.ltfBBLinewidth)) || Number(ind.bbMtfKalmanSignal.ltfBBLinewidth) < 1) ind.bbMtfKalmanSignal.ltfBBLinewidth = 1;
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.htfBBLinewidth)) || Number(ind.bbMtfKalmanSignal.htfBBLinewidth) < 1) ind.bbMtfKalmanSignal.htfBBLinewidth = 1;
    ind.bbMtfKalmanSignal.ltfBBLinewidth = Math.max(1, Math.floor(Number(ind.bbMtfKalmanSignal.ltfBBLinewidth)));
    ind.bbMtfKalmanSignal.htfBBLinewidth = Math.max(1, Math.floor(Number(ind.bbMtfKalmanSignal.htfBBLinewidth)));
    if (typeof ind.bbMtfKalmanSignal.plotLtfBb !== 'boolean') ind.bbMtfKalmanSignal.plotLtfBb = true;
    if (typeof ind.bbMtfKalmanSignal.plotHtfBb !== 'boolean') ind.bbMtfKalmanSignal.plotHtfBb = true;
    if (typeof ind.bbMtfKalmanSignal.plotLabels !== 'boolean') ind.bbMtfKalmanSignal.plotLabels = false;
    if (typeof ind.bbMtfKalmanSignal.signalsEnabled !== 'boolean') ind.bbMtfKalmanSignal.signalsEnabled = true;
    if (!['Gradient', 'Solid', 'None'].includes(String(ind.bbMtfKalmanSignal.colorOption))) ind.bbMtfKalmanSignal.colorOption = 'Gradient';
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.minOpacity))) ind.bbMtfKalmanSignal.minOpacity = 55;
    if (!Number.isFinite(Number(ind.bbMtfKalmanSignal.maxOpacity))) ind.bbMtfKalmanSignal.maxOpacity = 99;
    ind.bbMtfKalmanSignal.minOpacity = Math.max(0, Math.min(100, Number(ind.bbMtfKalmanSignal.minOpacity)));
    ind.bbMtfKalmanSignal.maxOpacity = Math.max(ind.bbMtfKalmanSignal.minOpacity, Math.min(100, Number(ind.bbMtfKalmanSignal.maxOpacity)));
    if (typeof ind.bbMtfKalmanSignal.bullishColor !== 'string' || !ind.bbMtfKalmanSignal.bullishColor) ind.bbMtfKalmanSignal.bullishColor = '#089981';
    if (typeof ind.bbMtfKalmanSignal.bearishColor !== 'string' || !ind.bbMtfKalmanSignal.bearishColor) ind.bbMtfKalmanSignal.bearishColor = '#f23645';
    if (typeof ind.bbMtfKalmanSignal.showErrors !== 'boolean') ind.bbMtfKalmanSignal.showErrors = true;
    if (typeof ind.bbMtfKalmanSignal.showTable !== 'boolean') ind.bbMtfKalmanSignal.showTable = false;
    if (typeof ind.bbMtfKalmanSignal.textColor !== 'string' || !ind.bbMtfKalmanSignal.textColor) ind.bbMtfKalmanSignal.textColor = '#ffffff';
    if (!ind.vpvr) {
      ind.vpvr = {
        show: false,
        rowsLayout: 'number_of_rows',
        rowSize: 50,
        volumeMode: 'up_down',
        valueAreaVolume: 70,
        placement: 'right',
        widthPct: 22,
        showPoc: true,
        pocColor: '#ffc107',
        pocWidth: 1.2,
        pocLineStyle: 'dashed',
        showVahVal: true,
        vahValColor: '#8ab4ff',
        vahValWidth: 1,
        vahValLineStyle: 'dashed',
        showVaBackground: true,
        vaBgColor: '#3a5f94',
        vaBgOpacity: 18,
        upColor: '#26a69a',
        downColor: '#ef5350',
        upOpacity: 45,
        downOpacity: 45,
        totalColor: '#7f8aa3',
        totalOpacity: 40,
        deltaPosColor: '#26a69a',
        deltaNegColor: '#ef5350',
        deltaOpacity: 50,
        valuesVisible: false,
        valuesTextColor: '#cfd8ea',
      };
    }
    if (!ind.footprint) {
      ind.footprint = { show: false, showSummary: true, maxLevels: 18, priceStep: 1000 };
    }
    if (typeof ind.footprint.showSummary !== 'boolean') ind.footprint.showSummary = true;
    if (!Number.isFinite(Number(ind.footprint.maxLevels)) || Number(ind.footprint.maxLevels) < 1) ind.footprint.maxLevels = 18;
    if (!Number.isFinite(Number(ind.footprint.priceStep)) || Number(ind.footprint.priceStep) < 0) ind.footprint.priceStep = 1000;
    const volumeProfileConfig = ind.volumeProfile;
    const volumeProfileRows = Math.max(8, Math.min(120, Math.floor(Number(volumeProfileConfig.rows ?? 24) || 24)));
    const volumeProfileWidthRatio = Math.max(0.05, Math.min(0.45, (Number(volumeProfileConfig.widthPct ?? 22) || 22) / 100));
    const volumeProfileUpOpacity = Math.max(0, Math.min(1, (Number(volumeProfileConfig.upOpacity ?? 45) || 0) / 100));
    const volumeProfileDownOpacity = Math.max(0, Math.min(1, (Number(volumeProfileConfig.downOpacity ?? 45) || 0) / 100));
    const volumeProfilePocOpacity = Math.max(0, Math.min(1, (Number(volumeProfileConfig.pocOpacity ?? 95) || 0) / 100));
    const volumeProfileEnabled = Boolean(ind.volumeProfile.show);
    const zeroLagMaTrendLevelsD = indicatorLayerOn && ind.zeroLagMaTrendLevels.show
      ? this.calcZeroLagMaTrendLevels(ind.zeroLagMaTrendLevels.length)
      : {
        emaValue: [] as (number | null)[],
        zlma: [] as (number | null)[],
        signalUp: [] as boolean[],
        signalDn: [] as boolean[],
        zlmaColor: [] as ('up' | 'down' | null)[],
        emaColor: [] as ('up' | 'down' | null)[],
        boxes: [] as Array<{
          left: number;
          right: number;
          leftX: number;
          rightX: number;
          top: number;
          bottom: number;
          isUp: boolean;
          price: number;
        }>,
        breakUp: [] as (number | null)[],
        breakDown: [] as (number | null)[],
      };
    const zeroLagStates = buildZeroLagTrendStates(zeroLagMaTrendLevelsD, this.data.length);
    const supertrendD = indicatorLayerOn && ind.supertrend.show ? this.calcSupertrend(ind.supertrend.period, ind.supertrend.factor)
                                            : { line: [] as (number | null)[], direction: [] as number[] };
    const statisticalTrailingStopD = indicatorLayerOn && ind.statisticalTrailingStop.show
      ? this.calcStatisticalTrailingStop(
        ind.statisticalTrailingStop.dataLength,
        ind.statisticalTrailingStop.distributionLength,
        ind.statisticalTrailingStop.baseLevel,
      )
      : {
        level: [] as (number | null)[],
        anchor: [] as (number | null)[],
        extreme: [] as (number | null)[],
        bias: [] as (number | null)[],
        newTrail: [] as boolean[],
      };
    const atrTrailingEmaSignalD = indicatorLayerOn && ind.atrTrailingEmaSignal.show
      ? this.calcAtrTrailingEmaSignal({
        mode: ind.atrTrailingEmaSignal.mode,
        sensitivity: ind.atrTrailingEmaSignal.sensitivity,
        atrPeriod: ind.atrTrailingEmaSignal.atrPeriod,
        signalEmaLength: ind.atrTrailingEmaSignal.signalEmaLength,
        trendEmaLength: ind.atrTrailingEmaSignal.trendEmaLength,
      })
      : this.getEmptyAtrTrailingEmaSignalResult();
    const atrTrailingStopOriginD = indicatorLayerOn && ind.atrTrailingStopOrigin.show
      ? this.calcAtrTrailingStopOrigin({
        sensitivity: ind.atrTrailingStopOrigin.sensitivity,
        atrPeriod: ind.atrTrailingStopOrigin.atrPeriod,
        trendEmaLength: ind.atrTrailingStopOrigin.trendEmaLength,
      })
      : this.getEmptyAtrTrailingEmaSignalResult();
    const bbMtfKalmanSignalD = indicatorLayerOn && ind.bbMtfKalmanSignal.show
      ? this.calcBbMtfKalmanSignal({
        htfTimeframe: ind.bbMtfKalmanSignal.htfTimeframe,
        ltfLength: ind.bbMtfKalmanSignal.ltfLength,
        ltfMult: ind.bbMtfKalmanSignal.ltfMult,
        htfLength: ind.bbMtfKalmanSignal.htfLength,
        htfMult: ind.bbMtfKalmanSignal.htfMult,
        minOpacity: ind.bbMtfKalmanSignal.minOpacity,
        maxOpacity: ind.bbMtfKalmanSignal.maxOpacity,
        colorOption: ind.bbMtfKalmanSignal.colorOption,
      })
      : this.getEmptyBbMtfKalmanSignalResult();
    const ichiD  = indicatorLayerOn && ind.ichimoku.show ? this.calcIchimoku(ind.ichimoku.tenkan, ind.ichimoku.kijun, ind.ichimoku.senkou) : null;
    const envD   = indicatorLayerOn && ind.envelope.show ? this.calcEnvelope(ind.envelope.period, ind.envelope.pct) : null;
    const autoTrendlineChannelD: AutoTrendlineChannelResult | null = (
      this.activeStrategyId === AUTO_TRENDLINE_CHANNEL_STRATEGY_ID
      && this.strategySignalVisible
    )
      ? calculateAutoTrendlineChannel(this.data, this.getActiveStrategy()?.params ?? {})
      : null;
    const doubleBreakResult = this.getDoubleBreakResult();
    const doubleBreakExitLevels = new Map<number, number[]>();
    if (doubleBreakResult) {
      [...doubleBreakResult.longSignals, ...doubleBreakResult.shortSignals].forEach((signal) => {
        doubleBreakExitLevels.set(signal.index, [signal.tp1, signal.tp2, signal.sl]);
      });
    }

    // 메인 패널 가격 범위 계산
    let minP = Infinity, maxP = -Infinity;
    visData.forEach((d, i) => {
      const gi = this.startIndex + i;
      minP = Math.min(minP, d.low);  maxP = Math.max(maxP, d.high);
      [
        ...maSeries.map((maLine) => maLine.data[gi]),
        ...emaSeries.map((emaLine) => emaLine.data[gi]),
        maS[gi],
        maL[gi],
        ma60[gi],
        ma120[gi],
        ma200[gi],
        hmaD[gi],
        vwapD[gi],
        ...this.getVisibleVwapBandValues(vwapBandsD, gi),
        zeroLagMaTrendLevelsD.zlma[gi],
        zeroLagMaTrendLevelsD.emaValue[gi],
      ].forEach(v => {
        if (v != null) { minP = Math.min(minP, v); maxP = Math.max(maxP, v); }
      });
      if (supertrendD.line[gi] != null) {
        minP = Math.min(minP, supertrendD.line[gi]!);
        maxP = Math.max(maxP, supertrendD.line[gi]!);
      }
      if (statisticalTrailingStopD.level[gi] != null) {
        minP = Math.min(minP, statisticalTrailingStopD.level[gi]!);
        maxP = Math.max(maxP, statisticalTrailingStopD.level[gi]!);
      }
      if (statisticalTrailingStopD.anchor[gi] != null) {
        minP = Math.min(minP, statisticalTrailingStopD.anchor[gi]!);
        maxP = Math.max(maxP, statisticalTrailingStopD.anchor[gi]!);
      }
      if (atrTrailingEmaSignalD.trendEma[gi] != null) {
        minP = Math.min(minP, atrTrailingEmaSignalD.trendEma[gi]!);
        maxP = Math.max(maxP, atrTrailingEmaSignalD.trendEma[gi]!);
      }
      if (atrTrailingEmaSignalD.atrStop[gi] != null) {
        minP = Math.min(minP, atrTrailingEmaSignalD.atrStop[gi]!);
        maxP = Math.max(maxP, atrTrailingEmaSignalD.atrStop[gi]!);
      }
      if (atrTrailingStopOriginD.trendEma[gi] != null) {
        minP = Math.min(minP, atrTrailingStopOriginD.trendEma[gi]!);
        maxP = Math.max(maxP, atrTrailingStopOriginD.trendEma[gi]!);
      }
      if (atrTrailingStopOriginD.atrStop[gi] != null) {
        minP = Math.min(minP, atrTrailingStopOriginD.atrStop[gi]!);
        maxP = Math.max(maxP, atrTrailingStopOriginD.atrStop[gi]!);
      }
      [
        bbMtfKalmanSignalD.ltfBasis[gi],
        bbMtfKalmanSignalD.ltfUpper[gi],
        bbMtfKalmanSignalD.ltfLower[gi],
        bbMtfKalmanSignalD.htfUpper[gi],
        bbMtfKalmanSignalD.htfLower[gi],
        autoTrendlineChannelD?.upper[gi],
        autoTrendlineChannelD?.basis[gi],
        autoTrendlineChannelD?.lower[gi],
      ].forEach((v) => {
        if (v != null) {
          minP = Math.min(minP, v);
          maxP = Math.max(maxP, v);
        }
      });
      if (ind.zeroLagMaTrendLevels.show && ind.zeroLagMaTrendLevels.showLevels) {
        zeroLagMaTrendLevelsD.boxes.forEach((box) => {
          if (gi >= box.left && gi <= box.right) {
            minP = Math.min(minP, box.bottom);
            maxP = Math.max(maxP, box.top);
          }
        });
      }
      bbSeries.forEach((bbLine) => {
        if (bbLine.data.upper[gi] != null) {
          minP = Math.min(minP, bbLine.data.lower[gi]!);
          maxP = Math.max(maxP, bbLine.data.upper[gi]!);
        }
      });
      if (envD?.upper[gi] != null) { minP = Math.min(minP, envD.lower[gi]!);  maxP = Math.max(maxP, envD.upper[gi]!); }
      doubleBreakExitLevels.get(gi)?.forEach((v) => {
        if (Number.isFinite(v)) {
          minP = Math.min(minP, v);
          maxP = Math.max(maxP, v);
        }
      });
      if (ichiD) {
        [ichiD.tenkanLine[gi], ichiD.kijunLine[gi], ichiD.senkouA[gi], ichiD.senkouB[gi]].forEach(v => {
          if (v != null) { minP = Math.min(minP, v); maxP = Math.max(maxP, v); }
        });
      }
    });
    const priceRange = Math.max(0, maxP - minP);
    const pPadRatio = getDynamicMainPricePaddingRatio(minP, maxP);
    const pPad = Math.max(priceRange * pPadRatio, 1e-12);
    const rawMinP = minP - pPad;
    const rawMaxP = maxP + pPad;
    // Apply yScaleFactor before step calculation so ticks auto-space correctly
    let scaledRawMin = rawMinP;
    let scaledRawMax = rawMaxP;
    if (this.yScaleFactor !== 1.0) {
      const mid = (rawMinP + rawMaxP) / 2;
      const half = ((rawMaxP - rawMinP) / 2) * this.yScaleFactor;
      scaledRawMin = mid - half;
      scaledRawMax = mid + half;
    }
    const scaledRawRange = Math.max(1e-12, scaledRawMax - scaledRawMin);
    const plotHeightPx = Math.max(1, mainH - R.top);
    const mainAxisStep = getMainAxisStepByRange(scaledRawRange, plotHeightPx, this.config.quoteCurrency);

    minP = Math.floor(scaledRawMin / mainAxisStep) * mainAxisStep;
    maxP = Math.ceil(scaledRawMax / mainAxisStep) * mainAxisStep;
    if (this.mainPricePanOffset !== 0) {
      minP += this.mainPricePanOffset;
      maxP += this.mainPricePanOffset;
    }
    if (maxP <= minP) maxP = minP + mainAxisStep;
    const pRng = maxP - minP || 1;
    // Linear getY: always used for axis grid/labels so grid never shifts on log toggle
    const getYLinear = (p: number) => R.top + (maxP - p) / pRng * (mainH - R.top);
    const getY = (p: number) => {
      if (this.logScale && minP > 0) {
        const lMin = Math.log(minP);
        const lMax = Math.log(Math.max(minP * 1.00001, maxP));
        const lRng = lMax - lMin || 1;
        return R.top + (lMax - Math.log(Math.max(1e-10, p))) / lRng * (mainH - R.top);
      }
      return getYLinear(p);
    };

    // 메인 패널 라인 그리기 헬퍼
    const line = (data: (number|null)[], color: string, lw = 1.5, dash: number[] = [], offsetBars = 0) => {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
      ctx.beginPath(); let started = false;
      visData.forEach((_, i) => {
        const v = data[this.startIndex + i];
        if (v == null) { started = false; return; }
        const x = effectiveChartLeft + (i + offsetBars) * totalSp + candleW / 2;
        if (!started) { ctx.moveTo(x, getY(v)); started = true; } else ctx.lineTo(x, getY(v));
      });
      ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    };

    // 보조 패널 라인 그리기 헬퍼
    const getSubPlotBounds = (top: number, pH: number) => {
      const titleH = 20;
      const availH = Math.max(pH - titleH, 1);
      const plotH = availH * 0.95;
      const plotTop = top + titleH + (availH - plotH) / 2;
      return { plotTop, plotH };
    };
    const subLine = (data: (number|null)[], color: string, lw: number,
                     top: number, pH: number, lo: number, hi: number, dash: number[] = []) => {
      const { plotTop, plotH } = getSubPlotBounds(top, pH);
      const rng = hi - lo || 1;
      const sy = (v: number) => plotTop + (hi - v) / rng * plotH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartLeft, top, subChartW, pH);
      ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
      ctx.beginPath(); let started = false;
      visData.forEach((_, i) => {
        const v = data[this.startIndex + i];
        if (v == null) { started = false; return; }
        const x = effectiveChartLeft + i * totalSp + candleW / 2;
        if (!started) { ctx.moveTo(x, sy(v)); started = true; } else ctx.lineTo(x, sy(v));
      });
      ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    };
    const subHorizontalLine = (value: number, color: string, lw: number,
                               top: number, pH: number, lo: number, hi: number, dash: number[] = []) => {
      const { plotTop, plotH } = getSubPlotBounds(top, pH);
      const rng = hi - lo || 1;
      const y = plotTop + (hi - value) / rng * plotH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartLeft, top, subChartW, pH);
      ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };
    const showLine = (styleKey: string) => this.isIndicatorLineVisible(styleKey);

    const axisOverlayMetrics = getMainGridAxisMetrics({
      minPrice: minP,
      maxPrice: maxP,
      mainAxisStep,
    });
    renderMainGrid({
      ctx,
      chartLeft,
      chartRight,
      chartWidth: chartW,
      width,
      mainHeight: mainH,
      plotHeight,
      yAxisTransparent,
      geometry,
      minPrice: minP,
      maxPrice: maxP,
      mainAxisStep,
      getYLinear,
      symbolPriceDigits,
      chartTextSecondary: CHART_TEXT_SECONDARY,
      fontStack: CHART_FONT_STACK,
      formatPrice: formatWithComma,
      tickIndices,
      effectiveChartLeft,
      totalSpacing: totalSp,
      candleWidth: candleW,
    });

    // 메인 패널(가격 영역) 밖으로 캔들/메인지표가 침범하지 않도록 클리핑.
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartLeft, 0, chartW, mainH);
    ctx.clip();

    renderMainBackgroundLayers({
      ctx,
      indicatorLayerOn,
      indicators: ind,
      candles: visData,
      allCandles: this.data,
      startIndex: this.startIndex,
      bbSeries,
      vwapBands: vwapBandsD,
      ichimokuData: ichiD,
      envelopeData: envD,
      zeroLagMaTrendLevelsData: zeroLagMaTrendLevelsD,
      zeroLagStates,
      volumeProfile: {
        enabled: volumeProfileEnabled,
        rows: volumeProfileRows,
        widthRatio: volumeProfileWidthRatio,
        upOpacity: volumeProfileUpOpacity,
        downOpacity: volumeProfileDownOpacity,
        pocOpacity: volumeProfilePocOpacity,
      },
      minPrice: minP,
      maxPrice: maxP,
      chartLeft,
      chartRight,
      chartWidth: chartW,
      plotTop: R.top,
      plotBottom: mainH,
      effectiveChartLeft,
      totalSp,
      candleW,
      symbolPriceDigits,
      fontStack: CHART_FONT_STACK,
      showLine,
      resolveStyle: (styleKey, fallbackColor, fallbackWidth, fallbackDash) => (
        this.resolveStyle(styleKey, fallbackColor, fallbackWidth, fallbackDash)
      ),
      drawLine: line,
      getY,
      formatPrice: formatWithComma,
      formatVolume: formatThousandAdaptive,
    });
    // 5) 캔들/거래량

    const vMax = ind.volume.show ? Math.max(...visRawData.map((d) => d.volume), 1) : 1;
    const volumeTopPaddingRatio = 0.14;
    const vScaleMax = ind.volume.show ? Math.max(1, vMax * (1 + volumeTopPaddingRatio)) : 1;
    const volH   = ind.volume.show && !hiddenPanels.has('volume') ? plotHeight * this.getPanelRatio('volume') : 0;
    const volTop = panelTops['volume'] ?? Math.max(0, mainH - volH);

    renderCandles({
      ctx,
      candles: visData,
      effectiveChartLeft,
      totalSpacing: totalSp,
      candleWidth: candleW,
      getY,
      snapToDevice: (value) => this.snapToDevice(value),
      snapStrokeCenter: (value, lineWidth) => this.snapStrokeCenter(value, lineWidth),
      snapSize: (value, minCssPx) => this.snapSize(value, minCssPx),
      upColor: this.config.candleStyle?.upColor ?? '#22ab94',
      downColor: this.config.candleStyle?.downColor ?? '#f23645',
    });

    renderAutoTrendlineChannel({
      ctx,
      data: autoTrendlineChannelD,
      startIndex: this.startIndex,
      visLength: visData.length,
      chartLeft,
      chartRight,
      plotTop: R.top,
      plotBottom: mainH,
      effectiveChartLeft,
      totalSp,
      candleW,
      getY,
    });

    if (indicatorLayerOn && ind.footprint.show) {
      renderFootprintOverlay({
        ctx,
        candles: visData,
        chartLeft,
        chartRight,
        effectiveChartLeft,
        totalSpacing: totalSp,
        candleWidth: candleW,
        mainHeight: mainH,
        getY,
        fontStack: CHART_FONT_STACK,
        maxLevels: Math.max(1, Math.min(40, Math.floor(Number(ind.footprint.maxLevels) || 18))),
        priceStep: Math.max(0, Number(ind.footprint.priceStep) || 0),
        showSummary: ind.footprint.showSummary !== false,
      });
    }

    const isMobileIndicatorViewport = (window.matchMedia?.('(pointer: coarse)').matches ?? false) || window.innerWidth <= 768;
    const indicatorRenderInput: IndicatorRenderGroupedInput = {
      shared: {
        ctx,
        ind,
        showLine,
        chartLeft,
        effectiveChartLeft,
        chartRight,
        totalSp,
        candleW,
        visData,
        fontStack: CHART_FONT_STACK,
      },
      main: {
        indicatorLayerOn,
        maSeries,
        emaSeries,
        maS,
        maL,
        ma60,
        ma120,
        ma200,
        hmaD,
        bbSeries,
        vwapD,
        vwapBandsD,
        williamsFractalD,
        parabolicSarD,
        smartMoneyConceptsD,
        zeroLagMaTrendLevelsD,
        zeroLagStates,
        supertrendD,
        statisticalTrailingStopD,
        atrTrailingEmaSignalD,
        atrTrailingStopOriginD,
        bbMtfKalmanSignalD,
        envD,
        line,
        getY,
        displayData,
        R,
        mainH,
        isMobileViewport: isMobileIndicatorViewport,
      },
      volumeOverlay: {
        chartWidth: chartW,
        top: volTop,
        height: volH,
        visRawData,
        vScaleMax,
      },
      subPanels: {
        rsiD,
        dmiD,
        macdD,
        stFD,
        stSD,
        cciD,
        atrD,
        obvD,
        obvSignal9,
        cvdD,
        cvdSignal9,
        vScaleMax,
        panels,
        panelTops,
        plotHeight,
        hiddenPanels,
        subAxisStart,
        geometry,
        yAxisTransparent,
        width,
        subChartW,
        subChartRight,
        subLine,
        subHorizontalLine,
        getSubPlotBounds,
        formatKUnit,
        formatWithComma,
        chartTextSecondary: CHART_TEXT_SECONDARY,
      },
    };
    const indicatorRenderContext = {
      subPanelHost: this.createIndicatorSubPanelHost(),
      startIndex: this.startIndex,
      pixelRatio: this.pixelRatio,
      resolveStyle: (styleKey: string, fallbackColor: string, fallbackWidth?: number, fallbackDash?: number[]) => (
        this.resolveStyle(styleKey, fallbackColor, fallbackWidth, fallbackDash)
      ),
      getSubPanelScaledRange: (panelId: string, lo: number, hi: number) => this.getSubPanelScaledRange(panelId, lo, hi),
      candleStyle: this.config.candleStyle,
    };
    renderIndicatorBlocks(buildIndicatorRenderParams(
      buildIndicatorRenderInput(indicatorRenderInput),
      indicatorRenderContext,
    ));
    this.drawVwapAnchorSelection(
      ctx,
      vwapResult,
      getY,
      chartLeft,
      chartRight,
      effectiveChartLeft,
      totalSp,
      candleW,
      R.top,
      mainH,
    );
    renderLeftYAxisOverlay({
      ctx,
      geometry,
      chartRight,
      mainHeight: mainH,
      minPrice: minP,
      maxPrice: maxP,
      mainAxisStep,
      getYLinear,
      symbolPriceDigits,
      chartTextSecondary: CHART_TEXT_SECONDARY,
      fontStack: CHART_FONT_STACK,
      formatPrice: formatWithComma,
      metrics: axisOverlayMetrics,
      yAxisTransparent,
    });

    renderPanelTimeSeparator({ ctx, width, plotHeight });

    renderTimeAxisLabels({
      ctx,
      candles: visData,
      tickIndices,
      candleCount: count,
      effectiveChartLeft,
      totalSpacing: totalSp,
      candleWidth: candleW,
      height,
      timezone: this.config.timezone,
      timeframe: this.config.timeframe,
      stepCandles,
      chartTextMuted: CHART_TEXT_MUTED,
      fontStack: CHART_FONT_STACK,
    });

    if (yAxisTransparent) {
      renderTransparentYAxisLabels({
        ctx,
        geometry,
        chartRight,
        mainHeight: mainH,
        minPrice: minP,
        maxPrice: maxP,
        mainAxisStep,
        getYLinear,
        symbolPriceDigits,
        chartTextSecondary: CHART_TEXT_SECONDARY,
        fontStack: CHART_FONT_STACK,
        formatPrice: formatWithComma,
        metrics: axisOverlayMetrics,
      });
    }

    this.lastDrawMeta = {
      chartLeft,
      chartRight,
      chartW,
      axisPad: geometry.axisPad,
      axisSide: geometry.side,
      totalSp,
      candleW,
      candleSlotOffset,
      mainH,
      minP,
      maxP,
      leftGap,
      getY,
      getYLinear,
      panelTops,
      subPanelHeights: Object.fromEntries(panels.map((id) => [id, plotHeight * this.getPanelRatio(id)])),
      subAxisStart,
      subPanelCrosshairData: {
        dmiD,
        macdD,
        cciD,
        atrD,
        obvD,
        obvSignal9,
        cvdD,
        cvdSignal9,
      },
    };
    this.updateLogBtnPosition();
    this.drawConfirmedPatternBoxes(this.lastDrawMeta);
    const nowMs = performance.now();
    if (nowMs - this.lastAuxiliaryAlertEvalMs > 1000) {
      this.lastAuxiliaryAlertEvalMs = nowMs;
      this.evaluateSubIndicatorAlerts({
        volume: this.data.map((d) => d.volume),
        rsi: rsiD,
        dmi: dmiD.adx,
        macd: macdD.macdLine,
        stochF: stFD?.k ?? [],
        stochS: stSD?.k ?? [],
        cci: cciD,
        obv: obvD.map((v) => v as number | null),
        cvd: cvdD.map((v) => v as number | null),
      });
      this.evaluateTrendlineAlerts();
      this.evaluatePatternAlerts();
    }
    this.drawSignalLayer(this.lastDrawMeta);
    this.requestOverlayDraw();
    this.onAfterDraw?.();
  }

  // 오버레이 렌더링

  private requestOverlayDraw() {
    if (this.overlayDrawScheduled) return;
    this.overlayDrawScheduled = true;
    window.requestAnimationFrame(() => {
      this.overlayDrawScheduled = false;
      try {
        this.drawOverlay();
      } catch (error) {
        (window as any).__simpleChartOverlayError = error;
        console.error('[SimpleChart] overlay draw failed', error);
      }
    });
  }

  private requestMainDraw() {
    if (this.mainDrawScheduled) return;
    this.mainDrawScheduled = true;
    window.requestAnimationFrame(() => {
      this.mainDrawScheduled = false;
      this.draw();
    });
  }

  private ensureDrawingToolbar() {
    if (this.drawingToolbarEl) return;
    if (!document.getElementById('drawing-toolbar-scrollbar-style')) {
      const style = document.createElement('style');
      style.id = 'drawing-toolbar-scrollbar-style';
      style.textContent = `
        .drawing-width-menu-scroll::-webkit-scrollbar { width: 6px; }
        .drawing-width-menu-scroll::-webkit-scrollbar-track { background: transparent; }
        .drawing-width-menu-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #c2cbe0 0%, #9aa7c4 100%);
          border-radius: 999px;
        }
      `;
      document.head.appendChild(style);
    }
    const host = this.canvas.parentElement;
    if (!host) return;
    const bar = document.createElement('div');
    bar.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:10px',
      'transform:translateX(-50%)',
      'z-index:2100',
      'display:none',
      'align-items:center',
      'gap:6px',
      'padding:6px 8px',
      'background:#f2f4f8',
      'border:1px solid #c8ced8',
      'border-radius:10px',
      'box-shadow:0 8px 20px rgba(0,0,0,0.28)',
      'font:600 12px Segoe UI, Arial, sans-serif',
      'color:#1f2533',
    ].join(';');
    bar.dataset.dragMode = 'anchored';

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.title = '편집창 이동';
    dragHandle.dataset.k = 'drag-handle';
    dragHandle.style.cssText = [
      'align-self:stretch',
      'width:24px',
      'min-width:24px',
      'padding:0',
      'margin-right:2px',
      'border:none',
      'border-right:1px solid #d6dbe5',
      'border-radius:0',
      'background:transparent',
      'color:#667085',
      'cursor:grab',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'touch-action:none',
    ].join(';');
    dragHandle.innerHTML = '<svg viewBox="0 0 12 24" width="12" height="18" fill="currentColor" aria-hidden="true"><circle cx="4" cy="6" r="1.1"></circle><circle cx="8" cy="6" r="1.1"></circle><circle cx="4" cy="12" r="1.1"></circle><circle cx="8" cy="12" r="1.1"></circle><circle cx="4" cy="18" r="1.1"></circle><circle cx="8" cy="18" r="1.1"></circle></svg>';

    const mkBtn = (content: string, title: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;transform:scale(1.2);transform-origin:center;">${content}</span>`;
      b.title = title;
      b.style.cssText = 'height:32px;min-width:30px;padding:0 4px;border:none;border-radius:0;background:transparent;color:#1f2533;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      return b;
    };

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.title = '색상';
    colorInput.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';
    colorInput.dataset.k = 'color';

    const colorBtn = document.createElement('button');
    colorBtn.type = 'button';
    colorBtn.title = '색상';
    colorBtn.dataset.k = 'color-btn';
    colorBtn.style.cssText = [
      'height:32px',
      'min-width:24px',
      'padding:0 2px',
      'border:none',
      'border-radius:0',
      'background:transparent',
      'cursor:pointer',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'color:#2f6cff',
    ].join(';');
    colorBtn.innerHTML = '<span style="position:relative;width:22px;height:24px;display:block;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:0;top:-2px"><path d="M3 17.25V21h3.75L19.81 7.94 16.06 4.19 3 17.25z"></path><path d="M14.5 5.75l3.75 3.75"></path></svg><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="position:absolute;left:1px;top:9px"><line x1="6" y1="12" x2="21.5" y2="12"></line></svg></span>';
    const opacityWrap = document.createElement('div');
    opacityWrap.dataset.k = 'shape-opacity-wrap';
    opacityWrap.style.cssText = 'display:none;align-items:center;gap:6px;height:32px;padding:0 4px;';
    const opacityLabel = document.createElement('span');
    opacityLabel.dataset.k = 'shape-opacity-label';
    opacityLabel.style.cssText = 'font:700 11px Segoe UI, Arial, sans-serif;color:#374151;min-width:38px;text-align:right;';
    opacityLabel.textContent = '40%';
    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.min = '5';
    opacityInput.max = '100';
    opacityInput.step = '1';
    opacityInput.value = '40';
    opacityInput.dataset.k = 'shape-opacity';
    opacityInput.title = '투명도';
    opacityInput.style.cssText = 'width:88px;accent-color:#f5c542;cursor:pointer;';
    opacityWrap.append(opacityLabel, opacityInput);
    const colorMenu = document.createElement('div');
    colorMenu.style.cssText = [
      'position:absolute',
      'display:none',
      'top:40px',
      'left:0',
      'z-index:2200',
      'min-width:126px',
      'padding:6px',
      'border-radius:8px',
      'background:#f2f4f8',
      'border:1px solid #c8ced8',
      'box-shadow:0 10px 24px rgba(0,0,0,0.28)',
    ].join(';');
    const colorSwatches = ['#2f6cff', '#22ab94', '#f23645', '#f5a524', '#8b5cf6', '#111827', '#ffffff'];
    const swatchWrap = document.createElement('div');
    swatchWrap.style.cssText = 'display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;';
    colorSwatches.forEach((hex) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.title = hex;
      swatch.style.cssText = `width:22px;height:22px;border-radius:6px;border:1px solid #c7cfdb;background:${hex};cursor:pointer;`;
      swatch.addEventListener('click', (event) => {
        event.stopPropagation();
        colorInput.value = hex;
        applyToolbarToShape();
      });
      swatchWrap.appendChild(swatch);
    });
    const pickerRow = document.createElement('div');
    pickerRow.style.cssText = 'margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:8px;';
    const pickerLabel = document.createElement('span');
    pickerLabel.textContent = '직접 선택';
    pickerLabel.style.cssText = 'font:600 11px Segoe UI, Arial, sans-serif;color:#2f3b50;';
    const pickerInput = document.createElement('input');
    pickerInput.type = 'color';
    pickerInput.value = colorInput.value || '#2f6cff';
    pickerInput.style.cssText = 'width:34px;height:24px;border:none;background:transparent;cursor:pointer;padding:0;';
    pickerInput.addEventListener('input', () => {
      colorInput.value = pickerInput.value;
      applyToolbarToShape();
    });
    pickerInput.addEventListener('change', () => {
      colorInput.value = pickerInput.value;
      applyToolbarToShape();
    });
    pickerRow.append(pickerLabel, pickerInput);
    colorMenu.append(swatchWrap, pickerRow);
    colorBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const next = colorMenu.style.display === 'none' ? 'block' : 'none';
      colorMenu.style.display = next;
      colorMenu.style.left = `${Math.max(0, colorBtn.offsetLeft - 8)}px`;
      if (next === 'block') {
        widthMenu.style.display = 'none';
        styleMenu.style.display = 'none';
        pickerInput.value = colorInput.value || '#2f6cff';
      }
    });

    const widthSelect = document.createElement('select');
    widthSelect.title = '선 두께';
    widthSelect.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';
    widthSelect.dataset.k = 'width';
    [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50].forEach((w) => {
      const opt = document.createElement('option');
      opt.value = String(w);
      opt.textContent = `${w}px`;
      widthSelect.appendChild(opt);
    });

    const widthBtn = document.createElement('button');
    widthBtn.type = 'button';
    widthBtn.title = '선 두께';
    widthBtn.dataset.k = 'width-btn';
    widthBtn.style.cssText = 'height:32px;min-width:58px;padding:0 4px;border:none;background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#1f2533;';

    const widthMenu = document.createElement('div');
    widthMenu.className = 'drawing-width-menu-scroll';
    widthMenu.style.cssText = [
      'position:absolute',
      'display:none',
      'top:40px',
      'left:0',
      'z-index:2200',
      'min-width:92px',
      'max-height:220px',
      'overflow-y:auto',
      'overflow-x:hidden',
      'scrollbar-width:thin',
      'scrollbar-color:#9aa7c4 transparent',
      'padding:4px',
      'border-radius:8px',
      'background:#f2f4f8',
      'border:1px solid #c8ced8',
      'box-shadow:0 10px 24px rgba(0,0,0,0.28)',
    ].join(';');

    const renderWidthButton = () => {
      const w = Math.max(1, Math.min(50, Number(widthSelect.value || '2')));
      const previewW = 4;
      widthBtn.innerHTML = `<svg viewBox="0 0 56 18" width="56" height="18" fill="none"><line x1="3" y1="9" x2="30" y2="9" stroke="currentColor" stroke-width="${previewW}" stroke-linecap="round"></line><text x="36" y="12" font-size="11" fill="currentColor" font-weight="700">${w}px</text></svg>`;
    };

    [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50].forEach((w) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.style.cssText = 'width:100%;height:30px;border:none;background:transparent;border-radius:6px;display:flex;align-items:center;justify-content:flex-start;padding:0 6px;cursor:pointer;color:#1f2533;';
      const previewW = 4;
      item.innerHTML = `<svg viewBox="0 0 74 18" width="74" height="18" fill="none"><line x1="3" y1="9" x2="38" y2="9" stroke="currentColor" stroke-width="${previewW}" stroke-linecap="round"></line><text x="46" y="12" font-size="11" fill="currentColor" font-weight="700">${w}px</text></svg>`;
      item.addEventListener('mouseenter', () => { item.style.background = '#e6ebf4'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        widthSelect.value = String(w);
        renderWidthButton();
        applyToolbarToShape();
        widthMenu.style.display = 'none';
      });
      widthMenu.appendChild(item);
    });

    widthBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const next = widthMenu.style.display === 'none' ? 'block' : 'none';
      widthMenu.style.display = next;
      widthMenu.style.left = `${Math.max(0, widthBtn.offsetLeft - 8)}px`;
      if (next === 'block') {
        styleMenu.style.display = 'none';
        colorMenu.style.display = 'none';
      }
    });
    widthMenu.addEventListener('click', (event) => event.stopPropagation());
    renderWidthButton();

    const styleSelect = document.createElement('select');
    styleSelect.title = '선 종류';
    styleSelect.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';
    styleSelect.dataset.k = 'style';
    [
      { v: 'solid', t: '실선' },
      { v: 'dash', t: '대시' },
      { v: 'dot', t: '도트' },
    ].forEach(({ v, t }) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = t;
      styleSelect.appendChild(opt);
    });
    const styleBtn = document.createElement('button');
    styleBtn.type = 'button';
    styleBtn.title = '선 종류';
    styleBtn.dataset.k = 'style-btn';
    styleBtn.style.cssText = 'height:32px;min-width:32px;padding:0 2px;border:none;background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#1f2533;';

    const styleMenu = document.createElement('div');
    styleMenu.style.cssText = [
      'position:absolute',
      'display:none',
      'top:40px',
      'left:0',
      'z-index:2200',
      'min-width:106px',
      'padding:4px',
      'border-radius:8px',
      'background:#f2f4f8',
      'border:1px solid #c8ced8',
      'box-shadow:0 10px 24px rgba(0,0,0,0.28)',
    ].join(';');

    const renderStyleButton = () => {
      const style = (styleSelect.value as DrawingShape['lineStyle']) ?? 'solid';
      const dash = style === 'dash' ? '5 3' : style === 'dot' ? '2 3' : '';
      styleBtn.innerHTML = `<svg viewBox="0 0 30 18" width="30" height="18" fill="none"><line x1="4" y1="9" x2="24" y2="9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}></line></svg>`;
    };

    ([
      { v: 'solid', dash: '' },
      { v: 'dash', dash: '5 3' },
      { v: 'dot', dash: '2 3' },
    ] as const).forEach(({ v, dash }) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.style.cssText = 'width:100%;height:30px;border:none;background:transparent;border-radius:6px;display:flex;align-items:center;justify-content:flex-start;padding:0 6px;cursor:pointer;color:#1f2533;';
      const label = v === 'solid' ? '실선' : v === 'dash' ? '대시' : '도트';
      item.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;"><svg viewBox="0 0 40 18" width="40" height="18" fill="none"><line x1="4" y1="9" x2="32" y2="9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}></line></svg><span style="font:600 12px Segoe UI, Arial, sans-serif;color:#1f2533;">${label}</span></span>`;
      item.addEventListener('mouseenter', () => { item.style.background = '#e6ebf4'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        styleSelect.value = v;
        renderStyleButton();
        applyToolbarToShape();
        styleMenu.style.display = 'none';
      });
      styleMenu.appendChild(item);
    });

    styleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const next = styleMenu.style.display === 'none' ? 'block' : 'none';
      styleMenu.style.display = next;
      styleMenu.style.left = `${Math.max(0, styleBtn.offsetLeft - 8)}px`;
      if (next === 'block') {
        widthMenu.style.display = 'none';
        colorMenu.style.display = 'none';
      }
    });
    styleMenu.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', () => {
      colorMenu.style.display = 'none';
      widthMenu.style.display = 'none';
      styleMenu.style.display = 'none';
    });
    renderStyleButton();

    const alertBtn = mkBtn('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a4 4 0 0 0-4 4v3c0 .6-.2 1.2-.6 1.7L6 14h12l-1.4-2.3A3 3 0 0 1 16 10V7a4 4 0 0 0-4-4z"></path><path d="M10 18a2 2 0 0 0 4 0"></path></svg>', '알림생성');
    alertBtn.dataset.k = 'alert-open';
    const addTriangleAnchorBtn = mkBtn('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17L9 7L14 15L19 9"></path><circle cx="5" cy="17" r="1.8"></circle><circle cx="9" cy="7" r="1.8"></circle><circle cx="14" cy="15" r="1.8"></circle><path d="M18 18h4"></path><path d="M20 16v4"></path></svg>', '삼각형 앵커 추가');
    addTriangleAnchorBtn.dataset.k = 'triangle-anchor-add';
    addTriangleAnchorBtn.style.display = 'none';
    const removeTriangleAnchorBtn = mkBtn('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17L9 7L14 15L19 9"></path><circle cx="5" cy="17" r="1.8"></circle><circle cx="9" cy="7" r="1.8"></circle><circle cx="14" cy="15" r="1.8"></circle><path d="M18 18h4"></path></svg>', '삼각형 앵커 삭제');
    removeTriangleAnchorBtn.dataset.k = 'triangle-anchor-remove';
    removeTriangleAnchorBtn.style.display = 'none';

    const lockBtn = mkBtn(LOCK_ICON_CLOSED_SVG, '잠금');
    lockBtn.dataset.k = 'lock';
    const hideBtn = mkBtn('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>', '감추기');
    hideBtn.dataset.k = 'hide';
    const delBtn = mkBtn('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg>', '삭제');
    delBtn.dataset.k = 'delete';

    bar.append(
      dragHandle,
      colorBtn,
      colorInput,
      opacityWrap,
      widthBtn,
      widthSelect,
      styleBtn,
      styleSelect,
      alertBtn,
      addTriangleAnchorBtn,
      removeTriangleAnchorBtn,
      lockBtn,
      hideBtn,
      delBtn,
    );
    bar.appendChild(widthMenu);
    bar.appendChild(styleMenu);
    bar.appendChild(colorMenu);

    const applyToolbarToShape = () => {
      const selected = this.getSelectedDrawing();
      if (!selected) return;
      const opacityValue = Math.max(5, Math.min(100, Number(opacityInput.value || '40')));
      opacityLabel.textContent = `${opacityValue}%`;
      if (selected.kind === 'draw-highlighter' || selected.kind === 'draw-box') {
        const hex = colorInput.value || '#f5c542';
        const toRgb = (h: string) => {
          const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
          if (!m) return { r: 245, g: 197, b: 66 };
          return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
        };
        const { r, g, b } = toRgb(hex);
        selected.color = `rgba(${r},${g},${b},${(opacityValue / 100).toFixed(2)})`;
        colorBtn.style.color = hex;
      } else {
        selected.color = colorInput.value || '#2f6cff';
        colorBtn.style.color = selected.color;
      }
      if (selected.kind === 'text-note' && this.textNoteEditorEl && this.textNoteEditorShapeId === selected.id) {
        this.textNoteEditorEl.style.color = selected.color ?? '#e6edf9';
        this.textNoteEditorEl.style.caretColor = selected.color ?? '#e6edf9';
      }
      const maxWidth = selected.kind === 'draw-highlighter' ? 50 : selected.kind === 'anchored-vwap' ? 6 : 4;
      selected.width = Math.max(1, Math.min(maxWidth, Number(widthSelect.value || '2')));
      selected.lineStyle = (styleSelect.value as DrawingShape['lineStyle']) ?? 'solid';
      this.upsertDrawing(selected);
      this.requestOverlayDraw();
    };
    const syncLockButtonVisual = (locked: boolean) => {
      lockBtn.innerHTML = locked ? LOCK_ICON_OPEN_SVG : LOCK_ICON_CLOSED_SVG;
      lockBtn.title = locked ? '잠금해제' : '잠금';
      lockBtn.style.color = locked ? '#2f6cff' : '#1f2533';
    };

    [colorInput, widthSelect, styleSelect, opacityInput]
      .forEach((el) => {
        el.addEventListener('input', applyToolbarToShape);
        el.addEventListener('change', applyToolbarToShape);
      });

    const popup = document.createElement('div');
    popup.style.cssText = [
      'position:absolute',
      'display:none',
      'left:50%',
      'top:46px',
      'transform:translateX(-50%)',
      'z-index:2150',
      'min-width:300px',
      'padding:10px',
      'border-radius:10px',
      'border:1px solid #c8ced8',
      'background:#f7f9fd',
      'box-shadow:0 10px 24px rgba(0,0,0,0.28)',
      'font:12px Segoe UI, Arial, sans-serif',
      'color:#1f2533',
    ].join(';');
    const mkRow = (label: string, control: HTMLElement) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;';
      const l = document.createElement('span');
      l.textContent = label;
      l.style.cssText = 'font-size:12px;color:#2f3b50;';
      row.appendChild(l);
      row.appendChild(control);
      return row;
    };
    const popupMode = document.createElement('select');
    popupMode.style.cssText = 'height:28px;border:1px solid #aab3c2;border-radius:7px;background:#fff;padding:0 6px;';
    popupMode.innerHTML = '<option value="up">상향돌파</option><option value="down">하향돌파</option>';
    const popupTarget = document.createElement('select');
    popupTarget.style.cssText = 'height:28px;border:1px solid #aab3c2;border-radius:7px;background:#fff;padding:0 6px;';
    popupTarget.innerHTML = '<option value="price">가격</option><option value="trendline">추세선</option>';
    const popupPrice = document.createElement('input');
    popupPrice.type = 'number';
    popupPrice.step = '0.1';
    popupPrice.style.cssText = 'height:28px;width:130px;border:1px solid #aab3c2;border-radius:7px;background:#fff;padding:0 8px;';
    const wrapChecks = document.createElement('div');
    wrapChecks.style.cssText = 'display:flex;gap:8px;align-items:center;';
    const mkSmallCheck = (label: string) => {
      const lb = document.createElement('label');
      lb.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;';
      const i = document.createElement('input');
      i.type = 'checkbox';
      lb.appendChild(i);
      lb.appendChild(document.createTextNode(label));
      return { lb, i };
    };
    const cAppPush = mkSmallCheck('앱푸시');
    const cOnsite = mkSmallCheck('온사이트');
    const cSound = mkSmallCheck('소리');
    [cAppPush.lb, cOnsite.lb, cSound.lb].forEach((n) => wrapChecks.appendChild(n));
    const cEnabled = mkSmallCheck('알림 사용');
    popup.append(
      mkRow('돌파 조건', popupMode),
      mkRow('대상', popupTarget),
      mkRow('가격값', popupPrice),
      mkRow('알림 옵션', wrapChecks),
      mkRow('', cEnabled.lb),
    );
    host.appendChild(popup);
    this.drawingAlertPopupEl = popup;

    const syncAlertControls = () => {
      const selected = this.getSelectedDrawing();
      if (!selected) return;
      const alert = selected.alert ?? {
        enabled: false,
        mode: 'up' as const,
        target: 'trendline' as const,
        priceValue: this.data[this.endIndex - 1]?.close ?? 0,
        appPush: false,
        onsite: true,
        sound: false,
      };
      popupMode.value = alert.mode;
      popupTarget.value = alert.target;
      popupPrice.value = String(alert.priceValue ?? (this.data[this.endIndex - 1]?.close ?? 0));
      cEnabled.i.checked = Boolean(alert.enabled);
      cAppPush.i.checked = Boolean(alert.appPush);
      cOnsite.i.checked = Boolean(alert.onsite);
      cSound.i.checked = Boolean(alert.sound);
      popupPrice.disabled = popupTarget.value !== 'price';
    };
    const applyAlertControls = () => {
      const selected = this.getSelectedDrawing();
      if (!selected) return;
      selected.alert = {
        enabled: cEnabled.i.checked,
        mode: (popupMode.value as 'up' | 'down') ?? 'up',
        target: (popupTarget.value as 'price' | 'trendline') ?? 'trendline',
        priceValue: Number(popupPrice.value || 0),
        appPush: cAppPush.i.checked,
        onsite: cOnsite.i.checked,
        sound: cSound.i.checked,
        lastTriggerBar: selected.alert?.lastTriggerBar,
      };
      popupPrice.disabled = popupTarget.value !== 'price';
      this.upsertDrawing(selected);
      this.requestOverlayDraw();
    };
    [popupMode, popupTarget, popupPrice, cEnabled.i, cAppPush.i, cOnsite.i, cSound.i].forEach((el) => {
      el.addEventListener('input', applyAlertControls);
      el.addEventListener('change', applyAlertControls);
    });
    alertBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      syncAlertControls();
      const isOpen = popup.style.display === 'block';
      popup.style.display = isOpen ? 'none' : 'block';
    });
    addTriangleAnchorBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addTrianglePatternAnchorAfterD();
    });
    removeTriangleAnchorBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.removeTrianglePatternAnchorAfterD();
    });
    document.addEventListener('click', (event) => {
      if (!popup.contains(event.target as Node) && event.target !== alertBtn) {
        popup.style.display = 'none';
      }
    });

    lockBtn.addEventListener('click', () => {
      const selected = this.getSelectedDrawing();
      if (!selected) return;
      selected.locked = !selected.locked;
      syncLockButtonVisual(Boolean(selected.locked));
      this.upsertDrawing(selected);
      this.requestOverlayDraw();
    });
    hideBtn.addEventListener('click', () => {
      const selected = this.getSelectedDrawing();
      if (!selected) return;
      selected.hidden = !selected.hidden;
      hideBtn.style.color = selected.hidden ? '#2f6cff' : '#1f2533';
      this.upsertDrawing(selected);
      this.requestOverlayDraw();
    });
    delBtn.addEventListener('click', () => {
      this.deleteSelectedDrawing();
    });

    host.appendChild(bar);

    const clampToolbarPosition = (left: number, top: number) => {
      const hostRect = host.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const maxLeft = Math.max(0, hostRect.width - barRect.width);
      const maxTop = Math.max(0, hostRect.height - barRect.height);
      return {
        left: Math.max(0, Math.min(maxLeft, left)),
        top: Math.max(0, Math.min(maxTop, top)),
      };
    };
    const applyToolbarPosition = (left: number, top: number) => {
      const clamped = clampToolbarPosition(left, top);
      bar.style.left = `${Math.round(clamped.left)}px`;
      bar.style.top = `${Math.round(clamped.top)}px`;
      bar.style.transform = 'none';
      bar.dataset.dragMode = 'manual';
    };
    const startToolbarDrag = (clientX: number, clientY: number) => {
      const hostRect = host.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const startLeft = barRect.left - hostRect.left;
      const startTop = barRect.top - hostRect.top;
      const shiftX = clientX - barRect.left;
      const shiftY = clientY - barRect.top;
      dragHandle.style.cursor = 'grabbing';
      const onMove = (moveClientX: number, moveClientY: number) => {
        applyToolbarPosition(moveClientX - hostRect.left - shiftX, moveClientY - hostRect.top - shiftY);
      };
      const handleMouseMove = (event: MouseEvent) => {
        event.preventDefault();
        onMove(event.clientX, event.clientY);
      };
      const handleTouchMove = (event: TouchEvent) => {
        if (!event.touches.length) return;
        event.preventDefault();
        onMove(event.touches[0].clientX, event.touches[0].clientY);
      };
      const stop = () => {
        dragHandle.style.cursor = 'grab';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stop);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', stop);
        window.removeEventListener('touchcancel', stop);
        const finalRect = bar.getBoundingClientRect();
        if (Math.abs(finalRect.left - barRect.left) < 1 && Math.abs(finalRect.top - barRect.top) < 1) {
          applyToolbarPosition(startLeft, startTop);
        }
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stop);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', stop);
      window.addEventListener('touchcancel', stop);
    };
    dragHandle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startToolbarDrag(event.clientX, event.clientY);
    });
    dragHandle.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      event.stopPropagation();
      startToolbarDrag(touch.clientX, touch.clientY);
    }, { passive: false });

    this.drawingToolbarEl = bar;
  }

  private syncDrawingToolbar() {
    this.ensureDrawingToolbar();
    const bar = this.drawingToolbarEl;
    if (!bar) return;
    const selected = this.getSelectedDrawing();
    if (!selected) {
      bar.style.display = 'none';
      if (this.drawingAlertPopupEl) this.drawingAlertPopupEl.style.display = 'none';
      this.drawingToolbarBoundId = null;
      return;
    }
    if (selected.kind === 'measure') {
      bar.style.display = 'none';
      if (this.drawingAlertPopupEl) this.drawingAlertPopupEl.style.display = 'none';
      this.drawingToolbarBoundId = null;
      return;
    }
    bar.style.display = 'flex';
    if (this.drawingToolbarBoundId === selected.id) return;
    this.drawingToolbarBoundId = selected.id;
    const q = <T extends HTMLElement>(k: string) => bar.querySelector<T>(`[data-k="${k}"]`);
    const colorInput = q<HTMLInputElement>('color');
    const colorBtn = q<HTMLButtonElement>('color-btn');
    const shapeOpacityWrap = q<HTMLDivElement>('shape-opacity-wrap');
    const shapeOpacity = q<HTMLInputElement>('shape-opacity');
    const shapeOpacityLabel = q<HTMLSpanElement>('shape-opacity-label');
    const widthSelect = q<HTMLSelectElement>('width');
    const styleSelect = q<HTMLSelectElement>('style');
    const alertBtn = q<HTMLButtonElement>('alert-open');
    const addTriangleAnchorBtn = q<HTMLButtonElement>('triangle-anchor-add');
    const removeTriangleAnchorBtn = q<HTMLButtonElement>('triangle-anchor-remove');
    const lockBtn = q<HTMLButtonElement>('lock');
    const hideBtn = q<HTMLButtonElement>('hide');
    if (selected.kind === 'draw-highlighter' || selected.kind === 'draw-box') {
      if (shapeOpacityWrap) shapeOpacityWrap.style.display = 'inline-flex';
      const parseRgba = (raw: string | undefined) => {
        const fallback = { hex: selected.kind === 'draw-box' ? '#7ea6ff' : '#f5c542', alpha: selected.kind === 'draw-box' ? 20 : 40 };
        if (!raw) return fallback;
        const m = raw.match(/rgba?\(([^)]+)\)/i);
        if (!m) return { hex: raw.startsWith('#') ? raw : fallback.hex, alpha: fallback.alpha };
        const parts = m[1].split(',').map((s) => s.trim());
        const r = Number(parts[0] ?? (selected.kind === 'draw-box' ? '126' : '245'));
        const g = Number(parts[1] ?? (selected.kind === 'draw-box' ? '166' : '197'));
        const b = Number(parts[2] ?? (selected.kind === 'draw-box' ? '255' : '66'));
        const a = parts.length >= 4 ? Number(parts[3]) : (selected.kind === 'draw-box' ? 0.2 : 0.4);
        const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
        return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: Math.max(5, Math.min(100, Math.round((Number.isFinite(a) ? a : 0.4) * 100))) };
      };
      const parsed = parseRgba(selected.color);
      if (colorInput) colorInput.value = parsed.hex;
      if (colorBtn) colorBtn.style.color = parsed.hex;
      if (shapeOpacity) shapeOpacity.value = String(parsed.alpha);
      if (shapeOpacityLabel) shapeOpacityLabel.textContent = `${parsed.alpha}%`;
    } else {
      if (shapeOpacityWrap) shapeOpacityWrap.style.display = 'none';
      if (colorInput) colorInput.value = selected.color ?? '#2f6cff';
      if (colorBtn) colorBtn.style.color = selected.color ?? '#2f6cff';
    }
    if (alertBtn) {
      const supportsAlert = selected.kind !== 'anchored-vwap';
      alertBtn.style.display = supportsAlert ? 'flex' : 'none';
      if (!supportsAlert && this.drawingAlertPopupEl) this.drawingAlertPopupEl.style.display = 'none';
    }
    if (addTriangleAnchorBtn) {
      const trianglePointCount = selected.kind === 'triangle-pattern'
        ? (selected.points ?? [selected.a, selected.b ?? selected.a]).length
        : 0;
      const canAddTriangleAnchor = selected.kind === 'triangle-pattern'
        && !selected.locked
        && trianglePointCount >= 4
        && trianglePointCount < 9;
      addTriangleAnchorBtn.style.display = selected.kind === 'triangle-pattern' ? 'flex' : 'none';
      addTriangleAnchorBtn.disabled = !canAddTriangleAnchor;
      addTriangleAnchorBtn.style.opacity = canAddTriangleAnchor ? '1' : '0.42';
      addTriangleAnchorBtn.style.cursor = canAddTriangleAnchor ? 'pointer' : 'not-allowed';
      addTriangleAnchorBtn.title = canAddTriangleAnchor
        ? '삼각형 앵커 추가'
        : trianglePointCount >= 9
          ? '삼각형 앵커는 최대 9개까지 추가할 수 있습니다'
          : 'D 앵커 이후부터 앵커를 추가할 수 있습니다';
    }
    if (removeTriangleAnchorBtn) {
      const trianglePointCount = selected.kind === 'triangle-pattern'
        ? (selected.points ?? [selected.a, selected.b ?? selected.a]).length
        : 0;
      const canRemoveTriangleAnchor = selected.kind === 'triangle-pattern'
        && !selected.locked
        && trianglePointCount > 4;
      removeTriangleAnchorBtn.style.display = canRemoveTriangleAnchor ? 'flex' : 'none';
      removeTriangleAnchorBtn.disabled = !canRemoveTriangleAnchor;
      removeTriangleAnchorBtn.title = 'D 이후 추가 앵커 삭제';
    }
    if (widthSelect) {
      const maxWidth = selected.kind === 'draw-highlighter' ? 50 : selected.kind === 'anchored-vwap' ? 6 : 4;
      const nextWidth = String(Math.max(1, Math.min(maxWidth, Math.round(selected.width ?? 2))));
      widthSelect.value = nextWidth;
      const widthBtn = q<HTMLButtonElement>('width-btn');
      if (widthBtn) {
        const w = Number(nextWidth);
        widthBtn.innerHTML = `<svg viewBox="0 0 56 18" width="56" height="18" fill="none"><line x1="3" y1="9" x2="30" y2="9" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"></line><text x="36" y="12" font-size="11" fill="currentColor" font-weight="700">${w}px</text></svg>`;
      }
    }
    if (styleSelect) {
      styleSelect.value = selected.lineStyle ?? 'solid';
      const styleBtn = q<HTMLButtonElement>('style-btn');
      if (styleBtn) {
        const style = (styleSelect.value as DrawingShape['lineStyle']) ?? 'solid';
        const dash = style === 'dash' ? '5 3' : style === 'dot' ? '2 3' : '';
        styleBtn.innerHTML = `<svg viewBox="0 0 30 18" width="30" height="18" fill="none"><line x1="4" y1="9" x2="24" y2="9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}></line></svg>`;
      }
    }
    if (lockBtn) {
      lockBtn.innerHTML = selected.locked ? LOCK_ICON_OPEN_SVG : LOCK_ICON_CLOSED_SVG;
      lockBtn.title = selected.locked ? '잠금해제' : '잠금';
      lockBtn.style.color = selected.locked ? '#2f6cff' : '#1f2533';
    }
    if (hideBtn) hideBtn.style.color = selected.hidden ? '#2f6cff' : '#1f2533';
  }

  private ensureAnchoredVwapSettingsModal(): HTMLDivElement | null {
    if (this.avwapSettingsModalEl) return this.avwapSettingsModalEl;
    const host = this.canvas.parentElement;
    if (!host) return null;
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'z-index:2400',
      'background:rgba(15,23,42,0.42)',
      'backdrop-filter:blur(2px)',
    ].join(';');
    overlay.innerHTML = `
      <div data-k="card" style="width:min(476px,calc(100vw - 24px));max-height:min(92vh,820px);display:flex;flex-direction:column;background:#ffffff;border-radius:14px;border:1px solid #d9dce3;box-shadow:0 28px 80px rgba(15,23,42,0.28);overflow:hidden;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:22px 24px 12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-size:24px;font-weight:700;">Anchored VWAP</div>
            <button type="button" data-k="rename" style="border:none;background:transparent;color:#6b7280;cursor:pointer;font-size:18px;line-height:1;">?</button>
          </div>
          <button type="button" data-k="close" style="border:none;background:transparent;color:#111827;cursor:pointer;font-size:24px;line-height:1;">×</button>
        </div>
        <div style="padding:0 24px;">
          <div style="display:flex;gap:24px;border-bottom:1px solid #eceff5;">
            <button type="button" data-k="tab-input" style="padding:10px 0 12px;border:none;background:transparent;font-size:17px;font-weight:700;cursor:pointer;">입력</button>
            <button type="button" data-k="tab-style" style="padding:10px 0 12px;border:none;background:transparent;font-size:17px;font-weight:700;cursor:pointer;color:#6b7280;">모습</button>
            <button type="button" data-k="tab-visibility" style="padding:10px 0 12px;border:none;background:transparent;font-size:17px;font-weight:700;cursor:pointer;color:#6b7280;">보임</button>
          </div>
        </div>
        <div data-k="body" style="padding:20px 24px 22px;overflow:auto;">
          <div data-k="panel-input"></div>
          <div data-k="panel-style" style="display:none;"></div>
          <div data-k="panel-visibility" style="display:none;"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-top:1px solid #eceff5;background:#ffffff;">
          <select data-k="template" style="height:42px;min-width:120px;border:1px solid #d1d5db;border-radius:10px;padding:0 12px;background:#fff;font-size:14px;">
            <option>템플릿</option>
          </select>
          <div style="display:flex;gap:12px;">
            <button type="button" data-k="cancel" style="height:42px;padding:0 22px;border:1px solid #111827;border-radius:10px;background:#fff;color:#111827;font-size:15px;font-weight:700;cursor:pointer;">취소</button>
            <button type="button" data-k="confirm" style="height:42px;padding:0 22px;border:none;border-radius:10px;background:#111111;color:#ffffff;font-size:15px;font-weight:700;cursor:pointer;">확인</button>
          </div>
        </div>
      </div>
    `;
    host.appendChild(overlay);
    this.avwapSettingsModalEl = overlay;
    return overlay;
  }

  private closeAnchoredVwapSettingsModal(applyChanges: boolean): void {
    const overlay = this.avwapSettingsModalEl;
    if (!overlay) return;
    const draftInput = overlay.querySelector('input[data-k="draft"]') as HTMLInputElement | null;
    const draftColorInput = overlay.querySelector('input[data-k="draft-shape-color"]') as HTMLInputElement | null;
    const draftWidthInput = overlay.querySelector('input[data-k="draft-shape-width"]') as HTMLInputElement | null;
    const draftHiddenInput = overlay.querySelector('input[data-k="draft-shape-hidden"]') as HTMLInputElement | null;
    const draftLockedInput = overlay.querySelector('input[data-k="draft-shape-locked"]') as HTMLInputElement | null;
    if (applyChanges && this.avwapSettingsEditingShapeId && draftInput) {
      const shape = this.drawings.find((item) => item.id === this.avwapSettingsEditingShapeId && item.kind === 'anchored-vwap');
      if (shape) {
        try {
          const parsed = JSON.parse(draftInput.value) as AnchoredVwapSettings;
          shape.avwap = this.cloneAnchoredVwapSettings(parsed);
          if (draftColorInput?.value) shape.color = draftColorInput.value;
          if (draftWidthInput?.value) shape.width = Math.max(1, Math.min(6, Number(draftWidthInput.value)));
          if (draftHiddenInput) shape.hidden = draftHiddenInput.value === 'true';
          if (draftLockedInput) shape.locked = draftLockedInput.value === 'true';
          this.upsertDrawing(shape);
          this.requestOverlayDraw();
        } catch {
          // Ignore malformed draft state and keep the previous settings.
        }
      }
    }
    overlay.style.display = 'none';
    this.avwapSettingsEditingShapeId = null;
  }

  private openAnchoredVwapSettingsModal(shape: DrawingShape): void {
    if (shape.kind !== 'anchored-vwap') return;
    const overlay = this.ensureAnchoredVwapSettingsModal();
    if (!overlay) return;
    const q = <T extends HTMLElement>(key: string) => overlay.querySelector<T>(`[data-k="${key}"]`);
    const inputPanel = q<HTMLDivElement>('panel-input');
    const stylePanel = q<HTMLDivElement>('panel-style');
    const visibilityPanel = q<HTMLDivElement>('panel-visibility');
    const tabButtons = {
      input: q<HTMLButtonElement>('tab-input'),
      style: q<HTMLButtonElement>('tab-style'),
      visibility: q<HTMLButtonElement>('tab-visibility'),
    };
    if (!inputPanel || !stylePanel || !visibilityPanel || !tabButtons.input || !tabButtons.style || !tabButtons.visibility) return;
    this.avwapSettingsEditingShapeId = shape.id;
    const draftState = this.cloneAnchoredVwapSettings(shape.avwap);
    let draftInput = q<HTMLInputElement>('draft');
    if (!draftInput) {
      draftInput = document.createElement('input');
      draftInput.type = 'hidden';
      draftInput.dataset.k = 'draft';
      overlay.appendChild(draftInput);
    }
    const ensureHidden = (key: string, value: string) => {
      let input = q<HTMLInputElement>(key);
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.dataset.k = key;
        overlay.appendChild(input);
      }
      input.value = value;
      return input;
    };
    const draftShapeColor = ensureHidden('draft-shape-color', shape.color ?? '#2f6cff');
    const draftShapeWidth = ensureHidden('draft-shape-width', String(Math.max(1, Math.min(6, Math.round(shape.width ?? 1)))));
    const draftShapeHidden = ensureHidden('draft-shape-hidden', String(Boolean(shape.hidden)));
    const draftShapeLocked = ensureHidden('draft-shape-locked', String(Boolean(shape.locked)));
    const readDraft = (): AnchoredVwapSettings => {
      try {
        return this.cloneAnchoredVwapSettings(JSON.parse(draftInput!.value) as AnchoredVwapSettings);
      } catch {
        return this.cloneAnchoredVwapSettings(shape.avwap);
      }
    };
    const writeDraft = (next: AnchoredVwapSettings) => {
      draftInput!.value = JSON.stringify(next);
    };
    writeDraft(draftState);

    const sourceOptions: Array<{ value: AnchoredVwapSource; label: string }> = [
      { value: 'hlc3', label: '(고 + 저 + 종) / 3' },
      { value: 'ohlc4', label: '(시 + 고 + 저 + 종) / 4' },
      { value: 'hl2', label: '(고 + 저) / 2' },
      { value: 'close', label: '종가' },
      { value: 'open', label: '시가' },
      { value: 'high', label: '고가' },
      { value: 'low', label: '저가' },
    ];
    const rowStyle = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;';
    const sectionLabelStyle = 'font-size:13px;font-weight:700;color:#4b5563;margin:16px 0 14px;';
    const fieldStyle = 'height:42px;border:1px solid #d1d5db;border-radius:10px;background:#fff;padding:0 12px;font-size:14px;color:#111827;';
    const colorField = (value: string) => `<input type="color" value="${value}" style="width:44px;height:36px;border:none;background:transparent;cursor:pointer;padding:0;">`;
    const toggleRow = (key: string, label: string, checked: boolean, right: string) => `
      <label style="${rowStyle}">
        <span style="display:flex;align-items:center;gap:12px;font-size:15px;color:#111827;">
          <input data-k="${key}" type="checkbox" ${checked ? 'checked' : ''} style="width:20px;height:20px;">
          <span>${label}</span>
        </span>
        ${right}
      </label>
    `;
    const renderPanels = () => {
      const draft = readDraft();
      inputPanel.innerHTML = `
        <div style="${sectionLabelStyle}">밴드 설정</div>
        <div style="${rowStyle}">
          <span style="font-size:15px;color:#111827;">밴드 계산 방식</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <select data-k="band-mode" style="${fieldStyle};width:158px;">
              <option value="standard-deviation" selected>표준 편차</option>
            </select>
            <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:12px;">i</span>
          </div>
        </div>
        ${draft.bands.map((band, index) => `
          <div style="${rowStyle}">
            <label style="display:flex;align-items:center;gap:12px;font-size:15px;color:#111827;">
              <input data-k="band-enabled-${index}" type="checkbox" ${band.enabled ? 'checked' : ''} style="width:20px;height:20px;">
              <span>밴드 배수 #${index + 1}</span>
            </label>
            <input data-k="band-multiplier-${index}" type="number" step="0.1" min="0" value="${band.multiplier}" style="${fieldStyle};width:128px;">
          </div>
        `).join('')}
        <div style="${sectionLabelStyle};margin-top:26px;">소스</div>
        <div style="${rowStyle}">
          <span style="font-size:15px;color:#111827;">소스</span>
          <select data-k="source" style="${fieldStyle};width:180px;">
            ${sourceOptions.map((option) => `<option value="${option.value}" ${draft.source === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
      `;
      stylePanel.innerHTML = `
        ${toggleRow('show-line', '브이왑', draft.showLine, `<div style="display:flex;align-items:center;gap:8px;">${colorField(shape.color ?? '#2f6cff')}</div>`)}
        ${draft.bands.map((band, index) => toggleRow(`band-visible-${index}`, index === 0 ? '로우어 밴드 / 어퍼 밴드' : index === 1 ? '밴드 #2' : '밴드 #3', band.visible, `<div style="display:flex;align-items:center;gap:8px;">${colorField(band.color)}</div>`)).join('')}
        ${toggleRow('show-background', '백그라운드 채우기', draft.showBackground, `<div style="display:flex;align-items:center;gap:8px;">${colorField(draft.backgroundColor)}<input data-k="background-opacity" type="number" min="0" max="100" step="1" value="${draft.backgroundOpacity}" style="${fieldStyle};width:76px;"></div>`)}
        ${toggleRow('show-price-labels', '가격라벨', draft.showPriceLabels, '<span></span>')}
        <div style="${rowStyle}">
          <span style="font-size:15px;color:#111827;">선 두께</span>
          <input data-k="line-width" type="number" min="1" max="6" step="1" value="${draftShapeWidth.value}" style="${fieldStyle};width:90px;">
        </div>
      `;
      visibilityPanel.innerHTML = `
        ${toggleRow('shape-hidden', '도형 표시', draftShapeHidden.value !== 'true', '<span></span>')}
        ${toggleRow('shape-lock', '앵커 잠금', draftShapeLocked.value === 'true', '<span></span>')}
        <div style="padding-top:12px;color:#6b7280;font-size:13px;line-height:1.5;">
          앵커를 더블 클릭하면 이 설정 창이 다시 열립니다.
        </div>
      `;

      const sourceSelect = q<HTMLSelectElement>('source');
      sourceSelect?.addEventListener('change', () => {
        const next = readDraft();
        next.source = (sourceSelect.value as AnchoredVwapSource) ?? 'hlc3';
        writeDraft(next);
      });
      draft.bands.forEach((_, index) => {
        const enabled = q<HTMLInputElement>(`band-enabled-${index}`);
        const mult = q<HTMLInputElement>(`band-multiplier-${index}`);
        const visible = q<HTMLInputElement>(`band-visible-${index}`);
        const color = stylePanel.querySelectorAll('input[type="color"]')[index + 1] as HTMLInputElement | undefined;
        enabled?.addEventListener('change', () => {
          const next = readDraft();
          next.bands[index].enabled = enabled.checked;
          writeDraft(next);
        });
        mult?.addEventListener('input', () => {
          const next = readDraft();
          next.bands[index].multiplier = Math.max(0, Number(mult.value || next.bands[index].multiplier || 0));
          writeDraft(next);
        });
        visible?.addEventListener('change', () => {
          const next = readDraft();
          next.bands[index].visible = visible.checked;
          writeDraft(next);
        });
        color?.addEventListener('input', () => {
          const next = readDraft();
          next.bands[index].color = color.value;
          writeDraft(next);
        });
      });
      const lineColor = stylePanel.querySelector('input[type="color"]') as HTMLInputElement | null;
      lineColor?.addEventListener('input', () => {
        draftShapeColor.value = lineColor.value;
      });
      q<HTMLInputElement>('show-line')?.addEventListener('change', () => {
        const next = readDraft();
        next.showLine = q<HTMLInputElement>('show-line')?.checked !== false;
        writeDraft(next);
      });
      q<HTMLInputElement>('show-background')?.addEventListener('change', () => {
        const next = readDraft();
        next.showBackground = q<HTMLInputElement>('show-background')?.checked !== false;
        writeDraft(next);
      });
      q<HTMLInputElement>('show-price-labels')?.addEventListener('change', () => {
        const next = readDraft();
        next.showPriceLabels = q<HTMLInputElement>('show-price-labels')?.checked !== false;
        writeDraft(next);
      });
      q<HTMLInputElement>('background-opacity')?.addEventListener('input', () => {
        const next = readDraft();
        next.backgroundOpacity = Math.max(0, Math.min(100, Number(q<HTMLInputElement>('background-opacity')?.value || next.backgroundOpacity)));
        writeDraft(next);
      });
      const bgColorInputs = stylePanel.querySelectorAll('input[type="color"]');
      const bgColorInput = bgColorInputs[bgColorInputs.length - 1] as HTMLInputElement | undefined;
      bgColorInput?.addEventListener('input', () => {
        const next = readDraft();
        next.backgroundColor = bgColorInput.value;
        writeDraft(next);
      });
      q<HTMLInputElement>('line-width')?.addEventListener('input', () => {
        draftShapeWidth.value = String(Math.max(1, Math.min(6, Number(q<HTMLInputElement>('line-width')?.value || draftShapeWidth.value || 2))));
      });
      q<HTMLInputElement>('shape-hidden')?.addEventListener('change', () => {
        draftShapeHidden.value = String(!(q<HTMLInputElement>('shape-hidden')?.checked ?? true));
      });
      q<HTMLInputElement>('shape-lock')?.addEventListener('change', () => {
        draftShapeLocked.value = String(q<HTMLInputElement>('shape-lock')?.checked === true);
      });
    };
    renderPanels();

    const setActiveTab = (tab: 'input' | 'style' | 'visibility') => {
      inputPanel.style.display = tab === 'input' ? 'block' : 'none';
      stylePanel.style.display = tab === 'style' ? 'block' : 'none';
      visibilityPanel.style.display = tab === 'visibility' ? 'block' : 'none';
      (Object.entries(tabButtons) as Array<[typeof tab, HTMLButtonElement]>).forEach(([key, btn]) => {
        btn.style.color = key === tab ? '#111827' : '#6b7280';
        btn.style.borderBottom = key === tab ? '3px solid #111827' : '3px solid transparent';
      });
    };
    setActiveTab('input');
    tabButtons.input.onclick = () => setActiveTab('input');
    tabButtons.style.onclick = () => setActiveTab('style');
    tabButtons.visibility.onclick = () => setActiveTab('visibility');

    q<HTMLButtonElement>('close')!.onclick = () => this.closeAnchoredVwapSettingsModal(false);
    q<HTMLButtonElement>('cancel')!.onclick = () => this.closeAnchoredVwapSettingsModal(false);
    q<HTMLButtonElement>('confirm')!.onclick = () => this.closeAnchoredVwapSettingsModal(true);
    overlay.onclick = (event) => {
      if (event.target === overlay) this.closeAnchoredVwapSettingsModal(false);
    };
    overlay.style.display = 'flex';
  }

  private getMainViewportMetrics() {
    if (!this.lastDrawMeta) return null;
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const plotHeight = Math.max(40, height - X_AXIS_HEIGHT);
    const geometry = this.getChartGeometry(width, this.lastDrawMeta.axisPad);
    const mainH = this.lastDrawMeta.mainH;
    const top = 10;
    const totalSp = this.lastDrawMeta.totalSp;
    const candleW = this.lastDrawMeta.candleW;
    const leftGap = this.lastDrawMeta.leftGap ?? 0;
    const candleSlotOffset = this.lastDrawMeta.candleSlotOffset ?? 0;
    const range = this.lastDrawMeta.maxP - this.lastDrawMeta.minP || 1;
    const effectiveChartLeft = geometry.chartLeft + leftGap * totalSp + candleSlotOffset;
    const contentRight = this.isYAxisBackgroundTransparent() ? width : geometry.chartRight;
    return {
      chartLeft: geometry.chartLeft,
      effectiveChartLeft,
      chartRight: contentRight,
      chartW: Math.max(1, contentRight - geometry.chartLeft),
      axisPad: geometry.axisPad,
      axisSide: geometry.side,
      axisLeft: geometry.axisLeft,
      axisRight: geometry.axisRight,
      mainH,
      top,
      totalSp,
      candleW,
      candleSlotOffset,
      leftGap,
      minP: this.lastDrawMeta.minP,
      maxP: this.lastDrawMeta.maxP,
      range,
      getY: this.lastDrawMeta.getY,
      width,
      plotHeight,
    };
  }

  private getMouseAnchor(mx: number, my: number): DrawingAnchor | null {
    const m = this.getMainViewportMetrics();
    if (!m) return null;
    if (mx < m.chartLeft || mx > m.chartRight || my < m.top || my > m.mainH) return null;
    const rawIndex = this.startIndex + (mx - m.effectiveChartLeft - m.candleW / 2) / Math.max(1e-6, m.totalSp);
    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const maxVisibleIndex = this.startIndex + visibleCount - 1;
    const index = Math.max(0, Math.min(maxVisibleIndex, rawIndex));
    const price = m.maxP - ((my - m.top) / Math.max(1, m.mainH - m.top)) * m.range;
    return { index, price };
  }

  private xForIndex(index: number, totalSp: number, candleW: number): number {
    const chartLeft = this.lastDrawMeta?.chartLeft ?? 0;
    const leftGap = this.lastDrawMeta?.leftGap ?? 0;
    const candleSlotOffset = this.lastDrawMeta?.candleSlotOffset ?? 0;
    return chartLeft + (leftGap + index - this.startIndex) * totalSp + candleSlotOffset + candleW / 2;
  }

  /** 앵커 가격을 캔들 OHLC 중 가장 가까운 값으로 자석 스냅 (약한 자석: 12px 이내) */
  private drawing_apply_magnet(anchor: DrawingAnchor): DrawingAnchor {
    if (this.drawingMagnetMode === 'off') return anchor;
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return anchor;
    const nearIdx = Math.round(anchor.index);
    if (nearIdx < 0 || nearIdx >= this.data.length) return anchor;
    const candle  = this.data[Math.max(0, Math.min(this.data.length - 1, nearIdx))];
    if (!candle) return anchor;

    // 자석 반경: Y축 픽셀 기준
    const MAGNET_PIXELS = this.drawingMagnetMode === 'strong' ? 24 : 12;
    const pxPerPrice    = Math.max(1, metrics.mainH - metrics.top) / Math.max(1e-6, metrics.range);
    const magnetPriceRange = MAGNET_PIXELS / pxPerPrice;

    // 후보: 종가/시가/고가(윗꼬리끝)/저가(아랫꼬리끝)
    const candidates = [candle.close, candle.open, candle.high, candle.low];
    let best = anchor.price;
    let minDist = magnetPriceRange;
    for (const p of candidates) {
      const d = Math.abs(anchor.price - p);
      if (d < minDist) { minDist = d; best = p; }
    }
    return { index: nearIdx, price: best };
  }

  /** 십자선 픽셀 좌표 → 자석 스냅 → 픽셀 좌표로 역환산 */
  private crosshair_snap_to_candle(x: number, y: number): { x: number; y: number } {
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return { x, y };
    const raw = this.getMouseAnchor(x, y);
    if (!raw) return { x, y };
    const snapped = this.drawing_apply_magnet(raw);
    const snapX = this.xForIndex(snapped.index, metrics.totalSp, metrics.candleW);
    const snapY = metrics.getY(snapped.price);
    return { x: snapX, y: snapY };
  }

  /** 포지션 드로잉 기본값 계산 (진입가 스냅 + 1:1 손익비 + 모바일 크기 조정) */
  private position_calc_defaults(
    mx: number, my: number, isMobileCtx: boolean,
  ): { anchor: DrawingAnchor; defaultRisk: number; defaultBars: number } | null {
    const rawAnchor = this.getMouseAnchor(mx, my);
    if (!rawAnchor) return null;
    // 자석 스냅: 종가/시가/고가/저가(꼬리끝) 중 가장 가까운 가격으로
    const anchor = this.drawing_apply_magnet(rawAnchor);

    const metrics     = this.getMainViewportMetrics();
    const visibleBars = Math.max(10, this.endIndex - this.startIndex);
    const range       = Math.max(1, metrics?.range ?? Math.abs(anchor.price) * 0.02);
    // 기본 포지션 높이는 "진입가 절대값"이 아닌 "현재 보이는 차트 범위" 기준으로 계산
    // (고가 종목에서 화면을 가득 채우는 문제 방지)
    const baseRisk    = range * (isMobileCtx ? 0.085 : 0.07);
    const minRisk     = range * (isMobileCtx ? 0.04 : 0.03);
    const maxRisk     = range * (isMobileCtx ? 0.20 : 0.16);
    const defaultRisk = Math.min(maxRisk, Math.max(minRisk, baseRisk));
    // 기본 포지션 영역 박스 너비: 최소 렌더 폭과 일치시켜 생성 직후 첫 리사이즈 괴리를 방지
    const defaultBarsByViewport = Math.max(7, Math.round(visibleBars * 0.075));
    const minBoxWidthPx = 228;
    const minBarsByBoxWidth = metrics ? (minBoxWidthPx / Math.max(1e-6, metrics.totalSp)) : 0;
    const defaultBars = Math.max(defaultBarsByViewport, minBarsByBoxWidth);
    return { anchor, defaultRisk, defaultBars };
  }

  private cloneShape(shape: DrawingShape): DrawingShape {
    return cloneDrawingShape(shape);
  }

  private isTrendlineShape(shape: Pick<DrawingShape, 'kind'> | Pick<DrawingDraft, 'kind'> | null | undefined): boolean {
    return isTrendlineKind(shape?.kind);
  }

  private isCircleTextShape(shape: Pick<DrawingShape, 'kind'> | Pick<DrawingDraft, 'kind'> | null | undefined): boolean {
    return shape?.kind === 'draw-circle';
  }

  private isTextEditableDrawingShape(shape: Pick<DrawingShape, 'kind'> | Pick<DrawingDraft, 'kind'> | null | undefined): boolean {
    return this.isTrendlineShape(shape) || this.isCircleTextShape(shape);
  }

  private getTrendlineRenderLine(
    shape: Pick<DrawingShape, 'kind' | 'a' | 'b'> | Pick<DrawingDraft, 'kind' | 'a' | 'b'>,
    metrics: NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>,
  ): {
    anchorStartX: number;
    anchorStartY: number;
    anchorEndX: number;
    anchorEndY: number;
    lineStartX: number;
    lineStartY: number;
    lineEndX: number;
    lineEndY: number;
  } {
    const anchorStartX = this.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
    const anchorStartY = metrics.getY(shape.a.price);
    const endAnchor = shape.b ?? shape.a;
    const anchorEndX = this.xForIndex(endAnchor.index, metrics.totalSp, metrics.candleW);
    const anchorEndY = metrics.getY(endAnchor.price);
    const line = getTrendlineScreenLine(
      { x: anchorStartX, y: anchorStartY },
      { x: anchorEndX, y: anchorEndY },
      {
        left: metrics.chartLeft,
        right: metrics.chartRight,
        top: metrics.top,
        bottom: metrics.mainH,
      },
      shape.kind as TrendlineDrawingToolId,
    );
    return {
      anchorStartX,
      anchorStartY,
      anchorEndX,
      anchorEndY,
      lineStartX: line.x1,
      lineStartY: line.y1,
      lineEndX: line.x2,
      lineEndY: line.y2,
    };
  }

  private pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    return pointToSegmentDistanceUtil(px, py, x1, y1, x2, y2);
  }

  private getChannelGeometry(shape: DrawingShape | DrawingDraft) {
    return getChannelGeometryUtil(shape);
  }

  private getTrendlineTextLayout(
    shape: DrawingShape,
    metrics: NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>,
    placeholder = '',
  ): { text: string; angle: number; x: number; y: number; width: number; height: number; isPlaceholder: boolean } {
    if (shape.kind === 'draw-circle') {
      const rawText = (shape.text ?? '').trim();
      const text = rawText || placeholder;
      const isPlaceholder = rawText.length === 0 && text.length > 0;
      if (text === '') {
        return { text: '', angle: 0, x: 0, y: 0, width: 0, height: 0, isPlaceholder: true };
      }
      const x = this.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
      const y = metrics.getY(shape.a.price);
      this.overlayCtx.save();
      this.overlayCtx.font = `600 12px ${CHART_FONT_STACK}`;
      const width = Math.ceil(this.overlayCtx.measureText(text).width);
      this.overlayCtx.restore();
      return { text, angle: 0, x, y, width, height: 14, isPlaceholder };
    }
    const line = this.getTrendlineRenderLine(shape, metrics);
    const rawText = (shape.text ?? '').trim();
    const text = rawText || placeholder;
    const isPlaceholder = rawText.length === 0 && text.length > 0;
    if (text === '') {
      return { text: '', angle: 0, x: 0, y: 0, width: 0, height: 0, isPlaceholder: true };
    }
    let angle = Math.atan2(line.lineEndY - line.lineStartY, line.lineEndX - line.lineStartX);
    if (angle > Math.PI / 2) angle -= Math.PI;
    else if (angle < -Math.PI / 2) angle += Math.PI;
    const x = (line.lineStartX + line.lineEndX) / 2;
    const y = (line.lineStartY + line.lineEndY) / 2 - 10;
    this.overlayCtx.save();
    this.overlayCtx.font = `600 12px ${CHART_FONT_STACK}`;
    const width = Math.ceil(this.overlayCtx.measureText(text).width);
    this.overlayCtx.restore();
    return { text, angle, x, y, width, height: 14, isPlaceholder };
  }

  private applyTrendlineTextEdit(shapeId: string, rawValue: string): void {
    const shape = this.drawings.find((s) => s.id === shapeId && this.isTextEditableDrawingShape(s));
    if (!shape) return;
    const trimmed = rawValue.trim();
    if (trimmed) {
      shape.text = trimmed;
      this.upsertDrawing(shape);
      this.selectedDrawingId = shape.id;
      this.selectedDrawingPart = 'body';
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      return;
    }
    delete shape.text;
    this.upsertDrawing(shape);
    this.clearDrawingSelection();
  }

  private closeTrendlineTextEditor(apply: boolean): void {
    const input = this.trendlineTextEditorEl;
    const shapeId = this.trendlineTextEditorShapeId;
    if (!input) return;
    this.trendlineTextEditorEl = null;
    this.trendlineTextEditorShapeId = null;
    const value = input.value;
    input.remove();
    if (apply && shapeId) {
      this.applyTrendlineTextEdit(shapeId, value);
    } else {
      this.requestOverlayDraw();
    }
  }

  private openTrendlineTextEditor(shape: DrawingShape): void {
    const metrics = this.getMainViewportMetrics();
    const fallbackX = Number.isFinite(this.mouseX) ? this.mouseX : this.canvas.clientWidth / 2;
    const fallbackY = Number.isFinite(this.mouseY) ? this.mouseY : this.canvas.clientHeight / 2;
    const layout = metrics
      ? this.getTrendlineTextLayout(shape, metrics, '텍스트 입력')
      : { text: (shape.text ?? '').trim() || '텍스트 입력', angle: 0, x: fallbackX, y: fallbackY, width: 120, height: 14, isPlaceholder: false };
    this.closeTrendlineTextEditor(false);
    const rect = this.canvas.getBoundingClientRect();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = (shape.text ?? '').trim();
    input.placeholder = '텍스트 입력';
    const angleDeg = (layout.angle * 180) / Math.PI;
    input.style.cssText = [
      'position:fixed',
      `left:${Math.round(rect.left + layout.x)}px`,
      `top:${Math.round(rect.top + layout.y - layout.height * 0.5)}px`,
      `transform:translate(-50%,-50%) rotate(${angleDeg.toFixed(3)}deg)`,
      'transform-origin:center center',
      'z-index:2400',
      'min-width:140px',
      'max-width:260px',
      'padding:0 2px',
      'border-radius:0',
      'border:0',
      'background:transparent',
      'color:#f0f5ff',
      `font:600 12px ${CHART_FONT_STACK}`,
      'outline:none',
      'box-shadow:none',
      'text-align:center',
      'caret-color:#f0f5ff',
    ].join(';');
    document.body.appendChild(input);
    this.trendlineTextEditorEl = input;
    this.trendlineTextEditorShapeId = shape.id;
    this.selectedDrawingId = shape.id;
    this.selectedDrawingPart = 'trendline-text-guide';
    const commit = () => this.closeTrendlineTextEditor(true);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeTrendlineTextEditor(true);
      }
    });
    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('mousedown', (event) => event.stopPropagation());
    input.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
    setTimeout(() => {
      if (this.trendlineTextEditorEl !== input) return;
      input.focus();
      input.select();
    }, 0);
    this.requestOverlayDraw();
  }

  private tryOpenSelectedTrendlineGuideEditor(mx: number, my: number): boolean {
    if (this.drawingTool || !this.selectedDrawingId) return false;
    const selected = this.drawings.find((shape) => shape.id === this.selectedDrawingId && this.isTextEditableDrawingShape(shape));
    if (!selected) return false;
    if ((selected.text ?? '').trim()) return false;
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return false;
    const layout = this.getTrendlineTextLayout(selected, metrics, '텍스트 입력 (클릭)');
    if (!layout.text) return false;
    const dx = mx - layout.x;
    const dy = my - layout.y;
    const nearRadius = Math.max(68, layout.width * 0.95 + 34);
    if (dx * dx + dy * dy > nearRadius * nearRadius) return false;
    this.selectedDrawingPart = 'trendline-text-guide';
    this.drawingMoveState = null;
    this.syncDrawingToolbar();
    this.openTrendlineTextEditor(selected);
    return true;
  }

  private editTrendlineTextPrompt(shape: DrawingShape): void {
    const baseValue = (shape.text ?? '').trim();
    const next = window.prompt('텍스트를 입력하세요', baseValue || '');
    if (next === null) return;
    this.applyTrendlineTextEdit(shape.id, next);
  }

  private editTrendlineText(shape: DrawingShape): void {
    this.openTrendlineTextEditor(shape);
  }

  private getDrawingAnchorScreenPoint(shape: DrawingShape): { x: number; y: number } | null {
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return null;
    return {
      x: this.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW),
      y: metrics.getY(shape.a.price),
    };
  }

  private getTextNoteEditorPosition(shape: DrawingShape): { x: number; y: number; width: number; height: number } {
    const metrics = this.getMainViewportMetrics();
    if (!metrics) {
      const fallbackX = Number.isFinite(this.mouseX) ? this.mouseX : this.canvas.clientWidth / 2;
      const fallbackY = Number.isFinite(this.mouseY) ? this.mouseY : this.canvas.clientHeight / 2;
      return { x: fallbackX, y: fallbackY - 22, width: 78, height: 24 };
    }
    const x = this.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
    const y = metrics.getY(shape.a.price) - 22;
    const text = (shape.text ?? '').trim() || '텍스트 입력';
    this.overlayCtx.save();
    this.overlayCtx.font = `12px ${CHART_FONT_STACK}`;
    const width = Math.min(280, Math.ceil(this.overlayCtx.measureText(text).width) + 18);
    this.overlayCtx.restore();
    return { x, y, width, height: 24 };
  }

  private applyTextNoteEdit(shapeId: string, rawValue: string): void {
    const shape = this.drawings.find((s) => s.id === shapeId && s.kind === 'text-note');
    if (!shape) return;
    const trimmed = rawValue.trim();
    if (!trimmed) {
      this.drawings = deleteDrawingById(this.drawings, shapeId);
      if (this.selectedDrawingId === shapeId) {
        this.selectedDrawingId = null;
        this.selectedDrawingPart = 'line';
      }
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      return;
    }
    shape.text = trimmed;
    this.upsertDrawing(shape);
    this.selectedDrawingId = shape.id;
    this.selectedDrawingPart = 'body';
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
  }

  private closeTextNoteEditor(apply: boolean): void {
    const input = this.textNoteEditorEl;
    const shapeId = this.textNoteEditorShapeId;
    if (!input) return;
    this.textNoteEditorEl = null;
    this.textNoteEditorShapeId = null;
    const value = input.value;
    input.remove();
    if (apply && shapeId) {
      this.applyTextNoteEdit(shapeId, value);
    } else {
      this.requestOverlayDraw();
    }
  }

  private openTextNoteEditor(shape: DrawingShape): void {
    if (shape.kind !== 'text-note') return;
    this.closeTextNoteEditor(true);
    const rect = this.canvas.getBoundingClientRect();
    const layout = this.getTextNoteEditorPosition(shape);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = (shape.text ?? '').trim();
    input.placeholder = '텍스트 입력';
    const textColor = shape.color ?? '#e6edf9';
    input.style.cssText = [
      'position:fixed',
      `left:${Math.round(rect.left + layout.x)}px`,
      `top:${Math.round(rect.top + layout.y)}px`,
      `width:${Math.round(layout.width)}px`,
      `height:${Math.round(layout.height)}px`,
      'z-index:2400',
      'box-sizing:border-box',
      'padding:0 7px',
      'border:0',
      'border-radius:0',
      'background:transparent',
      `color:${textColor}`,
      `font:12px ${CHART_FONT_STACK}`,
      'outline:none',
      'box-shadow:none',
      `caret-color:${textColor}`,
    ].join(';');
    document.body.appendChild(input);
    this.textNoteEditorEl = input;
    this.textNoteEditorShapeId = shape.id;
    this.selectedDrawingId = shape.id;
    this.selectedDrawingPart = 'body';
    const commit = () => this.closeTextNoteEditor(true);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeTextNoteEditor(true);
      }
    });
    setTimeout(() => {
      if (this.textNoteEditorEl !== input) return;
      input.addEventListener('blur', commit, { once: true });
    }, 0);
    input.addEventListener('pointerdown', (event) => event.stopPropagation());
    input.addEventListener('mousedown', (event) => event.stopPropagation());
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
    input.focus({ preventScroll: true });
    input.select();
    setTimeout(() => {
      if (this.textNoteEditorEl !== input) return;
      input.focus({ preventScroll: true });
      input.select();
    }, 0);
    this.requestOverlayDraw();
  }

  private createTextNoteAt(anchor: DrawingAnchor): DrawingShape {
    const created = createTextNoteDrawing({ anchor });
    this.upsertDrawing(created);
    this.selectedDrawingId = created.id;
    this.selectedDrawingPart = 'body';
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    return created;
  }

  private hitTestDrawing(shape: DrawingShape, mx: number, my: number, metrics: NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>): DrawingHitPart | null {
    const hitMetrics = {
      ...metrics,
      chartTop: metrics.top,
      chartBottom: metrics.mainH,
    };
    return hitTestDrawingShape({
      shape,
      mx,
      my,
      metrics: hitMetrics,
      hoveredDrawingId: this.hoveredDrawingId,
      hoveredDrawingPart: this.hoveredDrawingPart,
      adapters: {
        xForIndex: (index, totalSp, candleW) => this.xForIndex(index, totalSp, candleW),
        getTrendlineRenderLine: (item) => this.getTrendlineRenderLine(item, metrics),
        getTrendlineTextLayout: (item, _drawingMetrics, placeholder) => this.getTrendlineTextLayout(item, metrics, placeholder),
        getAnchoredVwapPlot: (item) => this.getAnchoredVwapPlot(item),
        isCoarsePointer: () => window.matchMedia?.('(pointer: coarse)').matches ?? false,
      },
    });
  }

  private findDrawingAt(mx: number, my: number): { shape: DrawingShape; part: DrawingHitPart } | null {
    const metrics = this.getMainViewportMetrics();
    const hitMetrics = metrics ? {
      ...metrics,
      chartTop: metrics.top,
      chartBottom: metrics.mainH,
    } : null;
    return findDrawingAtPoint({
      drawings: this.drawings,
      drawingsVisible: this.drawingsVisible,
      selectedDrawingId: this.selectedDrawingId,
      mx,
      my,
      metrics: hitMetrics,
      hoveredDrawingId: this.hoveredDrawingId,
      hoveredDrawingPart: this.hoveredDrawingPart,
      adapters: {
        xForIndex: (index, totalSp, candleW) => this.xForIndex(index, totalSp, candleW),
        getTrendlineRenderLine: (item) => metrics ? this.getTrendlineRenderLine(item, metrics) : {
          anchorStartX: 0,
          anchorStartY: 0,
          anchorEndX: 0,
          anchorEndY: 0,
          lineStartX: 0,
          lineStartY: 0,
          lineEndX: 0,
          lineEndY: 0,
        },
        getTrendlineTextLayout: (item, _drawingMetrics, placeholder) => metrics ? this.getTrendlineTextLayout(item, metrics, placeholder) : {
          text: '',
          angle: 0,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          isPlaceholder: true,
        },
        getAnchoredVwapPlot: (item) => this.getAnchoredVwapPlot(item),
        isCoarsePointer: () => window.matchMedia?.('(pointer: coarse)').matches ?? false,
      },
    });
  }

  private moveShapeByDelta(base: DrawingShape, dx: number, dy: number, part: DrawingHitPart = 'line'): DrawingShape {
    const metrics = this.getMainViewportMetrics();
    return moveDrawingByDelta({
      base,
      dx,
      dy,
      part,
      metrics,
      dataLength: this.data.length,
      applyMagnet: (anchor) => this.drawing_apply_magnet(anchor),
    });
  }

  private drawSelectionOverlay(ctx: CanvasRenderingContext2D, shape: DrawingShape, metrics: NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>) {
    renderDrawingSelectionOverlay({
      ctx,
      shape,
      metrics,
      xForIndex: (index, totalSp, candleW) => this.xForIndex(index, totalSp, candleW),
    });
  }

  private drawDrawingShape(ctx: CanvasRenderingContext2D, shape: DrawingShape | DrawingDraft, isDraft: boolean, metrics: ReturnType<SimpleChart['getMainViewportMetrics']>) {
    renderDrawingShape({
      ctx,
      shape,
      isDraft,
      metrics,
      selectedDrawingId: this.selectedDrawingId,
      hoveredDrawingId: this.hoveredDrawingId,
      hoveredDrawingPart: this.hoveredDrawingPart,
      editingTextShapeId: this.trendlineTextEditorShapeId,
      symbol: this.config.symbol,
      upColor: this.config.candleStyle.upColor,
      downColor: this.config.candleStyle.downColor,
      viewportHeight: this.viewportHeight,
      xAxisHeight: X_AXIS_HEIGHT,
      fontStack: CHART_FONT_STACK,
      formatPrice: (value) => formatWithComma(value, getSymbolPricePrecision(this.config.symbol, this.config.quoteCurrency)),
      xForIndex: (index, totalSpacing, width) => this.xForIndex(index, totalSpacing, width),
      getAnchoredVwapSettings: (item) => this.cloneAnchoredVwapSettings(item.avwap),
      getAnchoredVwapPlot: (item) => this.getAnchoredVwapPlot(item),
      getTrendlineRenderLine: (item, drawingMetrics) => this.getTrendlineRenderLine(item, drawingMetrics as NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>),
      getTrendlineTextLayout: (item, drawingMetrics, placeholder) => this.getTrendlineTextLayout(item, drawingMetrics as NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>, placeholder),
    });
  }

  private drawOverlay() {
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const ctx = this.overlayCtx;
    const symbolPriceDigits = getSymbolPricePrecision(this.config.symbol, this.config.quoteCurrency);
    ctx.clearRect(0, 0, width, height);
    this.hoveredSubIndicatorAddButton = null;

    const plotHeight = Math.max(40, height - X_AXIS_HEIGHT);
    const geometry = this.getChartGeometry(width, this.lastDrawMeta?.axisPad);
    const R      = { top: 10 };
    const chartLeft = geometry.chartLeft;
    const chartRight = geometry.chartRight;
    const chartW = geometry.chartWidth;
    const panels = this.activePanels;
    const hiddenPanels = new Set<string>(((this.config.panelState as any).hiddenPanels ?? []) as string[]);
    const subRat = panels.reduce((s, id) => s + this.getPanelRatio(id), 0);
    const mainH  = this.lastDrawMeta?.mainH ?? (plotHeight * (1 - subRat));
    const panelTops: Record<string, number> = {};
    let panelCurTop = mainH;
    for (const id of panels) {
      panelTops[id] = panelCurTop;
      panelCurTop += plotHeight * this.getPanelRatio(id);
    }
    const mainScale = this.lastDrawMeta
      ? { lo: this.lastDrawMeta.minP, hi: this.lastDrawMeta.maxP, toY: this.lastDrawMeta.getY }
      : null;
    const linearToY = this.lastDrawMeta?.getYLinear ?? null;

    const hideLivePriceOverlay = this.shouldHideLivePriceOverlay();
    if (this.data.length && mainScale && linearToY && !hideLivePriceOverlay) {
      renderLivePriceOverlay({
        ctx,
        data: this.data,
        endIndex: this.endIndex,
        mainTop: R.top,
        mainH,
        geometry: {
          chartLeft,
          chartRight,
          chartWidth: chartW,
          axisPad: geometry.axisPad,
          side: geometry.side,
        },
        linearToY,
        hidden: false,
        fontStack: CHART_FONT_STACK,
        formatPrice: (value) => formatWithComma(value, symbolPriceDigits),
      });
    }

    const drawingMetrics = this.getMainViewportMetrics();
    renderDrawingLayer({
      ctx,
      drawings: this.drawings,
      draft: this.drawingDraft,
      selectedDrawingId: this.selectedDrawingId,
      drawingsVisible: this.drawingsVisible,
      metrics: drawingMetrics,
      renderShape: (layerCtx, shape, isDraft, layerMetrics) => this.drawDrawingShape(layerCtx, shape, isDraft, layerMetrics),
      renderSelection: (layerCtx, shape, layerMetrics) => this.drawSelectionOverlay(layerCtx, shape, layerMetrics),
    });

    const isCoarsePointerDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const selectedShapeForDrawingCrosshair = this.selectedDrawingId
      ? this.drawings.find((s) => s.id === this.selectedDrawingId) ?? null
      : null;
    const textNoteAnchorPoint = selectedShapeForDrawingCrosshair?.kind === 'text-note'
      ? this.getDrawingAnchorScreenPoint(selectedShapeForDrawingCrosshair)
      : null;
    renderDrawingTouchCrosshair({
      ctx,
      width,
      height,
      plotHeight,
      xAxisHeight: X_AXIS_HEIGHT,
      isCoarsePointer: isCoarsePointerDevice,
      isMouseOver: this.isMouseOver,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      touchCrosshairX: this.touchDrawingCrosshairX,
      touchCrosshairY: this.touchDrawingCrosshairY,
      drawingTool: this.drawingTool,
      drawingDraft: this.drawingDraft,
      drawingMoveActive: Boolean(this.drawingMoveState),
      selectedShape: selectedShapeForDrawingCrosshair,
      textNoteEditorActive: Boolean(this.textNoteEditorEl || this.drawingMoveState?.baseShape.kind === 'text-note'),
      touchDrawingTapCount: this.touchDrawingTapCount,
      fontStack: CHART_FONT_STACK,
      textNoteAnchorPoint,
    });

    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const leftGap = Math.max(0, this.lastDrawMeta?.leftGap ?? 0);
    const totalSp = this.lastDrawMeta?.totalSp ?? (chartW / Math.max(1, visibleCount + leftGap));
    const candleW = this.lastDrawMeta?.candleW ?? Math.max(totalSp * 0.8, 1);
    const candleSlotOffset = this.lastDrawMeta?.candleSlotOffset ?? 0;
    const effectiveChartLeft = chartLeft + leftGap * totalSp + candleSlotOffset;
    const subPanelCrosshairData = this.lastDrawMeta?.subPanelCrosshairData;

    renderTradeFocusOverlay({
      ctx,
      focusedTradeRange: this.focusedTradeRange,
      focusVisualStartedAt: this.focusVisualStartedAt,
      data: this.data,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      isMouseOver: this.isMouseOver,
      chartLeft,
      chartRight,
      mainTop: R.top,
      mainH,
      axisPad: geometry.axisPad,
      axisSide: geometry.side,
      totalSp,
      effectiveChartLeft,
      candleW,
      mainScale,
      fontStack: CHART_FONT_STACK,
      priceDigits: symbolPriceDigits,
      requestOverlayDraw: () => this.requestOverlayDraw(),
    });

    renderGotoDateMarker({
      ctx,
      marker: this.gotoDateMarker,
      data: this.data,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      chartLeft,
      chartRight,
      mainTop: R.top,
      mainH,
      totalSp,
      candleW,
      fontStack: CHART_FONT_STACK,
      getY: mainScale?.toY ?? null,
      getCandleCenterX: (index) => this.getCandleCenterX(index),
    });

    const _isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;

    const keepCrosshairForDrawing = Boolean(this.drawingTool && this.drawingTool !== 'eraser')
      || Boolean(this.drawingDraft)
      || Boolean(this.drawingMoveState)
      || Boolean(this.selectedDrawingId);
    if (!this.isMouseOver && !keepCrosshairForDrawing) {
      if (!_isTouchDevice && this.onCrosshairOHLC && this._lastCrosshairOHLCIdx !== -1) {
        this._lastCrosshairOHLCIdx = -1;
        this.onCrosshairOHLC(null);
      }
      return;
    }

    // 드로잉 중에는 십자선 스냅 비활성(앵커 자석은 drawing_apply_magnet에서 별도 처리).
    // 드로잉 모드 밖에서는 자석 설정에 따라 십자선이 캔들에 스냅.
    let snapX = this.mouseX;
    let snappedCandleIndex = -1;
    const maxLocalDataIndex = Math.max(0, Math.min(visibleCount - 1, this.data.length - 1 - this.startIndex));
    const isInMainPanelForMagnet = this.mouseY >= R.top && this.mouseY <= mainH;
    const allowCrosshairXSnap = !this.drawingTool && this.drawingMagnetMode !== 'off';
    if (allowCrosshairXSnap && isInMainPanelForMagnet && this.mouseX >= chartLeft && this.mouseX <= chartRight) {
      const nearestIndex = Math.round((this.mouseX - effectiveChartLeft - candleW / 2) / totalSp);
      if (nearestIndex >= 0 && nearestIndex <= maxLocalDataIndex) {
        snapX = effectiveChartLeft + nearestIndex * totalSp + candleW / 2;
        snappedCandleIndex = this.startIndex + nearestIndex;
      }
    }
    // Keep crosshair guides unsnapped, but still resolve nearest candle for timeline/tooltip label.
    if (snappedCandleIndex < 0 && this.mouseX >= chartLeft && this.mouseX <= chartRight) {
      const nearestIndex = Math.round((this.mouseX - effectiveChartLeft - candleW / 2) / totalSp);
      if (nearestIndex >= 0 && nearestIndex <= maxLocalDataIndex) {
        snappedCandleIndex = this.startIndex + nearestIndex;
      }
    }

    const solidX = snapX;
    const selectedShape = this.getSelectedDrawing();
    const noDrawingInteraction = !this.drawingTool && !this.selectedDrawingId;
    const isDrawingEditMode = Boolean(this.drawingTool && this.drawingTool !== 'eraser');
    const selectedDrawingActive = !this.drawingTool && (
      Boolean(this.selectedDrawingId)
      || this.trendlineTextEditorEl != null
      || this.textNoteEditorEl != null
    );
    const onYAxis = this.isOnMainYAxis(this.mouseX, this.mouseY)
      || Boolean(this.getSubYAxisPanel(this.mouseX, this.mouseY));
    const onXAxis = this.isOnXAxis(this.mouseX, this.mouseY);
    const hitVwapAnchor = this.isVwapAnchorSelectionHit(this.mouseX, this.mouseY);
    const shouldDrawCrosshairGuides = shouldShowCrosshairGuides({
      isTouchDevice: _isTouchDevice,
      noDrawingInteraction,
      selectedDrawingActive,
      drawingToolActive: isDrawingEditMode,
      drawingMoveActive: Boolean(this.drawingMoveState),
      isCrosshairMode: this.isCrosshairMode,
      onYAxis,
      onXAxis,
    });

    if (shouldDrawCrosshairGuides) {
      const useBlueEditGuide = !noDrawingInteraction;
      renderCrosshairGuide({
        ctx,
        width,
        height,
        x: solidX,
        y: this.mouseY,
        pointerMode: this.pointerMode,
        useBlueEditGuide,
        hideCenterMarker: hitVwapAnchor,
      });
    }

    if (noDrawingInteraction && !onXAxis && snappedCandleIndex >= 0 && snappedCandleIndex < this.data.length) {
      const c = this.data[snappedCandleIndex];
      const label = formatCrosshairTimelineLabel(c.time, this.config.timezone);
      const isOnSignalCandle = _isTouchDevice && this.strategySignalVisible
        && (this.strategySignals[snappedCandleIndex] ?? 0) !== 0;
      const isUp = c.close >= c.open;
      const closeColor = isUp ? '#ef5350' : '#26a69a';
      const tradingValue = c.close * c.volume;
      const d = symbolPriceDigits;
      const tooltipRows: CrosshairTooltipRow[] = [
        { label: '시가', value: formatWithComma(c.open,  d), color: '#c9d4e8' },
        { label: '고가', value: formatWithComma(c.high,  d), color: '#ef5350' },
        { label: '저가', value: formatWithComma(c.low,   d), color: '#26a69a' },
        { label: '종가', value: formatWithComma(c.close, d), color: closeColor },
        { label: '거래량', value: formatKUnit(c.volume),        color: '#c9d4e8' },
        { label: '거래대금', value: formatKUnitWithComma(tradingValue), color: '#c9d4e8' },
      ];
      const tooltipResult = renderCrosshairTooltip({
        ctx,
        candle: c,
        label,
        x: solidX,
        y: this.mouseY,
        chartLeft,
        chartRight,
        mainTop: R.top,
        mainH,
        plotHeight,
        xAxisHeight: X_AXIS_HEIGHT,
        fontStack: CHART_FONT_STACK,
        rows: tooltipRows,
        showMobileTooltip: this.isMobileCrosshairTooltipEnabled() && (this.isCrosshairMode || this.mouseLongPressTooltipActive) && !isOnSignalCandle,
      });
      if (!tooltipResult.renderedMobileTooltip && this.onCrosshairOHLC && this._lastCrosshairOHLCIdx !== snappedCandleIndex) {
        this._lastCrosshairOHLCIdx = snappedCandleIndex;
        this.onCrosshairOHLC({ open: c.open, high: c.high, low: c.low, close: c.close, time: c.time });
      }
    }

    if (this.mouseY < mainH && mainScale && noDrawingInteraction && !onYAxis) {
      this.crosshairPlusHit = renderCrosshairPriceAxis({
        ctx,
        mouseY: this.mouseY,
        mainTop: R.top,
        mainH,
        chartRight,
        axisPad: geometry.axisPad,
        axisSide: geometry.side,
        axisLeft: geometry.axisLeft,
        axisRight: geometry.axisRight,
        lo: mainScale.lo,
        hi: mainScale.hi,
        noDrawingInteraction,
        onYAxis,
        plusHovered: this.crosshairPlusHovered,
        textColor: CHART_TEXT_PRIMARY,
        fontStack: CHART_FONT_STACK,
        formatPrice: (value) => formatWithComma(value, symbolPriceDigits),
      });
    } else {
      this.crosshairPlusHit = null;
    }

    // 보조지표 패널 크로스헤어: 좌측 Y축 수치 박스
    if (!onYAxis && this.mouseY >= mainH && this.mouseY <= plotHeight) {
      const hoveredPanelId = panels.find((id) => {
        if (hiddenPanels.has(id)) return false;
        const top = panelTops[id];
        const pH = plotHeight * this.getPanelRatio(id);
        return this.mouseY >= top && this.mouseY <= top + pH;
      });

      if (hoveredPanelId) {
        const panelTop = panelTops[hoveredPanelId];
        const panelHeight = plotHeight * this.getPanelRatio(hoveredPanelId);
        const titleH = 20;
        const availH = Math.max(panelHeight - titleH, 1);
        const plotH = availH * 0.95;
        const plotTop = panelTop + titleH + (availH - plotH) / 2;

        const crosshairValue = resolveSubPanelCrosshairValue({
          panelId: hoveredPanelId,
          data: this.data,
          indicators: this.config.indicators,
          visStart: this.startIndex,
          visEnd: this.endIndex,
          mouseY: this.mouseY,
          plotTop,
          plotH,
          dmiScaleRange: this.dmiScaleRange,
          getSubPanelScaledRange: (panelId, lo, hi) => this.getSubPanelScaledRange(panelId, lo, hi),
          resolveColor: (styleKey, fallbackColor) => this.resolveStyle(styleKey, fallbackColor).color,
          calcDMI: () => subPanelCrosshairData?.dmiD ?? { plusDI: [], minusDI: [], adx: [] },
          calcMACD: () => subPanelCrosshairData?.macdD ?? { hist: [], macdLine: [], sigLine: [] },
          calcCCI: () => subPanelCrosshairData?.cciD ?? [],
          calcATR: () => subPanelCrosshairData?.atrD ?? [],
          calcOBV: () => subPanelCrosshairData?.obvD ?? [],
          calcOBVSignal: () => subPanelCrosshairData?.obvSignal9 ?? [],
          calcCVD: () => subPanelCrosshairData?.cvdD ?? [],
          calcCVDSignal: () => subPanelCrosshairData?.cvdSignal9 ?? [],
          sma: (source, period) => this.sma(source, period),
          formatKUnit: (value, digits) => formatKUnit(value, digits),
        });

        this.hoveredSubIndicatorAddButton = renderSubPanelCrosshairAxis({
          ctx,
          panelId: hoveredPanelId,
          value: crosshairValue.value,
          labelText: crosshairValue.labelText,
          accentColor: crosshairValue.accentColor,
          width,
          panelTop,
          panelHeight,
          clampedY: crosshairValue.clampedY,
          axisSide: geometry.side,
          axisLeft: geometry.axisLeft,
          axisRight: geometry.axisRight,
          fontStack: CHART_FONT_STACK,
        });
      }
    }

    const hoverSignal = selectSignalHoverArea({
      areas: this.signalHitAreas,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      chartLeft,
      chartRight,
      candleW,
      totalSp,
      visibleCount,
      startIndex: this.startIndex,
      focusedSignalCandleIndex: this.focusedSignalCandleIndex,
    });

    this.hoveredSignalCandleIndex = hoverSignal?.candleIndex ?? null;

    renderSignalHoverOverlay({
      ctx,
      hoverSignal,
      width,
      chartLeft,
      chartRight,
      mainTop: R.top,
      mainH,
      axisPad: geometry.axisPad,
      axisSide: geometry.side,
      fontStack: CHART_FONT_STACK,
      mainScale,
      formatPrice: (value) => formatWithComma(value, symbolPriceDigits),
    });

  }

  // 마우스/휠 이벤트 핸들러

  private isHoveringCandle(mx: number, my: number): boolean {
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const geometry = this.getChartGeometry(width, this.lastDrawMeta?.axisPad);
    return isHoveringCandleBody({
      mx,
      my,
      data: this.data,
      viewportWidth: width,
      viewportHeight: height,
      xAxisHeight: X_AXIS_HEIGHT,
      chartLeft: geometry.chartLeft,
      chartRight: geometry.chartRight,
      chartWidth: geometry.chartWidth,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      rightGapBars: this.config.layout.rightGapBars ?? 0,
      activePanels: this.activePanels,
      getPanelRatio: (panelId) => this.getPanelRatio(panelId),
    });
  }

  private isOnMainYAxis(x: number, y: number): boolean {
    const meta = this.lastDrawMeta;
    if (!meta) return false;
    if (y < 0 || y > meta.mainH) return false;
    if (meta.axisSide === 'right') return x >= meta.chartRight;
    return x >= 0 && x <= meta.axisPad;
  }

  private isOnXAxis(x: number, y: number): boolean {
    if (y < this.viewportHeight - X_AXIS_HEIGHT || y > this.viewportHeight) return false;
    const meta = this.lastDrawMeta;
    if (!meta) return true;
    return x >= meta.chartLeft && x <= meta.chartRight;
  }

  private getSubYAxisPanel(x: number, y: number): string | null {
    const meta = this.lastDrawMeta as any;
    if (!meta?.panelTops || meta.subAxisStart == null) return null;
    if (meta.axisSide === 'right') {
      if (x < meta.subAxisStart) return null;
    } else {
      if (x < 0 || x > meta.axisPad) return null;
    }
    const tops = meta.panelTops as Record<string, number>;
    const heights = meta.subPanelHeights as Record<string, number>;
    for (const id of Object.keys(tops)) {
      const top = tops[id];
      const h = heights[id] ?? 0;
      if (y >= top && y < top + h) return id;
    }
    return null;
  }

  getSubPanelScaledRange(panelId: string, lo: number, hi: number): { lo: number; hi: number } {
    const sf = this.subPanelScaleFactors[panelId] ?? 1.0;
    if (sf === 1.0) return { lo, hi };
    const mid = (lo + hi) / 2;
    const half = (hi - lo) / 2 * sf;
    return { lo: mid - half, hi: mid + half };
  }

  private scheduleLogBtnHide(): void {
    if (this.logBtnHideTimer) return;
    this.logBtnHideTimer = setTimeout(() => {
      this.logBtnHideTimer = null;
      if (this.logBtn && !this._logBtnHovered && !this.yAxisDragging
          && !this.isOnMainYAxis(this.mouseX, this.mouseY)) {
        this.logBtn.style.display = 'none';
      }
    }, 250);
  }

  private updateLogBtnPosition(): void {
    if (!this.logBtn) return;
    const meta = this.lastDrawMeta;
    if (!meta) { this.logBtn.style.display = 'none'; return; }
    const btnH = 22;
    const axisCenter = meta.axisSide === 'right'
      ? meta.chartRight + (this.viewportWidth - meta.chartRight) / 2
      : meta.axisPad / 2;
    const btnW = this.logBtn.offsetWidth || 38;
    const onAxis = this.isOnMainYAxis(this.mouseX, this.mouseY) || this.yAxisDragging || this._logBtnHovered;
    if (onAxis) {
      if (this.logBtnHideTimer) { clearTimeout(this.logBtnHideTimer); this.logBtnHideTimer = null; }
      this.logBtn.style.display = 'block';
    } else {
      this.scheduleLogBtnHide();
    }
    this.logBtn.style.left = `${Math.round(axisCenter - btnW / 2)}px`;
    this.logBtn.style.top = `${Math.round(meta.mainH - btnH - 8)}px`;
  }

  private updateChartCursor(): void {
    const hitDrawing = this.findDrawingAt(this.mouseX, this.mouseY);
    const movingShape = this.drawingMoveState && this.selectedDrawingId
      ? this.drawings.find((shape) => shape.id === this.selectedDrawingId) ?? null
      : null;
    const hitSubAlert = this.findSubIndicatorAlertHit(this.mouseX, this.mouseY);
    const hitVwapAnchor = this.isVwapAnchorSelectionHit(this.mouseX, this.mouseY);
    this.canvas.style.cursor = resolveChartCursor({
      isMouseOver: this.isMouseOver,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      crosshairPlusHit: this.crosshairPlusHit,
      drawingTool: this.drawingTool,
      yAxisDragging: this.yAxisDragging,
      subYAxisDragging: Boolean(this.subYAxisDragging),
      xAxisDragging: this.xAxisDragging,
      isDragging: this.isDragging,
      drawingMoveActive: Boolean(this.drawingMoveState),
      selectedDrawingPart: this.selectedDrawingPart,
      movingShapeKind: movingShape?.kind ?? null,
      hitSubAlert: Boolean(hitSubAlert),
      hitVwapAnchor,
      hitDrawing,
      hoveringCandle: this.isHoveringCandle(this.mouseX, this.mouseY),
      onMainYAxis: this.isOnMainYAxis(this.mouseX, this.mouseY),
      onXAxis: this.isOnXAxis(this.mouseX, this.mouseY),
      hoveredSubIndicatorAddButton: this.hoveredSubIndicatorAddButton,
      subYAxisPanel: this.getSubYAxisPanel(this.mouseX, this.mouseY),
      pointerMode: this.pointerMode,
      cursors: {
        eraser: ERASER_CURSOR,
        nsResize: NS_RESIZE_CURSOR,
        ewResize: EW_RESIZE_CURSOR,
        xAxis: X_AXIS_CURSOR,
      },
    });
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const result = resolveWheelInteraction({
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      mouseX: this.mouseX,
      onMainYAxis: this.isOnMainYAxis(this.mouseX, this.mouseY),
      yScaleFactor: this.yScaleFactor,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      dataLength: this.data.length,
      mainViewportMetrics: this.getMainViewportMetrics(),
      normalizeHorizontalVirtualStart: (virtualStart, baseVirtualStart) => (
        this.normalizeHorizontalVirtualStart(virtualStart, baseVirtualStart)
      ),
      clampPanStartIndex: (startIndex, visibleCount) => this.clampPanStartIndex(startIndex, visibleCount),
    });

    if (result.type === 'y-scale') {
      this.yScaleFactor = result.yScaleFactor;
    } else {
      this.startIndex = result.startIndex;
      this.endIndex = result.endIndex;
    }
    this.requestMainDraw();
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.isMouseOver = true;
    this.isMouseDownForTooltip = true;
    this.startMouseLongPressTooltip();

    const axisInteraction = resolveMouseDownAxisInteraction({
      onMainYAxis: this.isOnMainYAxis(this.mouseX, this.mouseY),
      onXAxis: this.isOnXAxis(this.mouseX, this.mouseY),
      subYAxisPanel: this.getSubYAxisPanel(this.mouseX, this.mouseY),
    });

    if (axisInteraction.type === 'main-y-axis') {
      this.yAxisDragging = true;
      this.yAxisDragStartY = e.clientY;
      this.yAxisDragStartFactor = this.yScaleFactor;
      this.updateChartCursor();
      e.preventDefault();
      return;
    }
    if (axisInteraction.type === 'x-axis') {
      this.xAxisDragging = true;
      this.xAxisDragStartX = e.clientX;
      this.xAxisDragStartVisible = Math.max(1, this.endIndex - this.startIndex);
      this.xAxisDragStartIndex = this.startIndex;
      this.updateChartCursor();
      e.preventDefault();
      return;
    }
    if (axisInteraction.type === 'sub-y-axis') {
      this.subYAxisDragging = axisInteraction.panelId;
      this.subYAxisDragStartY = e.clientY;
      this.subYAxisDragStartFactor = this.subPanelScaleFactors[axisInteraction.panelId] ?? 1.0;
      this.updateChartCursor();
      e.preventDefault();
      return;
    }

    // 십자선 + 아이콘 클릭 → 수평선(hline) 생성
    // stale crosshairPlusHovered 의존하지 않고 클릭 시점 좌표로 직접 재계산
    const crosshairHlineAction = resolveCrosshairHlineAction({
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      hitArea: this.crosshairPlusHit,
      getAnchor: () => this.getMouseAnchor(this.mouseX, this.mouseY),
      fallbackIndex: this.startIndex,
    });
    if (crosshairHlineAction.type === 'create-hline') {
      this.drawings = upsertDrawingShape(this.drawings, createHlineDrawing({
        anchor: crosshairHlineAction.anchor,
        fallbackIndex: crosshairHlineAction.fallbackIndex,
        price: crosshairHlineAction.price,
        width: HLINE_DEFAULT_WIDTH,
      }));
      // 선택 해제 상태 유지 → 연속 생성 가능
      this.selectedDrawingId = null;
      this.selectedDrawingPart = 'line';
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      e.preventDefault();
      return;
    }

    const hitSubAlert = this.findSubIndicatorAlertHit(this.mouseX, this.mouseY);
    const subIndicatorAction = resolveSubIndicatorAlertMouseDown({
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      hitAlert: hitSubAlert,
      addButton: this.hoveredSubIndicatorAddButton,
    });
    if (subIndicatorAction.type === 'edit-alert') {
      const alert = this.subIndicatorAlerts.find((a) => a.id === subIndicatorAction.hit.id);
      if (alert) {
        this.openSubIndicatorAlertEditPopup(alert, {
          panelTop: subIndicatorAction.hit.panelTop,
          panelHeight: subIndicatorAction.hit.panelHeight,
        });
      }
      return;
    }
    if (subIndicatorAction.type === 'add-alert') {
      this.openSubIndicatorAlertPopup(
        subIndicatorAction.button.x,
        subIndicatorAction.button.y,
        {
          panelId: subIndicatorAction.button.panelId,
          value: subIndicatorAction.button.value,
          color: subIndicatorAction.button.color,
        },
      );
      return;
    }

    if (this.subIndicatorAlertPopupEl) {
      this.closeSubIndicatorAlertPopup();
    }

    if (!this.drawingTool && !this.drawingDraft) {
      const vwapHit = this.findVwapLineHit(this.mouseX, this.mouseY);
      if (vwapHit) {
        this.vwapAnchorSelection = { active: true };
        this.selectedDrawingId = null;
        this.selectedDrawingPart = 'line';
        this.drawingMoveState = null;
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        this.updateChartCursor();
        e.preventDefault();
        return;
      }
      if (this.vwapAnchorSelection?.active && !this.isVwapAnchorSelectionHit(this.mouseX, this.mouseY)) {
        this.vwapAnchorSelection = null;
        this.requestOverlayDraw();
      }
    }

    if (this.drawingTool === 'channel' && this.pendingChannelId) {
      const pending = this.drawings.find((shape) => shape.id === this.pendingChannelId && shape.kind === 'channel');
      if (pending && !pending.locked) {
        this.selectedDrawingId = pending.id;
        this.selectedDrawingPart = 'channel-offset';
        this.drawingMoveState = {
          startX: this.mouseX,
          startY: this.mouseY,
          baseShape: this.cloneShape(pending),
        };
        this.isDragging = false;
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        this.updateChartCursor();
        return;
      }
      this.pendingChannelId = null;
    }

    // TradingView-like quick measure: hold Shift and click on chart to start/finish measuring.
    if (e.shiftKey) {
      const shiftAnchor = this.getMouseAnchor(this.mouseX, this.mouseY);
      if (shiftAnchor) {
        const measureResult = resolveMeasureDraftClick(
          this.drawingDraft,
          shiftAnchor,
          this.lastDrawMeta?.maxP ?? 1,
        );
        if (measureResult.type === 'start') {
          this.drawingDraft = measureResult.draft;
          this.drawingDragActive = true;
          this.requestOverlayDraw();
          return;
        }
        if (measureResult.type === 'created') {
          const created = measureResult.shape;
          this.upsertDrawing(created);
          this.selectedDrawingId = created.id;
          this.selectedDrawingPart = 'end';
          this.syncDrawingToolbar();
        }
        this.drawingDraft = null;
        this.drawingDragActive = false;
        this.requestOverlayDraw();
        return;
      }
    }

    const hitDrawing = this.findDrawingAt(this.mouseX, this.mouseY);
    const hoveredGuideTrendline = (
      !this.drawingTool
      && this.hoveredDrawingPart === 'trendline-text-guide'
      && this.hoveredDrawingId
    )
      ? this.drawings.find((shape) => shape.id === this.hoveredDrawingId && this.isTextEditableDrawingShape(shape)) ?? null
      : null;
    const editAction = resolveDrawingMouseDownEditAction({
      hitDrawing,
      clickDetail: e.detail,
      drawingToolActive: Boolean(this.drawingTool),
      hoveredGuideShape: hoveredGuideTrendline,
      isTextEditableDrawing: (shape) => this.isTextEditableDrawingShape(shape),
    });
    if (editAction.type === 'edit-anchored-vwap') {
      this.selectedDrawingId = editAction.shape.id;
      this.selectedDrawingPart = editAction.part;
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openAnchoredVwapSettingsModal(editAction.shape);
      this.requestOverlayDraw();
      this.updateChartCursor();
      return;
    }
    if (editAction.type === 'edit-position-settings') {
      this.selectedDrawingId = editAction.shape.id;
      this.selectedDrawingPart = editAction.part;
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openPositionSettingsPopup(editAction.shape);
      this.requestOverlayDraw();
      this.updateChartCursor();
      return;
    }
    if (editAction.type === 'edit-trendline-text') {
      this.selectedDrawingId = editAction.shape.id;
      this.selectedDrawingPart = editAction.part;
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openTrendlineTextEditor(editAction.shape);
      this.updateChartCursor();
      return;
    }
    if (this.drawingTool === 'eraser') {
      if (hitDrawing) {
        this.deleteDrawing(hitDrawing.shape.id);
        window.dispatchEvent(new CustomEvent('chart-toolbox-trash-refresh'));
      }
      this.updateChartCursor();
      return;
    }
    if (!this.drawingTool && hitDrawing && hitDrawing.shape.kind === 'measure') {
      this.drawings = deleteDrawingById(this.drawings, hitDrawing.shape.id);
      if (this.selectedDrawingId === hitDrawing.shape.id) {
        this.selectedDrawingId = null;
        this.selectedDrawingPart = 'line';
        this.drawingMoveState = null;
      }
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      this.updateChartCursor();
      return;
    }
    if (!this.drawingTool && !this.drawingDraft) {
      const hasMeasure = this.drawings.some((shape) => shape.kind === 'measure');
      const clickedMeasure = Boolean(hitDrawing && hitDrawing.shape.kind === 'measure');
      if (hasMeasure && !clickedMeasure) {
        this.drawings = deleteDrawingsByKind(this.drawings, 'measure');
        if (this.selectedDrawingId) {
          const selected = this.drawings.find((shape) => shape.id === this.selectedDrawingId) ?? null;
          if (!selected) {
            this.selectedDrawingId = null;
            this.selectedDrawingPart = 'line';
            this.drawingMoveState = null;
          }
        }
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        this.updateChartCursor();
        return;
      }
    }
    if (this.selectedDrawingId && (!hitDrawing || hitDrawing.shape.id !== this.selectedDrawingId)) {
      this.clearDrawingSelection();
      if (!this.drawingTool && !hitDrawing) {
        this.updateChartCursor();
        return;
      }
    }
    if (!this.drawingTool && hitDrawing) {
      const metrics = this.getMainViewportMetrics();
      const normalizedPart = normalizePositionDrawingHitPart({
        shape: hitDrawing.shape,
        part: hitDrawing.part,
        mouseX: this.mouseX,
        mouseY: this.mouseY,
        metrics,
        xForIndex: (index, totalSp, candleW) => this.xForIndex(index, totalSp, candleW),
      });

      this.selectedDrawingId = hitDrawing.shape.id;
      this.selectedDrawingPart = normalizedPart;
      this.drawingMoveDistance = 0;
      this.drawingMoveState = hitDrawing.shape.locked
        ? null
        : {
            startX: this.mouseX,
            startY: this.mouseY,
            baseShape: this.cloneShape(hitDrawing.shape),
          };
      this.isDragging = false;
      this.syncDrawingToolbar();
      this.refreshDrawingSelectionVisual(hitDrawing.shape);
      this.updateChartCursor();
      return;
    }

    const anchor = this.getMouseAnchor(this.mouseX, this.mouseY);
    if (this.drawingTool && anchor) {
      if (this.drawingTool === 'draw-pencil' || this.drawingTool === 'draw-highlighter') {
        this.drawingDraft = {
          kind: this.drawingTool,
          a: anchor,
          b: anchor,
          points: [anchor],
        };
        this.drawingDragActive = true;
        this.requestOverlayDraw();
        return;
      }
      if (this.drawingTool === 'measure') {
        const measureResult = resolveMeasureDraftClick(
          this.drawingDraft,
          anchor,
          this.lastDrawMeta?.maxP ?? 1,
        );
        if (measureResult.type === 'start') {
          this.drawingDraft = measureResult.draft;
          this.drawingDragActive = true;
          this.requestOverlayDraw();
          return;
        }
        if (measureResult.type === 'created') {
          const created = measureResult.shape;
          this.upsertDrawing(created);
          this.selectedDrawingId = created.id;
          this.selectedDrawingPart = 'end';
          this.syncDrawingToolbar();
        }
        this.drawingDraft = null;
        this.drawingDragActive = false;
        this.setDrawingTool(null);
        this.requestOverlayDraw();
        return;
      }
      if (this.drawingTool === 'long-position' || this.drawingTool === 'short-position') {
        // PC 모드: 1단계 (클릭 1회 → 즉시 완성)
        const defaults = this.position_calc_defaults(this.mouseX, this.mouseY, false);
        if (!defaults) { this.requestOverlayDraw(); return; }
        const { anchor: snappedAnchor, defaultRisk, defaultBars } = defaults;
        const isLong      = this.drawingTool === 'long-position';
        const created = createPositionDrawing({
          kind: this.drawingTool,
          anchor: snappedAnchor,
          defaultRisk,
          defaultBars,
        });
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'position-target';
        this.syncDrawingToolbar();
        this.drawingDraft = null;
        this.setDrawingTool(null);
        const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        if (!isCoarsePointer) this.showPositionGuide(1, isLong ? 'long-position' : 'short-position');
        this.requestOverlayDraw();
        return;
      }
      if (isPatternDrawingKind(this.drawingTool)) {
        this.appendPatternPoint(this.drawingTool, anchor);
        return;
      }
      if (this.drawingTool === 'fib-trend') {
        if (!this.drawingDraft || this.drawingDraft.kind !== 'fib-trend' || this.fibTrendPointStage === 0) {
          this.drawingDraft = {
            kind: 'fib-trend',
            a: anchor,
            b: anchor,
            channelOffset: { index: 0, price: 0 },
          };
          this.fibTrendPointStage = 1;
          this.requestOverlayDraw();
          return;
        }
        if (this.fibTrendPointStage === 1) {
          this.drawingDraft.b = anchor;
          this.fibTrendPointStage = 2;
          this.requestOverlayDraw();
          return;
        }
        if (this.fibTrendPointStage === 2) {
          const baseA = this.drawingDraft.a;
          const baseB = this.drawingDraft.b;
          const moved = Math.abs(baseA.index - baseB.index) > 0.2 || Math.abs(baseA.price - baseB.price) > Math.max(1e-6, (this.lastDrawMeta?.maxP ?? 1) * 0.0005);
          if (moved) {
            const created = createFibTrendDrawing({ a: baseA, b: baseB, offsetAnchor: anchor });
            this.upsertDrawing(created);
            this.selectedDrawingId = created.id;
            this.selectedDrawingPart = 'fib-offset';
            this.syncDrawingToolbar();
          }
          this.drawingDraft = null;
          this.fibTrendPointStage = 0;
          this.setDrawingTool(null);
          this.requestOverlayDraw();
          return;
        }
      }
      if (this.drawingTool === 'hline') {
        const created = createHlineDrawing({
          anchor,
          fallbackIndex: this.startIndex,
          price: anchor.price,
          color: '#2f6cff',
          width: HLINE_DEFAULT_WIDTH,
        });
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'line';
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        return;
      }
      if (this.drawingTool === 'vertical-line' || this.drawingTool === 'cross-line') {
        const created = createSingleAnchorLineDrawing({
          kind: this.drawingTool,
          anchor,
          fallbackIndex: this.startIndex,
          fallbackPrice: anchor.price,
          color: '#2f6cff',
          width: HLINE_DEFAULT_WIDTH,
        });
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'line';
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        return;
      }
      if (this.drawingTool === 'anchored-vwap') {
        const created = this.createAnchoredVwapDrawing(anchor);
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'start';
        this.syncDrawingToolbar();
        this.refreshDrawingSelectionVisual(created);
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        return;
      }
      if (this.drawingTool === 'text-note') {
        const created = this.createTextNoteAt(anchor);
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        this.openTextNoteEditor(created);
        return;
      }
      this.drawingDraft = {
        kind: this.drawingTool,
        a: anchor,
        b: anchor,
        channelOffset: this.drawingTool === 'channel' ? { index: 0, price: 0 } : undefined,
      };
      this.drawingDragActive = true;
      this.requestOverlayDraw();
      return;
    }
    this.clearDrawingSelection();
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartIndex = this.startIndex;
    this.dragStartLeftPanBars = this.leftPanBars;
    this.dragStartPriceOffset = this.mainPricePanOffset;
    this.requestOverlayDraw();
    this.updateChartCursor();
  }

  private handleDoubleClick(e: MouseEvent): void {
    if (e.button !== 0) return;
    if (this.drawingTool) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    this.mouseX = mx;
    this.mouseY = my;
    this.isMouseOver = true;
    // 보조지표 Y축 더블클릭 → 스케일 초기화
    const subPanel = this.getSubYAxisPanel(mx, my);
    if (subPanel) {
      delete this.subPanelScaleFactors[subPanel];
      this.draw();
      e.preventDefault();
      return;
    }
    if (!this.drawingTool && this.isVwapAnchorSelectionHit(mx, my)) {
      this.openVwapSettingsFromAnchor();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const hitDrawing = this.findDrawingAt(mx, my);
    const drawingAction = resolveDrawingDoubleClickAction(hitDrawing, (shape) => this.isTextEditableDrawingShape(shape));
    if (drawingAction.type === 'edit-trendline-text') {
      this.selectedDrawingId = drawingAction.shape.id;
      this.selectedDrawingPart = drawingAction.part;
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openTrendlineTextEditor(drawingAction.shape);
      this.updateChartCursor();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (drawingAction.type === 'edit-text-note') {
      this.selectedDrawingId = drawingAction.shape.id;
      this.selectedDrawingPart = drawingAction.part;
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openTextNoteEditor(drawingAction.shape);
      this.updateChartCursor();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left; this.mouseY = e.clientY - rect.top;
    if (this.drawingMoveState) {
      const movingShape = this.selectedDrawingId
        ? this.drawings.find((shape) => shape.id === this.selectedDrawingId) ?? null
        : null;
      const constrained = constrainPositionDrawingPointer({
        shape: movingShape,
        part: this.selectedDrawingPart,
        x: this.mouseX,
        y: this.mouseY,
        startX: this.drawingMoveState.startX,
        startY: this.drawingMoveState.startY,
      });
      this.mouseX = constrained.x;
      this.mouseY = constrained.y;
    }
    this.isMouseOver = true;

    if (this.xAxisDragging) {
      const range = resolveXAxisDragRange({
        clientX: e.clientX,
        dragStartX: this.xAxisDragStartX,
        dragStartVisible: this.xAxisDragStartVisible,
        dragStartIndex: this.xAxisDragStartIndex,
        dataLength: this.data.length,
      });
      this.startIndex = range.startIndex;
      this.endIndex = range.endIndex;
      this.requestMainDraw();
      return;
    }
    if (this.yAxisDragging) {
      this.yScaleFactor = resolveMainYAxisDragScale(e.clientY, this.yAxisDragStartY, this.yAxisDragStartFactor);
      this.requestMainDraw();
      return;
    }
    if (this.subYAxisDragging) {
      this.subPanelScaleFactors[this.subYAxisDragging] = resolveSubYAxisDragScale(
        e.clientY,
        this.subYAxisDragStartY,
        this.subYAxisDragStartFactor,
      );
      this.requestMainDraw();
      return;
    }

    const hoveredDrawing = this.findDrawingAt(this.mouseX, this.mouseY);
    this.hoveredDrawingId = hoveredDrawing?.shape.id ?? null;
    this.hoveredDrawingPart = hoveredDrawing?.part ?? null;

    // + 아이콘 hover 감지
    if (this.crosshairPlusHit) {
      const wasHovered = this.crosshairPlusHovered;
      this.crosshairPlusHovered = isPointInCircle(this.crosshairPlusHit, this.mouseX, this.mouseY);
      if (this.crosshairPlusHovered !== wasHovered) this.requestOverlayDraw();
    } else {
      this.crosshairPlusHovered = false;
    }

    this.updateChartCursor();
    this.updateLogBtnPosition();
    if (this.drawingMoveState && this.selectedDrawingId) {
      const moveResult = applyDrawingMove({
        pointerX: this.mouseX,
        pointerY: this.mouseY,
        moveState: this.drawingMoveState,
        selectedPart: this.selectedDrawingPart,
        currentMoveDistance: this.drawingMoveDistance,
        moveShapeByDelta: (baseShape, dx, dy, part) => this.moveShapeByDelta(baseShape, dx, dy, part),
      });
      this.drawingMoveDistance = moveResult.moveDistance;
      this.upsertDrawing(moveResult.movedShape);
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      return;
    }
    if (this.drawingTool && isPatternDrawingKind(this.drawingTool) && this.drawingDraft) {
      const anchor = this.getMouseAnchor(this.mouseX, this.mouseY);
      if (anchor) this.updatePatternDraftPreview(anchor);
      this.requestOverlayDraw();
      return;
    }
    if (this.drawingTool === 'fib-trend' && this.drawingDraft && this.drawingDraft.kind === 'fib-trend') {
      const anchor = this.getMouseAnchor(this.mouseX, this.mouseY);
      if (anchor) {
        if (this.fibTrendPointStage === 1) {
          this.drawingDraft.b = anchor;
        } else if (this.fibTrendPointStage === 2) {
          this.drawingDraft.channelOffset = {
            index: anchor.index - this.drawingDraft.a.index,
            price: anchor.price - this.drawingDraft.a.price,
          };
        }
      }
      this.requestOverlayDraw();
      return;
    }
    if (this.drawingDragActive && this.drawingDraft) {
      const anchor = this.getMouseAnchor(this.mouseX, this.mouseY);
      if (anchor) {
        updateDrawingDraftAnchor(this.drawingDraft, anchor);
      }
      this.requestOverlayDraw();
      return;
    }
    this.requestOverlayDraw();
    if (!this.isDragging) return;
    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const chartW = this.getChartGeometry(this.viewportWidth, this.lastDrawMeta?.axisPad).chartWidth;
    let changed = false;
    const virtualStart = resolveHorizontalPanVirtualStart({
      pointerX: e.clientX,
      dragStartX: this.dragStartX,
      dragStartIndex: this.dragStartIndex,
      dragStartLeftPanBars: this.dragStartLeftPanBars,
      chartWidth: chartW,
      visibleCount,
      rightGapBars: this.config.layout.rightGapBars ?? 0,
      normalizeHorizontalVirtualStart: (nextVirtualStart, baseVirtualStart) => (
        this.normalizeHorizontalVirtualStart(nextVirtualStart, baseVirtualStart)
      ),
    });
    if (virtualStart != null) {
      if (this.applyHorizontalPan(virtualStart, visibleCount)) changed = true;
    }
    if (this.isVerticalPanEnabled()) {
      const nextPriceOffset = resolveVerticalPanOffset({
        pointerY: e.clientY,
        dragStartY: this.dragStartY,
        dragStartPriceOffset: this.dragStartPriceOffset,
        currentPriceOffset: this.mainPricePanOffset,
        pricePerPixel: this.getMainPricePerPixel(),
      });
      if (nextPriceOffset != null) {
        this.mainPricePanOffset = nextPriceOffset;
        changed = true;
      }
    }
    if (changed) {
      this.requestMainDraw();
    }
  }

  private handleMouseUp() {
    this.isMouseDownForTooltip = false;
    this.stopMouseLongPressTooltip();
    if (this.xAxisDragging) {
      this.xAxisDragging = false;
      this.updateChartCursor();
      return;
    }
    if (this.yAxisDragging) {
      this.yAxisDragging = false;
      this.updateChartCursor();
      return;
    }
    if (this.subYAxisDragging) {
      this.subYAxisDragging = null;
      this.updateChartCursor();
      return;
    }
    if (this.drawingMoveState) {
      const moveEnd = resolveDrawingMoveEnd({
        moveState: this.drawingMoveState,
        moveDistance: this.drawingMoveDistance,
        textNoteTapThreshold: SimpleChart.TEXT_NOTE_TOUCH_TAP_MOVE_THRESHOLD,
        pendingChannelId: this.pendingChannelId,
        selectedDrawingId: this.selectedDrawingId,
        selectedPart: this.selectedDrawingPart,
      });
      if (moveEnd.shouldDisarmPendingChannel) {
        this.pendingChannelId = null;
        this.setDrawingTool(null);
      }
      this.drawingMoveState = null;
      this.drawingMoveDistance = 0;
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      this.updateChartCursor();
      if (moveEnd.baseShape.kind === 'text-note' && moveEnd.wasClickOnly) {
        const current = this.drawings.find((shape) => shape.id === moveEnd.baseShape.id && shape.kind === 'text-note');
        if (current) this.openTextNoteEditor(current);
      }
      return;
    }
    if (this.drawingDragActive && this.drawingDraft) {
      const finishResult = finishDrawingDraft(this.drawingDraft, this.lastDrawMeta?.maxP ?? 1);
      if (finishResult.status === 'skip-measure') {
        this.requestOverlayDraw();
        this.updateChartCursor();
        return;
      }
      if (finishResult.status === 'created') {
        const created = finishResult.shape;
        if (created.kind === 'channel') {
          created.channelOffset = this.getDefaultChannelOffset(created.a, created.b ?? created.a);
        }
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = created.kind === 'channel' ? 'channel-offset' : 'line';
        this.pendingChannelId = null;
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        this.syncDrawingToolbar();
        if (created.kind === 'draw-circle') {
          this.openTrendlineTextEditor(created);
        }
      }
      this.drawingDraft = null;
      this.drawingDragActive = false;
      this.requestOverlayDraw();
      this.updateChartCursor();
      return;
    }
    this.isDragging = false;
    this.updateChartCursor();
  }

  // ── 모바일 터치 핸들러 ────────────────────────

  private getTouchDist(t: TouchList): number {
    if (t.length < 2) return 0;
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 캔버스 상의 터치 좌표를 rect-보정해서 반환 */
  private touchPos(touch: Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  /** 롱프레스 타이머 취소 */
  private cancelLongPress() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // ── 드로잉 완료 (터치 드로잉 및 기타 용도) ─────────────────────────────
  private completeDrawing(): void {
    if (!this.drawingDraft) return;

    const finishResult = finishDrawingDraft(this.drawingDraft, this.lastDrawMeta?.maxP ?? 1);
    if (finishResult.status === 'created') {
      const created = finishResult.shape;
      
      // 채널은 기울기 방향 기준 기본 간격 오프셋을 자동 적용
      if (created.kind === 'channel') {
        created.channelOffset = this.getDefaultChannelOffset(created.a, created.b ?? created.a);
      }
      
      this.upsertDrawing(created);
      this.selectedDrawingId = created.id;
      this.selectedDrawingPart = created.kind === 'channel' ? 'channel-offset' : 'line';
      this.pendingChannelId = null;
      if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
      
      this.syncDrawingToolbar();
      if (created.kind === 'draw-circle') {
        this.openTrendlineTextEditor(created);
      }
    }
    
    this.drawingDraft = null;
    this.drawingDragActive = false;
    this.requestOverlayDraw();
    this.updateChartCursor();
  }

  /** 십자선 모드 해제 */
  private exitCrosshairMode() {
    if (!this.isCrosshairMode) return;
    this.isCrosshairMode = false;
    this.isMouseOver     = false;
    if (this.crosshairAutoHideTimer !== null) {
      clearTimeout(this.crosshairAutoHideTimer);
      this.crosshairAutoHideTimer = null;
    }
    this.requestOverlayDraw();
  }

  /** 기본 십자선 자동 숨김 타이머 재시작 */
  private crosshair_reset_auto_hide() {
    if (this.crosshairAutoHideTimer !== null) {
      clearTimeout(this.crosshairAutoHideTimer);
      this.crosshairAutoHideTimer = null;
    }
  }

  /** 드로잉 드래프트 초기화 (터치 또는 마우스) */
  private initializeDrawingDraft(anchor: DrawingAnchor): void {
    if (!this.drawingTool || this.drawingTool === 'eraser') return;

    // 기본 드래프트 생성
    this.drawingDraft = {
      kind: this.drawingTool,
      a: anchor,
      b: anchor,
    };

    // 채널은 채널오프셋 필요
    if (this.drawingTool === 'channel') {
      this.drawingDraft.channelOffset = { index: 0, price: 0 };
    }

    // 피보나치 추세는 단계별 처리
    if (this.drawingTool === 'fib-trend') {
      this.fibTrendPointStage = 1;
      this.drawingDraft.channelOffset = undefined;
    }

    this.drawingDragActive = true;
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const pos = this.touchPos(touch);
      const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      this.touchStartX = pos.x;
      this.touchStartY = pos.y;

      // ??????????????????????????????????????????????????????????????????
      // ? 기존 드로잉 선택: 드래그해서 편집 가능
      // ??????????????????????????????????????????????????????????????????
      const hitDrawing = this.findDrawingAt(pos.x, pos.y);
      const selectedTextNote = !this.drawingTool && isCoarsePointer && !this.textNoteEditorEl && this.selectedDrawingId
        ? this.drawings.find((shape) => shape.id === this.selectedDrawingId && shape.kind === 'text-note') ?? null
        : null;
      const selectedTextNoteAnchor = selectedTextNote ? this.getDrawingAnchorScreenPoint(selectedTextNote) : null;
      if (!hitDrawing && selectedTextNote && selectedTextNoteAnchor
          && Math.hypot(pos.x - selectedTextNoteAnchor.x, pos.y - selectedTextNoteAnchor.y) <= SimpleChart.TEXT_NOTE_TOUCH_HIT_RADIUS) {
        this.selectedDrawingPart = 'body';
        this.drawingMoveDistance = 0;
        this.touchDrawingCrosshairX = selectedTextNoteAnchor.x;
        this.touchDrawingCrosshairY = selectedTextNoteAnchor.y;
        this.mouseX = selectedTextNoteAnchor.x;
        this.mouseY = selectedTextNoteAnchor.y;
        this.isMouseOver = true;
        this.drawingMoveState = selectedTextNote.locked
          ? null
          : {
              startX: pos.x,
              startY: pos.y,
              baseShape: this.cloneShape(selectedTextNote),
            };
        if (selectedTextNote.locked) this.openTextNoteEditor(selectedTextNote);
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        this.updateChartCursor();
        return;
      }
      if (isCoarsePointer && this.textNoteEditorEl) {
        const editingShapeId = this.textNoteEditorShapeId;
        if (!hitDrawing || hitDrawing.shape.id !== editingShapeId) {
          this.closeTextNoteEditor(true);
          this.clearDrawingSelection();
          this.updateChartCursor();
        }
      }
      if (
        hitDrawing
        && (hitDrawing.shape.kind === 'long-position' || hitDrawing.shape.kind === 'short-position')
        && hitDrawing.part === 'position-entry-info'
      ) {
        this.selectedDrawingId = hitDrawing.shape.id;
        this.selectedDrawingPart = hitDrawing.part;
        this.drawingMoveState = null;
        this.syncDrawingToolbar();
        this.openPositionSettingsPopup(hitDrawing.shape);
        this.requestOverlayDraw();
        this.updateChartCursor();
        return;
      }
      if (
        !this.drawingTool
        && hitDrawing
        && this.isTextEditableDrawingShape(hitDrawing.shape)
        && (
          hitDrawing.part === 'trendline-text-guide'
          || (hitDrawing.part === 'body' && this.selectedDrawingId === hitDrawing.shape.id)
        )
      ) {
        this.selectedDrawingId = hitDrawing.shape.id;
        this.selectedDrawingPart = hitDrawing.part === 'trendline-text-guide' ? 'trendline-text-guide' : 'body';
        this.drawingMoveState = null;
        this.syncDrawingToolbar();
        this.openTrendlineTextEditor(hitDrawing.shape);
        this.updateChartCursor();
        return;
      }
      if (!this.drawingTool && hitDrawing && hitDrawing.shape.kind === 'text-note') {
        if (isCoarsePointer) {
          if (this.textNoteEditorEl) {
            this.closeTextNoteEditor(true);
            this.clearDrawingSelection();
            this.updateChartCursor();
            return;
          }
          const alreadySelected = this.selectedDrawingId === hitDrawing.shape.id;
          const anchorPoint = this.getDrawingAnchorScreenPoint(hitDrawing.shape);
          const hitEditCrosshair = Boolean(
            alreadySelected
            && anchorPoint
            && Math.hypot(pos.x - anchorPoint.x, pos.y - anchorPoint.y) <= SimpleChart.TEXT_NOTE_TOUCH_HIT_RADIUS,
          );
          this.selectedDrawingId = hitDrawing.shape.id;
          this.selectedDrawingPart = 'body';
          this.drawingMoveDistance = 0;
          if (anchorPoint) {
            this.touchDrawingCrosshairX = anchorPoint.x;
            this.touchDrawingCrosshairY = anchorPoint.y;
            this.mouseX = anchorPoint.x;
            this.mouseY = anchorPoint.y;
            this.isMouseOver = true;
          }
          this.drawingMoveState = (hitEditCrosshair || alreadySelected) && !hitDrawing.shape.locked
            ? {
                startX: pos.x,
                startY: pos.y,
                baseShape: this.cloneShape(hitDrawing.shape),
              }
            : null;
          if ((hitEditCrosshair || alreadySelected) && hitDrawing.shape.locked) this.openTextNoteEditor(hitDrawing.shape);
          this.syncDrawingToolbar();
          this.requestOverlayDraw();
          this.updateChartCursor();
          return;
        }
        this.selectedDrawingId = hitDrawing.shape.id;
        this.selectedDrawingPart = 'body';
        this.drawingMoveState = null;
        this.syncDrawingToolbar();
        this.openTextNoteEditor(hitDrawing.shape);
        this.updateChartCursor();
        return;
      }

      if (this.drawingTool === 'eraser') {
        if (hitDrawing) {
          this.deleteDrawing(hitDrawing.shape.id);
          window.dispatchEvent(new CustomEvent('chart-toolbox-trash-refresh'));
          this.requestOverlayDraw();
        }
        this.updateChartCursor();
        return;
      }
      if (!this.drawingTool && !this.drawingDraft) {
        const hasMeasure = this.drawings.some((shape) => shape.kind === 'measure');
        if (hasMeasure && !hitDrawing) {
          this.drawings = deleteDrawingsByKind(this.drawings, 'measure');
          if (this.selectedDrawingId) {
            const selected = this.drawings.find((shape) => shape.id === this.selectedDrawingId) ?? null;
            if (!selected) {
              this.selectedDrawingId = null;
              this.selectedDrawingPart = 'line';
              this.drawingMoveState = null;
            }
          }
          this.syncDrawingToolbar();
          this.requestOverlayDraw();
          this.updateChartCursor();
          return;
        }
      }
      if (hitDrawing && !hitDrawing.shape.locked) {
        this.selectedDrawingId = hitDrawing.shape.id;
        this.selectedDrawingPart = hitDrawing.part;
        this.drawingMoveState = {
          startX: pos.x,
          startY: pos.y,
          baseShape: this.cloneShape(hitDrawing.shape),
        };
        // Trendline 복제(카피)는 라인(line) 롱프레스에서만 동작.
        // 앵커(start/end) 롱프레스는 이동/조절로만 처리한다.
        if (this.isTrendlineShape(hitDrawing.shape) && hitDrawing.part === 'line') {
          this.cancelLongPress();
          const capturedPos = { x: pos.x, y: pos.y };
          this.longPressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
            const dup: DrawingShape = {
              ...this.cloneShape(hitDrawing.shape),
              id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            };
            this.drawings = upsertDrawingShape(this.drawings, dup);
            this.selectedDrawingId = dup.id;
            this.selectedDrawingPart = 'line';
            this.drawingMoveState = {
              startX: capturedPos.x,
              startY: capturedPos.y,
              baseShape: this.cloneShape(dup),
            };
            this.syncDrawingToolbar();
            this.requestOverlayDraw();
          }, SimpleChart.LONG_PRESS_MS);
        }
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        this.updateChartCursor();
        return;
      }

      // ── 드로잉을 찾지 못함 → 이전 선택 해제 + 편집 종료 ─────────────
      if (!hitDrawing && this.selectedDrawingId) {
        if (this.textNoteEditorEl) this.closeTextNoteEditor(true);
        this.clearDrawingSelection();
        this.setDrawingTool(null);
        this.updateChartCursor();
      }

      // ??????????????????????????????????????????????????????????????????
      // ? 터치 드로잉 모드
      // ??????????????????????????????????????????????????????????????????
      if (this.drawingTool) {
        // 드로잉 십자선 위치 업데이트 (자석 스냅 적용)
        const snapped = this.crosshair_snap_to_candle(pos.x, pos.y);
        this.touchDrawingCrosshairX = snapped.x;
        this.touchDrawingCrosshairY = snapped.y;
        this.mouseX = snapped.x;
        this.mouseY = snapped.y;
        this.isMouseOver = true;
        // 자유 드로잉은 기본 열십자 라인을 유지
        if (this.isCrosshairMode && this.drawingTool !== 'draw-pencil' && this.drawingTool !== 'draw-highlighter') {
          this.exitCrosshairMode();
        }

        // ── Position: 십자선 이동만, 박스생성은 touchEnd ──────────────────
        if (this.drawingTool === 'long-position' || this.drawingTool === 'short-position') {
          this.requestOverlayDraw();
          return;
        }

        if (this.drawingTool === 'anchored-vwap') {
          this.requestOverlayDraw();
          return;
        }

        if (isPatternDrawingKind(this.drawingTool)) {
          this.requestOverlayDraw();
          return;
        }

        // ── fib-trend: 십자선 이동만, 앵커 확정은 touchEnd ─────────────────
        if (this.drawingTool === 'fib-trend') {
          this.requestOverlayDraw();
          return;
        }
        if (this.drawingTool === 'text-note') {
          if (isCoarsePointer) {
            this.requestOverlayDraw();
            return;
          }
          const anchor = this.getMouseAnchor(snapped.x, snapped.y);
          if (!anchor) { this.requestOverlayDraw(); return; }
          const created = this.createTextNoteAt(anchor);
          this.isCrosshairMode = false;
          if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
          this.openTextNoteEditor(created);
          return;
        }
        if (this.drawingTool === 'draw-pencil' || this.drawingTool === 'draw-highlighter') {
          const anchor = this.getMouseAnchor(pos.x, pos.y);
          if (!anchor) { this.requestOverlayDraw(); return; }
          this.drawingDraft = {
            kind: this.drawingTool,
            a: anchor,
            b: anchor,
            points: [anchor],
          };
          this.drawingDragActive = true;
          this.requestOverlayDraw();
          return;
        }

        // ── 일반 드로잉: 드래그 기반 ──────────────────────────────────────
        const anchor = this.getMouseAnchor(pos.x, pos.y);
        if (!anchor) { this.requestOverlayDraw(); return; }

        if (!this.drawingDraft) {
          this.drawingDraft = {
            kind: this.drawingTool,
            a: anchor, b: anchor,
            channelOffset: this.drawingTool === 'channel' ? { index: 0, price: 0 } : undefined,
          };
          this.drawingDragActive = false;
          this.requestOverlayDraw();
          return;
        }

        // 두 번째 탭: B 확정
        if (this.drawingDraft && !this.drawingDragActive) {
          this.drawingDraft.b = anchor;
          this.drawingDragActive = true;
          this.requestOverlayDraw();
          return;
        }

        return;
      }

      // 이미 십자선 모드라면 다음 터치에서 즉시 해제
      if (this.isCrosshairMode) {
        this.exitCrosshairMode();
        this.isTouchPanning = false;
        this.isTouchPinching = false;
        return;
      }

      // ── 메인 Y축 터치 드래그 ────────────────────────────────────────
      if (!this.drawingTool && this.isOnMainYAxis(pos.x, pos.y)) {
        this.yAxisDragging = true;
        this.yAxisDragStartY = e.touches[0].clientY;
        this.yAxisDragStartFactor = this.yScaleFactor;
        return;
      }

      // ── 보조지표 Y축 터치 드래그 ───────────────────────────────────
      if (!this.drawingTool) {
        const subAxisPanel = this.getSubYAxisPanel(pos.x, pos.y);
        if (subAxisPanel) {
          this.subYAxisDragging = subAxisPanel;
          this.subYAxisDragStartY = e.touches[0].clientY;
          this.subYAxisDragStartFactor = this.subPanelScaleFactors[subAxisPanel] ?? 1.0;
          return;
        }
      }

      // ── 롱프레스: 십자선 모드 진입 ─────────────────────────────────
      this.cancelLongPress();
      this.longPressTimer = setTimeout(() => {
        this.isCrosshairMode = true;
        this.touchCrosshairX = pos.x;
        this.touchCrosshairY = pos.y;
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        this.isMouseOver = true;
        if (navigator.vibrate) navigator.vibrate(30);
        this.requestOverlayDraw();
        // 활성 직후 터치-업은 무시 (롱프레스 손 뗌과 구분)
        this.crosshairJustActivated = true;
        setTimeout(() => { this.crosshairJustActivated = false; }, 600);
        // 5초 후 자동 숨김
        this.crosshair_reset_auto_hide();
      }, SimpleChart.LONG_PRESS_MS);

      // ── 패닝 준비 ─────────────────────────────────────────────────────
      this.isTouchPanning = true;
      this.touchStartIndex = this.startIndex;
      this.touchStartLeftPanBars = this.leftPanBars;
      this.touchStartPriceOffset = this.mainPricePanOffset;

    } else if (e.touches.length === 2) {
      // 핀치 시작
      this.cancelLongPress();
      this.exitCrosshairMode();
      this.isTouchPinching = true;
      this.isTouchPanning = false;
      this.touchPinchDist = this.getTouchDist(e.touches);
      this.touchPinchStartVisible = Math.max(1, this.endIndex - this.startIndex);
      // 두 손가락 중점 기준 앵커: 현재 뷰포트에서 중점이 가리키는 캔들 인덱스를 기록
      const t0 = this.touchPos(e.touches[0]);
      const t1 = this.touchPos(e.touches[1]);
      const midX = (t0.x + t1.x) / 2;
      const geo = this.getChartGeometry(this.viewportWidth, this.lastDrawMeta?.axisPad);
      const chartW = Math.max(1, geo.chartWidth);
      const ratio = Math.max(0, Math.min(1, (midX - geo.chartLeft) / chartW));
      this.touchPinchAnchorRatio = ratio;
      this.touchPinchAnchorIndex = this.startIndex + ratio * (this.endIndex - this.startIndex);
    }
  }


  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();

    if (this.isTouchPinching && e.touches.length === 2) {
      // ── 핀치 줌 ──────────────────────────────────────────────────────
      const newDist = this.getTouchDist(e.touches);
      if (this.touchPinchDist === 0) return;
      const scale       = this.touchPinchDist / newDist;
      const nextVisible = Math.round(this.touchPinchStartVisible * scale);
      const clamped     = Math.max(5, Math.min(this.data.length, nextVisible));
      // 두 손가락 중점 앵커를 기준으로 뷰포트 확대/축소 (위치 유지)
      let newStart = Math.round(this.touchPinchAnchorIndex - this.touchPinchAnchorRatio * clamped);
      let newEnd   = newStart + clamped;
      if (newStart < 0) { newStart = 0; newEnd = clamped; }
      if (newEnd > this.data.length) { newEnd = this.data.length; newStart = Math.max(0, newEnd - clamped); }
      this.startIndex = newStart;
      this.endIndex   = newEnd;
      this.draw();
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const pos = this.touchPos(touch);

      // ── 메인 Y축 터치 드래그 ─────────────────────────────────────────
      if (this.yAxisDragging) {
        this.yScaleFactor = resolveMainYAxisDragScale(touch.clientY, this.yAxisDragStartY, this.yAxisDragStartFactor);
        this.draw();
        return;
      }

      // ── 보조지표 Y축 터치 드래그 ─────────────────────────────────────
      if (this.subYAxisDragging) {
        this.subPanelScaleFactors[this.subYAxisDragging] = resolveSubYAxisDragScale(
          touch.clientY,
          this.subYAxisDragStartY,
          this.subYAxisDragStartFactor,
        );
        this.draw();
        return;
      }

      // ????????????????????????????????????????????????????????????????????
      // ? 기존 드로잉 드래그: 터치로 앵커 이동
      // ????????????????????????????????????????????????????????????????????
      if (this.drawingMoveState && this.selectedDrawingId) {
        const moveResult = applyDrawingMove({
          pointerX: pos.x,
          pointerY: pos.y,
          moveState: this.drawingMoveState,
          selectedPart: this.selectedDrawingPart,
          currentMoveDistance: this.drawingMoveDistance,
          moveShapeByDelta: (baseShape, dx, dy, part) => this.moveShapeByDelta(baseShape, dx, dy, part),
        });
        this.drawingMoveDistance = moveResult.moveDistance;
        if (Math.hypot(moveResult.dx, moveResult.dy) > SimpleChart.LONG_PRESS_MOVE_THRESHOLD) {
          this.cancelLongPress();
        }
        this.upsertDrawing(moveResult.movedShape);
        if (moveResult.movedShape.kind === 'text-note') {
          const anchorPoint = this.getDrawingAnchorScreenPoint(moveResult.movedShape);
          if (anchorPoint) {
            this.touchDrawingCrosshairX = anchorPoint.x;
            this.touchDrawingCrosshairY = anchorPoint.y;
            this.mouseX = anchorPoint.x;
            this.mouseY = anchorPoint.y;
            this.isMouseOver = true;
          }
        }
        this.requestOverlayDraw();
        return;
      }

      // ????????????????????????????????????????????????????????????????????
      // ? 터치 드로잉 모드: 십자선 위치 업데이트 및 앵커 B 드래그 미리보기
      // ????????????????????????????????????????????????????????????????????
      if (this.drawingTool) {
        // 자석 스냅: 종가/시가/고가/저가에 약한 흡착
        const snapped = this.crosshair_snap_to_candle(pos.x, pos.y);
        this.touchDrawingCrosshairX = snapped.x;
        this.touchDrawingCrosshairY = snapped.y;
        this.mouseX = snapped.x;
        this.mouseY = snapped.y;
        this.isMouseOver = true;
        if (this.drawingTool === 'text-note') {
          this.requestOverlayDraw();
          return;
        }

        // fib-trend / position: 드래그 = 십자선 이동 + 미리보기
        if (this.drawingTool === 'long-position' || this.drawingTool === 'short-position'
            || this.drawingTool === 'fib-trend') {
          if (this.drawingDraft) {
            const anchor = this.getMouseAnchor(pos.x, pos.y);
            if (anchor) {
              const stage = (this.drawingDraft as any).stage ?? 0;
              if (this.drawingTool === 'fib-trend') {
                if (stage === 1) this.drawingDraft.b = anchor;
                if (stage === 2) {
                  this.drawingDraft.channelOffset = {
                    index: anchor.index - this.drawingDraft.a.index,
                    price: anchor.price - this.drawingDraft.a.price,
                  };
                }
              }
            }
          }
          this.requestOverlayDraw();
          return;
        }

        // 일반 드로잉: 드래그 중 B 포인트 실시간 업데이트
        if (this.drawingDraft) {
          const anchor = this.getMouseAnchor(pos.x, pos.y);
          if (anchor) {
            if (isPatternDrawingKind(this.drawingDraft.kind)) {
              this.updatePatternDraftPreview(anchor);
              this.requestOverlayDraw();
              return;
            }
            if (!this.drawingDragActive) {
              const dx2 = pos.x - this.touchStartX;
              const dy2 = pos.y - this.touchStartY;
              if (Math.sqrt(dx2 * dx2 + dy2 * dy2) > 4) this.drawingDragActive = true;
            }
            const shouldPromoteChannelStage = (
              this.drawingDraft.kind === 'channel' && !this.drawingDraft.b
            ) || (
              this.drawingDraft.b
              && (
                this.drawingDraft.b.index === this.drawingDraft.a.index
                || this.drawingDraft.b.price === this.drawingDraft.a.price
              )
            );
            if (shouldPromoteChannelStage) {
              this.drawingDraft.b = anchor;
              this.fibTrendPointStage = 2;
            } else {
              updateDrawingDraftAnchor(this.drawingDraft, anchor);
            }
          }
        }
        this.requestOverlayDraw();
        return;
      }

      // ── 십자선 모드: 손가락 따라 십자선 이동 ─────────────────────────
      if (this.isCrosshairMode) {
        const mdx = pos.x - this.touchStartX;
        const mdy = pos.y - this.touchStartY;
        if (Math.sqrt(mdx * mdx + mdy * mdy) > 2) {
          this.touchCrosshairX = pos.x;
          this.touchCrosshairY = pos.y;
          this.mouseX      = pos.x;
          this.mouseY      = pos.y;
          this.isMouseOver = true;
          this.requestOverlayDraw();
          // 이동 시 자동 숨김 타이머 재시작
          this.crosshair_reset_auto_hide();
        }
        return;
      }

      // ── 롱프레스 판별: 임계값 이상 이동하면 타이머 취소 ─────────────
      if (this.longPressTimer !== null) {
        const dx = pos.x - this.touchStartX;
        const dy = pos.y - this.touchStartY;
        if (Math.sqrt(dx * dx + dy * dy) > SimpleChart.LONG_PRESS_MOVE_THRESHOLD) {
          this.cancelLongPress();
        }
      }

      // ── 패닝 ──────────────────────────────────────────────────────────
      if (this.isTouchPanning) {
        const visibleCount = Math.max(1, this.endIndex - this.startIndex);
        const chartW = this.getChartGeometry(this.viewportWidth, this.lastDrawMeta?.axisPad).chartWidth;
        let changed = false;
        const virtualStart = resolveHorizontalPanVirtualStart({
          pointerX: pos.x,
          dragStartX: this.touchStartX,
          dragStartIndex: this.touchStartIndex,
          dragStartLeftPanBars: this.touchStartLeftPanBars,
          chartWidth: chartW,
          visibleCount,
          rightGapBars: this.config.layout.rightGapBars ?? 0,
          normalizeHorizontalVirtualStart: (nextVirtualStart, baseVirtualStart) => (
            this.normalizeHorizontalVirtualStart(nextVirtualStart, baseVirtualStart)
          ),
        });
        if (virtualStart != null) {
          if (this.applyHorizontalPan(virtualStart, visibleCount)) changed = true;
        }
        if (this.isVerticalPanEnabled()) {
          const nextPriceOffset = resolveVerticalPanOffset({
            pointerY: pos.y,
            dragStartY: this.touchStartY,
            dragStartPriceOffset: this.touchStartPriceOffset,
            currentPriceOffset: this.mainPricePanOffset,
            pricePerPixel: this.getMainPricePerPixel(),
          });
          if (nextPriceOffset != null) {
            this.mainPricePanOffset = nextPriceOffset;
            changed = true;
          }
        }
        if (changed) {
          this.draw();
        }
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.cancelLongPress();

    if (this.xAxisDragging) {
      this.xAxisDragging = false;
      return;
    }

    if (this.yAxisDragging) {
      this.yAxisDragging = false;
      return;
    }

    if (this.subYAxisDragging) {
      this.subYAxisDragging = null;
      return;
    }

    // ????????????????????????????????????????????????????????????????????????????
    // ? 기존 드로잉 편집: 드래그 완료 (선택은 유지하여 toolbar 표시)
    // ????????????????????????????????????????????????????????????????????????????
    if (this.drawingMoveState && e.changedTouches.length > 0 && e.touches.length === 0) {
      // 드래그 상태만 종료, 선택은 유지
      const moveEnd = resolveDrawingMoveEnd({
        moveState: this.drawingMoveState,
        moveDistance: this.drawingMoveDistance,
        textNoteTapThreshold: SimpleChart.TEXT_NOTE_TOUCH_TAP_MOVE_THRESHOLD,
        pendingChannelId: this.pendingChannelId,
        selectedDrawingId: this.selectedDrawingId,
        selectedPart: this.selectedDrawingPart,
      });
      this.drawingMoveState = null;
      this.drawingMoveDistance = 0;
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      this.updateChartCursor();
      if (moveEnd.baseShape.kind === 'text-note' && moveEnd.wasClickOnly) {
        const current = this.drawings.find((shape) => shape.id === moveEnd.baseShape.id && shape.kind === 'text-note');
        if (current) this.openTextNoteEditor(current);
      }
      return;
    }

    // ????????????????????????????????????????????????????????????????????????????
    // ? 터치 드로잉 모드: 손가락 뗄 때 드로잉 완료 또는 취소
    // ????????????????????????????????????????????????????????????????????????????
    if (this.drawingTool && e.changedTouches.length > 0 && e.touches.length === 0) {
      const rect  = this.canvas.getBoundingClientRect();
      const tx    = e.changedTouches[0].clientX - rect.left;
      const ty    = e.changedTouches[0].clientY - rect.top;

      if (this.drawingTool === 'text-note') {
        const anchor = this.getMouseAnchor(this.touchDrawingCrosshairX || tx, this.touchDrawingCrosshairY || ty);
        if (!anchor) { this.requestOverlayDraw(); return; }
        const created = this.createTextNoteAt(anchor);
        this.isCrosshairMode = false;
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        this.openTextNoteEditor(created);
        return;
      }

      // ── Position 드로잉: 손 뗄 때 십자선 최종 위치로 박스 생성 ──────────
      if (this.drawingTool === 'long-position' || this.drawingTool === 'short-position') {
        // 십자선이 이동되었으면 십자선 위치 우선, 아니면 touchEnd 위치
        const useX = this.touchDrawingCrosshairX || tx;
        const useY = this.touchDrawingCrosshairY || ty;
        const defaults = this.position_calc_defaults(useX, useY, true);
        if (!defaults) { this.requestOverlayDraw(); return; }
        const { anchor: snappedAnchor, defaultRisk, defaultBars } = defaults;
        const isLong      = this.drawingTool === 'long-position';
        const created = createPositionDrawing({
          kind: this.drawingTool,
          anchor: snappedAnchor,
          defaultRisk,
          defaultBars,
        });
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'position-target';
        this.syncDrawingToolbar();
        this.drawingDraft = null;
        this.isCrosshairMode = false;
        this.setDrawingTool(null);
        const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        if (!isCoarsePointer) this.showPositionGuide(1, isLong ? 'long-position' : 'short-position');
        this.requestOverlayDraw();
        return;
      }

      if (this.drawingTool === 'anchored-vwap') {
        const useX = this.touchDrawingCrosshairX || tx;
        const useY = this.touchDrawingCrosshairY || ty;
        const anchor = this.getMouseAnchor(useX, useY);
        if (!anchor) { this.requestOverlayDraw(); return; }
        const created = this.createAnchoredVwapDrawing(anchor);
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'start';
        this.syncDrawingToolbar();
        this.drawingDraft = null;
        this.isCrosshairMode = false;
        this.setDrawingTool(null);
        this.requestOverlayDraw();
        return;
      }
      if (isPatternDrawingKind(this.drawingTool)) {
        const useX = this.touchDrawingCrosshairX || tx;
        const useY = this.touchDrawingCrosshairY || ty;
        const anchor = this.getMouseAnchor(useX, useY);
        if (!anchor) { this.requestOverlayDraw(); return; }
        this.appendPatternPoint(this.drawingTool, anchor);
        this.isCrosshairMode = false;
        return;
      }
      if (this.drawingTool === 'vertical-line' || this.drawingTool === 'cross-line') {
        const useX = this.touchDrawingCrosshairX || tx;
        const useY = this.touchDrawingCrosshairY || ty;
        const anchor = this.getMouseAnchor(useX, useY);
        if (!anchor) { this.requestOverlayDraw(); return; }
        const created = createSingleAnchorLineDrawing({
          kind: this.drawingTool,
          anchor,
          fallbackIndex: this.startIndex,
          fallbackPrice: anchor.price,
          color: '#2f6cff',
          width: HLINE_DEFAULT_WIDTH,
        });
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'line';
        this.syncDrawingToolbar();
        this.drawingDraft = null;
        this.isCrosshairMode = false;
        this.setDrawingTool(null);
        this.refreshDrawingSelectionVisual(created);
        return;
      }

      // ── fib-trend: 손 뗄 때마다 단계별 앵커 확정 ────────────────────────
      if (this.drawingTool === 'fib-trend') {
        const useX = this.touchDrawingCrosshairX || tx;
        const useY = this.touchDrawingCrosshairY || ty;
        const anchor = this.getMouseAnchor(useX, useY);
        if (!anchor) { this.requestOverlayDraw(); return; }

        if (!this.drawingDraft) {
          // 1번째 손 뗌 → 1번째 앵커 확정
          this.drawingDraft = {
            kind: 'fib-trend', a: anchor, b: anchor,
            channelOffset: { index: 0, price: 0 },
          } as any;
          (this.drawingDraft as any).stage = 1;
          this.requestOverlayDraw();
          return;
        }

        const stage = (this.drawingDraft as any).stage ?? 1;
        if (stage === 1) {
          // 2번째 손 뗌 → 2번째 앵커 확정
          this.drawingDraft.b = anchor;
          (this.drawingDraft as any).stage = 2;
          this.requestOverlayDraw();
          return;
        }
        if (stage === 2) {
          // 3번째 손 뗌 → 완료
          const moved = Math.abs(this.drawingDraft.a.index - (this.drawingDraft.b?.index ?? this.drawingDraft.a.index)) > 0.2
            || Math.abs(this.drawingDraft.a.price - (this.drawingDraft.b?.price ?? this.drawingDraft.a.price)) > 1e-6;
          if (moved) {
            const created = createFibTrendDrawing({
              a: this.drawingDraft.a,
              b: this.drawingDraft.b!,
              offsetAnchor: anchor,
            });
            this.upsertDrawing(created);
            this.selectedDrawingId = created.id;
            this.selectedDrawingPart = 'fib-offset';
            this.syncDrawingToolbar();
          }
          this.drawingDraft = null;
          this.isCrosshairMode = false;
          this.setDrawingTool(null);
          this.requestOverlayDraw();
          return;
        }
        return;
      }

      // ── 일반 드로잉: 드래그 완료 → 완료 / 탭만 → A 확정 후 대기 ───────
      if (this.drawingDraft && this.drawingDragActive) {
        this.completeDrawing();
        this.drawingTool = null;
        this.requestOverlayDraw();
        return;
      }
      if (this.drawingDraft && !this.drawingDragActive) {
        this.requestOverlayDraw();
        return;
      }
      // 드래프트 없음 → 취소
      this.drawingTool = null;
      this.drawingDraft = null;
      this.drawingDragActive = false;
      this.requestOverlayDraw();
      return;
    }

    if (e.touches.length === 0) {
      if (this.isCrosshairMode) {
        // 롱프레스 직후 손 뗌은 무시 (활성과 동시 touchEnd 방지)
        if (this.crosshairJustActivated) {
          this.isTouchPanning  = false;
          this.isTouchPinching = false;
          return;
        }
        if (e.changedTouches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const tx = e.changedTouches[0].clientX - rect.left;
          const ty = e.changedTouches[0].clientY - rect.top;
          // + 버튼 히트 체크 → hline 생성 (십자선 유지)
          if (this.crosshairPlusHit) {
            const { x: hx, r: hr, price } = this.crosshairPlusHit;
            if (Math.abs(tx - hx) <= hr + 6) {
              this.drawings = upsertDrawingShape(this.drawings, createHlineDrawing({
                anchor: this.getMouseAnchor(tx, ty),
                fallbackIndex: this.startIndex,
                price,
                width: HLINE_DEFAULT_WIDTH,
              }));
              this.selectedDrawingId = null;
              this.selectedDrawingPart = 'line';
              this.drawingMoveState = null;
              this.syncDrawingToolbar();
              // 십자선 유지, 타이머 재시작
              this.crosshair_reset_auto_hide();
              this.requestOverlayDraw();
              this.isTouchPanning  = false;
              this.isTouchPinching = false;
              return;
            }
          }
        }
        this.isTouchPanning  = false;
        this.isTouchPinching = false;
        return;
      }
      this.isTouchPanning  = false;
      this.isTouchPinching = false;

    } else if (e.touches.length === 1) {
      // 핀치 → 한 손가락 남음: 패닝 모드로 전환
      this.isTouchPinching = false;
      const pos = this.touchPos(e.touches[0]);
      if (!this.isCrosshairMode && !this.drawingTool) {
        this.isTouchPanning  = true;
        this.touchStartX     = pos.x;
        this.touchStartY     = pos.y;
        this.touchStartIndex = this.startIndex;
        this.touchStartLeftPanBars = this.leftPanBars;
        this.touchStartPriceOffset = this.mainPricePanOffset;
      }
    }
  }

  // ── 드로잉 히트 판정: 터치 위치가 드로잉 앵커포인트 근처인지 확인 ────────────
  private checkDrawingHit(x: number, y: number, draft: DrawingDraft): boolean {
    const hitRadius = 20; // 터치 범위 (px)
    const metrics = this.getMainViewportMetrics();
    
    if (!metrics) return false;

    // A 포인트: 캔버스 좌표 계산
    const aX = this.xForIndex(draft.a.index, metrics.totalSp, metrics.candleW);
    const aY = metrics.getY(draft.a.price);
    const aDist = Math.sqrt((aX - x) ** 2 + (aY - y) ** 2);
    if (aDist <= hitRadius) return true;
    
    // B 포인트
    if (draft.b) {
      const bX = this.xForIndex(draft.b.index, metrics.totalSp, metrics.candleW);
      const bY = metrics.getY(draft.b.price);
      const bDist = Math.sqrt((bX - x) ** 2 + (bY - y) ** 2);
      if (bDist <= hitRadius) return true;
    }
    
    return false;
  }

}

