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
import { BollingerBands, RSI, SMA } from 'technicalindicators';
import {
  TIMEFRAME_SECONDS,
  type TimeframeKey,
} from '../catalog/time';
import {
  loadStrategies,
  saveStrategies,
  type StrategyDefinition,
  type StrategySignal,
} from '../strategy/strategy-service';
import {
  DEFAULT_CONFIG as DOUBLE_BREAK_DEFAULT_CONFIG,
  DoubleBreakStrategy,
  type DoubleBreakConfig,
  type DoubleBreakResult,
} from '../strategy/double-break-strategy';
import type {
  DrawingAnchor,
  DrawingDraft,
  DrawingHitPart,
  DrawingShape,
  DrawingToolId,
} from '../ui/workspace/drawing-types';
import {
  cloneDrawingShape,
  getChannelGeometry as getChannelGeometryUtil,
  pointToSegmentDistance as pointToSegmentDistanceUtil,
} from '../ui/workspace/drawing-utils';
import { getContrastTextColor, toRgba } from './color-utils';
import {
  buildZeroLagTrendStates,
  drawZeroLagAreaUnderCandles,
} from './indicator-render-engine';
import { renderIndicatorBlocks } from './indicator-block-renderer';
import {
  formatAxisTime,
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
  detectPatternCandidates,
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
type ActiveDrawingToolId = DrawingToolId | 'eraser';
type DrawingMagnetMode = 'off' | 'soft' | 'strong';

export const X_AXIS_HEIGHT = 22;
const MAX_CANVAS_PIXEL_RATIO = 3;
const CHART_FONT_STACK = `'Segoe UI Variable Text','Segoe UI','Noto Sans KR','Apple SD Gothic Neo',sans-serif`;
const CHART_TEXT_PRIMARY = '#e3e8f2';
const CHART_TEXT_SECONDARY = '#c2ccdf';
const CHART_TEXT_MUTED = '#b3bfd4';
const HLINE_DEFAULT_WIDTH = 1.2;
const LOCK_ICON_CLOSED_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 1 1 8 0v3"></path></svg>';
const LOCK_ICON_OPEN_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M16 11V8a4 4 0 1 0-8 0"></path></svg>';
const ERASER_CURSOR = 'url("/eraser-cursor.svg") 4 20, pointer';

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
export const MOBILE_JUMP_LATEST_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 17 11 12 6 7"/><polyline points="13 17 18 12 13 7"/></svg>`;

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

type StrategyReportArgs = {
  feeBps: number;
  slippageBps: number;
  periodBars: number;
  rangeStartSec: number | null;
  rangeEndSec: number | null;
  sideFilter: 'all' | 'long' | 'short';
};

type StrategyReportTrade = {
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  pnl: number;
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
  trades: StrategyReportTrade[];
};

// -----------------------------------------------------------------------------
// SimpleChart 클래스

export class SimpleChart {
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
  private strategies: StrategyDefinition[] = loadStrategies();
  private activeStrategyId: string | null = null;
  private strategySignals: StrategySignal[] = [];
  private strategySignalVisible = true;
  private doubleBreakConfig: DoubleBreakConfig = { ...DOUBLE_BREAK_DEFAULT_CONFIG };
  private bollingerRiskConfig: BollingerRiskConfig = { ...BOLLINGER_RISK_DEFAULT_CONFIG };
  private signalHitAreas: Array<{
    x: number;
    y: number;
    r: number;
    signal: StrategySignal;
    entryPrice: number;
    candleIndex: number;
  }> = [];
  private strategyWorker: Worker | null = null;
  private signalAnimationFrame = 0;
  private strategyRequestId = 0;
  private pendingStrategyRequestId = 0;
  private dmiScaleRange: { lo: number; hi: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeScheduled = false;
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
  private drawingToolbarEl: HTMLDivElement | null = null;
  private drawingToolbarBoundId: string | null = null;
  private drawingAlertPopupEl: HTMLDivElement | null = null;
  private positionSettingsPopupEl: HTMLDivElement | null = null;
  private trendlineTextEditorEl: HTMLInputElement | null = null;
  private trendlineTextEditorShapeId: string | null = null;
  private hoveredDrawingId: string | null = null;
  private hoveredDrawingPart: DrawingHitPart | null = null;
  private copiedDrawingTemplate: DrawingShape | null = null;
  private pendingChannelId: string | null = null;
  private fibTrendPointStage: 0 | 1 | 2 = 0;
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
  private leftPanBars = 0;
  private dragStartLeftPanBars = 0;
  private touchStartLeftPanBars = 0;
  private mouseX = 0;
  private mouseY = 0;
  private isMouseOver = false;
  private focusedSignalCandleIndex: number | null = null;
  private focusedTradeRange: { startIndex: number; endIndex: number } | null = null;
  private focusVisualTimer: ReturnType<typeof setTimeout> | null = null;
  private focusVisualStartedAt = 0;
  private gotoDateMarker: { candleIndex: number; label: string } | null = null;

  // 십자선 가격박스 옆 + 아이콘 히트 영역
  private crosshairPlusHit: { x: number; y: number; r: number; price: number } | null = null;
  private crosshairPlusHovered = false;

  public onCrosshairOHLC: ((ohlc: { open: number; high: number; low: number; close: number; time: number } | null) => void) | null = null;
  private _lastCrosshairOHLCIdx = -2;
  // 기본 십자선 자동 숨김 타이머 (5초)
  private static readonly CROSSHAIR_AUTO_HIDE_MS = 5000;
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
  private isTouchPanning  = false;
  private isTouchPinching = false;

  // ── 롱프레스 십자선 상태 ──────────────────────
  private static readonly LONG_PRESS_MS = 400;
  private static readonly LONG_PRESS_MOVE_THRESHOLD = 8;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isCrosshairMode = false;
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
        show: true,
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
      bb:       { show: true,  period: 20, stdDev: 2 },
      rsi:      { show: false, period: 14 },
      macd:     { show: false, fast: 12, slow: 26, signal: 9 },
      dmi:      { show: false, period: 14, axisMode: 'auto' as 'auto' | 'fixed', topThreshold: 30, bottomThreshold: 20 },
      stochF:   { show: false, kPeriod: 5,  dPeriod: 3 },
      stochS:   { show: false, kPeriod: 14, dPeriod: 3 },
      cci:      { show: false, period: 20 },
      obv:      { show: false },
      vwap:     { show: false },
      volumeProfile: { show: false, rows: 24, widthPct: 22, upOpacity: 45, downOpacity: 45, pocOpacity: 95 },
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
      leftPanEnabled: false,
      verticalPanEnabled: false,
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
    const axisPad = Math.max(24, dynamicPad ?? this.config.layout.rightPadding);
    const chartLeft = 0;
    // Main panel right edge: in left-mode use full width, in right-mode keep right axis area.
    const chartRight = side === 'left' ? width : Math.max(0, width - axisPad);
    const chartWidth = Math.max(1, chartRight - chartLeft);
    const axisLeft = side === 'left' ? 0 : chartRight;
    const axisRight = side === 'left' ? axisPad : width;
    const axisCenter = (axisLeft + axisRight) / 2;
    return { side, axisPad, chartLeft, chartRight, chartWidth, axisLeft, axisRight, axisCenter };
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

  public shiftPanelOrder(panelId: string, direction: -1 | 1) {
    movePanel(this.config.panelState, panelId as any, direction);
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
    if (panelId === 'obv') {
      const s = this.resolveStyle('obv', '#22ab94');
      const obv = lastFinite(this.calcOBV().map((v) => v as number | null));
      return {
        title: 'OBV',
        settings: [],
        values: [{ text: fmt(obv, 0), color: s.color }],
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
      'hline',
      'channel',
      'fib-retracement',
      'fib-trend',
      'long-position',
      'short-position',
      'measure',
      'text-note',
      'eraser',
    ];
    if (!tool || !allowed.includes(tool as ActiveDrawingToolId)) {
      this.drawingTool = null;
      window.dispatchEvent(new CustomEvent('chart-drawing-tool-changed', {
        detail: { toolId: this.drawingTool },
      }));
      this.drawingDraft = null;
      this.drawingDragActive = false;
      this.pendingChannelId = null;
      this.fibTrendPointStage = 0;
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
    // 드로잉 시작 시 기본 십자선 즉시 해제
    if (this.isCrosshairMode) this.exitCrosshairMode();
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
      'hline':           ['탭한 위치에 수평선이 그려집니다'],
      'channel':         ['① 첫 번째 선의 시작점 탭', '② 끝점 탭', '③ 두 번째 선 위치 탭'],
      'fib-retracement': ['① 시작점을 탭하세요', '② 끝점을 탭해 피보나치를 완성하세요'],
      'fib-trend':       ['① 첫 번째 기준점 탭', '② 두 번째 기준점 탭', '③ 세 번째 기준점 탭'],
      'measure':         ['① 측정 시작점 탭', '② 끝점 탭으로 가격·시간 범위 측정'],
      'text-note':       ['메모를 추가할 위치를 탭하세요'],
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

  public getDrawingsSnapshot(): DrawingShape[] {
    return this.drawings.map((shape) => this.cloneShape(shape));
  }

  public setDrawingsSnapshot(drawings: DrawingShape[]): void {
    this.drawings = drawings.map((shape) => this.cloneShape(shape));
    this.selectedDrawingId = null;
    this.selectedDrawingPart = 'line';
    this.drawingMoveState = null;
    this.drawingDraft = null;
    this.drawingDragActive = false;
    this.pendingChannelId = null;
    this.fibTrendPointStage = 0;
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
    const before = this.drawings.length;
    if (before === 0) return 0;
    if (includeLocked) {
      this.drawings = [];
    } else {
      this.drawings = this.drawings.filter((shape) => shape.locked);
    }
    const removed = before - this.drawings.length;
    if (removed <= 0) return 0;
    if (this.selectedDrawingId && !this.drawings.some((shape) => shape.id === this.selectedDrawingId)) {
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

  private getDefaultChannelOffset(a: DrawingAnchor, b: DrawingAnchor): DrawingAnchor {
    const fallbackMax = Math.max(a.price, b.price);
    const fallbackMin = Math.min(a.price, b.price);
    const visibleRange = (this.lastDrawMeta?.maxP ?? fallbackMax) - (this.lastDrawMeta?.minP ?? fallbackMin);
    const gap = Math.max(0.5, Math.abs(visibleRange) * 0.01);
    const direction = b.price >= a.price ? 1 : -1;
    return { index: 0, price: gap * direction };
  }

  public deleteSelectedDrawing(): void {
    if (!this.selectedDrawingId) return;
    this.drawings = this.drawings.filter((shape) => shape.id !== this.selectedDrawingId);
    this.selectedDrawingId = null;
    this.selectedDrawingPart = 'line';
    this.drawingMoveState = null;
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    this.emitDrawingsChanged();
  }

  public copySelectedDrawing(): boolean {
    const selected = this.getSelectedDrawing();
    if (!selected || selected.kind !== 'trendline') return false;
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
    this.drawings.push(pasted);
    this.selectedDrawingId = pasted.id;
    this.selectedDrawingPart = 'line';
    this.syncDrawingToolbar();
    this.requestOverlayDraw();
    return true;
  }

  private clearDrawingSelection(): void {
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
    this.requestOverlayDraw();
  }

  private getSelectedDrawing(): DrawingShape | null {
    if (!this.selectedDrawingId) return null;
    return this.drawings.find((shape) => shape.id === this.selectedDrawingId) ?? null;
  }

  private upsertDrawing(next: DrawingShape): void {
    const idx = this.drawings.findIndex((shape) => shape.id === next.id);
    if (idx >= 0) this.drawings[idx] = next;
    else this.drawings.push(next);
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

  private showPatternPopup(signal: PatternSignal): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    showPatternPopupUi(host, signal);
  }

  private clearPatternPopups(): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    clearPatternPopupsUi(host);
  }

  private clearConfirmedPatternBoxes(): void {
    this.confirmedPatternBoxes = [];
  }

  private parsePatternRangeFromSignal(signal: PatternSignal): { startIndex: number; endIndex: number } | null {
    const matches = [...signal.key.matchAll(/-(\d+)/g)];
    if (!matches.length) return null;
    const nums = matches
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    const startIndex = Math.min(...nums);
    const endIndex = Math.max(...nums);
    return { startIndex, endIndex };
  }

  private registerConfirmedPatternBox(signal: PatternSignal): void {
    if (signal.level !== 'confirmed') return;
    const range = this.parsePatternRangeFromSignal(signal);
    if (!range) return;
    const id = `${this.config.symbol}:${this.config.timeframe}:${signal.type}:${range.startIndex}:${range.endIndex}`;
    const exists = this.confirmedPatternBoxes.some((box) => box.id === id);
    if (exists) return;
    this.confirmedPatternBoxes.push({
      id,
      type: signal.type,
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      createdAt: Date.now(),
    });
    if (this.confirmedPatternBoxes.length > 60) {
      this.confirmedPatternBoxes.splice(0, this.confirmedPatternBoxes.length - 60);
    }
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
      'double-bottom': '쌍바닥 확정',
      'double-top': '쌍봉 확정',
      'head-and-shoulders': 'H&S 확정',
      'inverse-head-and-shoulders': '역H&S 확정',
      'bullish-engulfing': '상승장악형',
      'bearish-engulfing': '하락장악형',
      'bearish-harami': '하락잉태형',
      'bullish-harami': '상승잉태형',
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
      ctx.fillText(labelMap[box.type], left + 4, labelY);
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
      if (shape.kind !== 'trendline' || !shape.b || !shape.alert?.enabled || shape.hidden) continue;
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

  public isStrategySignalVisible(): boolean {
    return this.strategySignalVisible;
  }

  public setStrategySignalVisible(visible: boolean): void {
    this.strategySignalVisible = visible;
    this.drawSignalLayer(this.lastDrawMeta);
  }

  public getDoubleBreakConfig(): DoubleBreakConfig {
    return { ...this.doubleBreakConfig };
  }

  public setDoubleBreakConfig(patch: Partial<DoubleBreakConfig>): void {
    this.doubleBreakConfig = { ...this.doubleBreakConfig, ...patch };
    const indicators = this.config.indicators as any;
    if (indicators.bb) {
      indicators.bb.period = this.doubleBreakConfig.bbPeriod;
      indicators.bb.stdDev = this.doubleBreakConfig.bbStd;
    }
    if (indicators.envelope) {
      indicators.envelope.period = this.doubleBreakConfig.envPeriod;
      indicators.envelope.pct = this.doubleBreakConfig.envPct;
      indicators.envelope.show = true;
    }
    this.requestStrategyCompute(0);
    this.draw();
  }

  public getBollingerRiskConfig(): BollingerRiskConfig {
    return { ...this.bollingerRiskConfig };
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
    this.drawings = this.drawings.filter((shape) => shape.id !== id);
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
    if (strategyId === 'strategy_js_double_break') {
      this.setDoubleBreakConfig({});
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
          const ctx = { open, high, low, close, volume, __doubleBreakConfig: payload.doubleBreakConfig };
          const previous = payload.previousSignals ?? [];
          const signals = previous.length === candles.length ? [...previous] : new Array(candles.length).fill(0);
          const from = Math.max(0, Math.min(payload.changedFrom - 300, candles.length - 1));
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
      this.drawSignalLayer(this.lastDrawMeta);
    });
  }

  private startSignalAnimationLoop(): void {
    const tick = (timeMs: number) => {
      this.drawSignalLayer(this.lastDrawMeta, timeMs);
      this.signalAnimationFrame = window.requestAnimationFrame(tick);
    };
    if (!this.signalAnimationFrame) {
      this.signalAnimationFrame = window.requestAnimationFrame(tick);
    }
  }

  private requestStrategyCompute(changedFrom: number): void {
    if (!this.strategyWorker) return;
    const strategy = this.getActiveStrategy();
    if (!strategy || !this.data.length) {
      this.strategySignals = [];
      this.signalHitAreas = [];
      this.drawSignalLayer(this.lastDrawMeta);
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
      doubleBreakConfig: this.doubleBreakConfig,
    });
  }

  private getDoubleBreakResult(): DoubleBreakResult | null {
    if (this.activeStrategyId !== 'strategy_js_double_break' || !this.data.length) return null;
    try {
      return new DoubleBreakStrategy(this.doubleBreakConfig).run(this.data);
    } catch {
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
          entry,
          exit,
          pnl: net,
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
      trades: sortedTrades.slice(-350),
    };
  }

  public buildStrategyReport(args: StrategyReportArgs): StrategyReportResult | null {
    if (this.activeStrategyId === 'strategy_pine_bbands_directed' && this.bollingerRiskConfig.enabled) {
      return this.buildBollingerRiskManagedReport(args);
    }

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

    const signals = [
      ...doubleBreak.longSignals.map((signal) => ({ ...signal, side: 'LONG' as const })),
      ...doubleBreak.shortSignals.map((signal) => ({ ...signal, side: 'SHORT' as const })),
    ]
      .filter((signal) => signal.index >= start && signal.index < end)
      .filter((signal) => args.sideFilter === 'all' || args.sideFilter === signal.side.toLowerCase())
      .sort((a, b) => a.index - b.index);

    const feeRate = (args.feeBps + args.slippageBps) / 10000;
    const trades: StrategyReportTrade[] = [];

    for (const signal of signals) {
      const entry = signal.price;
      let tp1Hit = false;
      let exit = this.data[end - 1]?.close ?? entry;
      let exitIndex = Math.max(signal.index, end - 1);
      let pnl = 0;
      const from = Math.min(signal.index + 1, end - 1);

      for (let i = from; i < end; i += 1) {
        const candle = this.data[i];
        if (!candle) continue;

        if (signal.side === 'LONG') {
          const slHit = candle.low <= signal.sl;
          const tp1Now = candle.high >= signal.tp1;
          const tp2Now = candle.high >= signal.tp2;
          if (slHit && !tp1Hit) {
            exit = signal.sl;
            exitIndex = i;
            pnl = exit - entry;
            break;
          }
          if (tp1Now) tp1Hit = true;
          if (tp2Now) {
            exit = signal.tp2;
            exitIndex = i;
            pnl = (signal.tp1 - entry) * 0.3 + (signal.tp2 - entry) * 0.7;
            break;
          }
          if (slHit && tp1Hit) {
            exit = signal.sl;
            exitIndex = i;
            pnl = (signal.tp1 - entry) * 0.3 + (signal.sl - entry) * 0.7;
            break;
          }
        } else {
          const slHit = candle.high >= signal.sl;
          const tp1Now = candle.low <= signal.tp1;
          const tp2Now = candle.low <= signal.tp2;
          if (slHit && !tp1Hit) {
            exit = signal.sl;
            exitIndex = i;
            pnl = entry - exit;
            break;
          }
          if (tp1Now) tp1Hit = true;
          if (tp2Now) {
            exit = signal.tp2;
            exitIndex = i;
            pnl = (entry - signal.tp1) * 0.3 + (entry - signal.tp2) * 0.7;
            break;
          }
          if (slHit && tp1Hit) {
            exit = signal.sl;
            exitIndex = i;
            pnl = (entry - signal.tp1) * 0.3 + (entry - signal.sl) * 0.7;
            break;
          }
        }
      }

      if (pnl === 0) {
        pnl = signal.side === 'LONG' ? exit - entry : entry - exit;
      }
      pnl -= (entry + exit) * feeRate;

      trades.push({
        side: signal.side,
        entry,
        exit,
        pnl,
        entryIndex: signal.index,
        exitIndex,
        entryTime: Number.isFinite(Number(this.data[signal.index]?.time)) ? Number(this.data[signal.index].time) : null,
        exitTime: Number.isFinite(Number(this.data[exitIndex]?.time)) ? Number(this.data[exitIndex].time) : null,
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
    mainH: number;
    minP: number;
    maxP: number;
    leftGap: number;
    getY: (p: number) => number;
  } = null;

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
    const baseRadius = Math.max(8, Math.min(12, meta.candleW * 0.8));
    const doubleBreakResult = this.getDoubleBreakResult();
    const doubleBreakDetails = new Map<number, {
      side: 'LONG' | 'SHORT';
      tp1: number;
      tp2: number;
      sl: number;
    }>();
    if (doubleBreakResult) {
      doubleBreakResult.longSignals.forEach((signal) => {
        doubleBreakDetails.set(signal.index, {
          side: 'LONG',
          tp1: signal.tp1,
          tp2: signal.tp2,
          sl: signal.sl,
        });
      });
      doubleBreakResult.shortSignals.forEach((signal) => {
        doubleBreakDetails.set(signal.index, {
          side: 'SHORT',
          tp1: signal.tp1,
          tp2: signal.tp2,
          sl: signal.sl,
        });
      });
    }

    const drawExitLine = (
      x1: number,
      price: number,
      label: string,
      color: string,
      dash: number[],
      alpha = 0.92,
    ) => {
      if (price < meta.minP || price > meta.maxP) return;
      const y = meta.getY(price);
      if (y < 0 || y > meta.mainH) return;
      const x2 = Math.max(x1 + meta.totalSp * 2, meta.chartRight - 6);
      ctx.save();
      ctx.strokeStyle = toRgba(color, alpha, color);
      ctx.lineWidth = 1.1;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x1, Math.round(y) + 0.5);
      ctx.lineTo(x2, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 10px ${CHART_FONT_STACK}`;
      ctx.textAlign = meta.axisSide === 'left' ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = toRgba(color, 0.14, 'rgba(255,255,255,0.12)');
      const textW = ctx.measureText(label).width + 8;
      const boxX = meta.axisSide === 'left'
        ? 3
        : (meta.chartRight - textW - 3);
      ctx.fillRect(boxX, y - 8, textW, 16);
      ctx.fillStyle = color;
      const textX = meta.axisSide === 'left' ? 7 : (meta.chartRight - 7);
      ctx.fillText(label, textX, y);
      ctx.restore();
    };

    let latestSignalIndex = -1;
    for (let i = this.strategySignals.length - 1; i >= 0; i -= 1) {
      if ((this.strategySignals[i] ?? 0) !== 0) {
        latestSignalIndex = i;
        break;
      }
    }

    for (let i = 0; i < visible.length; i += 1) {
      const gi = this.startIndex + i;
      const signal = this.strategySignals[gi] ?? 0;
      if (!signal) continue;
      const candle = visible[i];
      const x = meta.chartLeft + (i + meta.leftGap) * meta.totalSp + meta.candleW / 2;
      const y = signal > 0 ? meta.getY(candle.low) + 12 : meta.getY(candle.high) - 12;
      const entryPrice = candle.close;
      const isLatest = gi === latestSignalIndex;
      const detail = doubleBreakDetails.get(gi);
      if (detail) {
        const fromX = x + meta.candleW * 0.55;
        drawExitLine(fromX, detail.tp1, 'TP1', detail.side === 'LONG' ? '#37d67a' : '#ff6b6b', [4, 3], isLatest ? 1 : 0.68);
        drawExitLine(fromX, detail.tp2, 'TP2', detail.side === 'LONG' ? '#21b86b' : '#ff5252', [8, 4], isLatest ? 1 : 0.64);
        drawExitLine(fromX, detail.sl, 'SL', detail.side === 'LONG' ? '#ff6b6b' : '#37d67a', [2, 3], isLatest ? 1 : 0.72);
      }
      const phase = (Math.sin(timeMs * 0.008) + 1) / 2;
      const pulseScale = isLatest ? (0.9 + phase * 0.6) : 1;
      const pulseAlpha = isLatest ? (0.45 + phase * 0.55) : 1;
      const radius = baseRadius * pulseScale;

      ctx.beginPath();
      ctx.fillStyle = signal > 0
        ? `rgba(46,204,113,${pulseAlpha})`
        : `rgba(255,82,82,${pulseAlpha})`;
      ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      if (isLatest) {
        ctx.beginPath();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = signal > 0
          ? `rgba(46,204,113,${Math.min(1, pulseAlpha + 0.2)})`
          : `rgba(255,82,82,${Math.min(1, pulseAlpha + 0.2)})`;
        ctx.arc(x, y, radius * 0.66, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillText(signal > 0 ? '▲' : '▼', x, y + 0.3);

      this.signalHitAreas.push({
        x,
        y,
        r: radius * 0.6,
        signal,
        entryPrice,
        candleIndex: gi,
      });
    }

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
    this.ensureDrawingToolbar();
    [this.ctx, this.signalCtx, this.overlayCtx].forEach((ctx) => {
      ctx.imageSmoothingEnabled = false;
    });

    this.initStrategyWorker();
    this.startSignalAnimationLoop();
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
    this.canvas.addEventListener('dblclick',  this.handleDoubleClick.bind(this));
    this.canvas.addEventListener('mouseleave', () => {
      this.isMouseOver = false;
      this.hoveredDrawingId = null;
      this.hoveredDrawingPart = null;
      this.canvas.style.cursor = 'default';
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

    this.data = data;
    this.displayDataCache = null;
    this.displayDataCacheKey = '';
    this.lastPatternEvalSignature = '';
    this.lastPatternAlertByKey.clear();
    this.clearPatternPopups();
    this.clearConfirmedPatternBoxes();

    if (!prevData.length) {
      this.endIndex = data.length;
      this.startIndex = Math.max(0, data.length - 80);
    } else if (prevWasNearLatest) {
      this.endIndex = data.length;
      this.startIndex = Math.max(0, this.endIndex - prevVisible);
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
    this.requestStrategyCompute(0);
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

  private focusSignalVisual(candleIndex: number, options?: { showCrosshair?: boolean }): void {
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
      this.focusedSignalCandleIndex = null;
      this.focusedTradeRange = null;
      this.focusVisualStartedAt = 0;
      this.focusVisualTimer = null;
      this.requestOverlayDraw();
    }, 6000);
  }

  public focusRangeByIndex(
    startIndex: number,
    endIndex: number,
    paddingBars = 8,
    options?: { showCrosshair?: boolean },
  ): void {
    if (!this.data.length) return;

    const lastIndex = this.data.length - 1;
    const normalizedStart = Number.isFinite(startIndex) ? Math.floor(startIndex) : 0;
    const normalizedEnd = Number.isFinite(endIndex) ? Math.floor(endIndex) : normalizedStart;
    const pad = Math.max(0, Math.floor(paddingBars));

    let lo = Math.max(0, Math.min(lastIndex, Math.min(normalizedStart, normalizedEnd)));
    let hi = Math.max(0, Math.min(lastIndex, Math.max(normalizedStart, normalizedEnd)));
    lo = Math.max(0, lo - pad);
    hi = Math.min(lastIndex, hi + pad);

    const minVisible = 12;
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
    this.focusedTradeRange = {
      startIndex: Math.max(0, Math.min(lastIndex, Math.min(normalizedStart, normalizedEnd))),
      endIndex: Math.max(0, Math.min(lastIndex, Math.max(normalizedStart, normalizedEnd))),
    };
    this.draw();
    this.focusSignalVisual(this.focusedTradeRange.startIndex, options);
  }

  /** 최신(가장 오른쪽) 캔들로 뷰포트 이동 */
  public jumpToLatest(): void {
    if (!this.data.length) return;
    const visibleCount = Math.max(10, this.endIndex - this.startIndex);
    this.endIndex   = this.data.length;
    this.startIndex = Math.max(0, this.endIndex - visibleCount);
    this.leftPanBars = 0;
    this.draw();
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
    this.draw();
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
    this.draw();
  }

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

  private clampPanStartIndex(startIndex: number, visibleCount: number): number {
    if (visibleCount <= 0) return 0;
    const dataLength = this.data.length;
    const leftPanEnabled = Boolean((this.config.layout as any).leftPanEnabled);
    const maxStart = leftPanEnabled
      ? Math.max(0, dataLength - 1 + Math.floor(visibleCount / 2))
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
    this.requestStrategyCompute(Math.max(0, i - 1));
    this.draw();
  }

  public addNewCandle(c: CandleData) {
    this.data.push(c);
    this.displayDataCache = null;
    this.displayDataCacheKey = '';
    this.endIndex++; this.startIndex++;
    this.requestStrategyCompute(Math.max(0, this.data.length - 3));
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
    this.viewportWidth = p.clientWidth;
    this.viewportHeight = p.clientHeight;
    this.pixelRatio = Math.max(1, Math.min(MAX_CANVAS_PIXEL_RATIO, window.devicePixelRatio || 1));

    const backingWidth = Math.floor(this.viewportWidth * this.pixelRatio);
    const backingHeight = Math.floor(this.viewportHeight * this.pixelRatio);

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
    const source = this.getIndicatorSourceData();
    const closes = source.map((d) => d.close);
    const values = SMA.calculate({ period, values: closes });
    const out: (number | null)[] = new Array(source.length).fill(null);
    for (let i = period - 1; i < source.length; i += 1) {
      out[i] = values[i - (period - 1)] ?? null;
    }
    return out;
  }

  private calcEMA(period: number): (number | null)[] {
    const source = this.getIndicatorSourceData();
    const closes = source.map((d) => d.close);
    return this.calcEmaSeries(closes, period);
  }

  private calcRSI(period: number): (number | null)[] {
    const source = this.getIndicatorSourceData();
    const closes = source.map((d) => d.close);
    const values = RSI.calculate({ period, values: closes });
    const out: (number | null)[] = new Array(source.length).fill(null);
    for (let i = period; i < source.length; i += 1) {
      out[i] = values[i - period] ?? null;
    }
    return out;
  }

  private calcBB(period: number, mult: number) {
    const source = this.getIndicatorSourceData();
    const closes = source.map((d) => d.close);
    const values = BollingerBands.calculate({ period, stdDev: mult, values: closes });
    const middle: (number | null)[] = new Array(source.length).fill(null);
    const upper: (number | null)[] = new Array(source.length).fill(null);
    const lower: (number | null)[] = new Array(source.length).fill(null);
    for (let i = period - 1; i < source.length; i += 1) {
      const item = values[i - (period - 1)];
      if (!item) continue;
      middle[i] = item.middle;
      upper[i] = item.upper;
      lower[i] = item.lower;
    }
    return { middle, upper, lower };
  }

  private calcDMI(period: number) {
    const source = this.getIndicatorSourceData();
    const pDI: (number | null)[] = [], mDI: (number | null)[] = [], adxArr: (number | null)[] = [];
    let sTR = 0, sPDM = 0, sMDM = 0, adxSum = 0, adxCnt = 0, prevADX: number | null = null;
    for (let i = 0; i < source.length; i++) {
      if (i === 0) { pDI.push(null); mDI.push(null); adxArr.push(null); continue; }
      const h = source[i].high, l = source[i].low;
      const ph = source[i-1].high, pl = source[i-1].low, pc = source[i-1].close;
      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      const up = h - ph, dn = pl - l;
      const pdm = up > dn && up > 0 ? up : 0;
      const mdm = dn > up && dn > 0 ? dn : 0;
      if (i < period) {
        sTR += tr; sPDM += pdm; sMDM += mdm;
        pDI.push(null); mDI.push(null); adxArr.push(null);
      } else if (i === period) {
        sTR += tr; sPDM += pdm; sMDM += mdm;
        const p = sTR > 0 ? sPDM / sTR * 100 : 0, m = sTR > 0 ? sMDM / sTR * 100 : 0;
        pDI.push(p); mDI.push(m);
        adxSum += (p + m) > 0 ? Math.abs(p - m) / (p + m) * 100 : 0;
        adxCnt++; adxArr.push(null);
      } else {
        sTR = sTR - sTR / period + tr;
        sPDM = sPDM - sPDM / period + pdm;
        sMDM = sMDM - sMDM / period + mdm;
        const p = sTR > 0 ? sPDM / sTR * 100 : 0, m = sTR > 0 ? sMDM / sTR * 100 : 0;
        pDI.push(p); mDI.push(m);
        const dx = (p + m) > 0 ? Math.abs(p - m) / (p + m) * 100 : 0;
        if (adxCnt < period) {
          adxSum += dx; adxCnt++;
          if (adxCnt === period) { prevADX = adxSum / period; adxArr.push(prevADX); }
          else adxArr.push(null);
        } else {
          prevADX = (prevADX! * (period - 1) + dx) / period;
          adxArr.push(prevADX);
        }
      }
    }
    return { plusDI: pDI, minusDI: mDI, adx: adxArr };
  }

  private calcMACD(fast: number, slow: number, sig: number) {
    const ema = (arr: number[], p: number): (number | null)[] => {
      if (arr.length < p) return new Array(arr.length).fill(null);
      const k = 2 / (p + 1);
      const out: (number | null)[] = new Array(p - 1).fill(null);
      let e = arr.slice(0, p).reduce((a, b) => a + b) / p;
      out.push(e);
      for (let i = p; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); out.push(e); }
      return out;
    };
    const source = this.getIndicatorSourceData();
    const closes = source.map((d) => d.close);
    const fe = ema(closes, fast), se = ema(closes, slow);
    const macdLine: (number | null)[] = fe.map((f, i) => f != null && se[i] != null ? f - se[i]! : null);
    const valid = macdLine.filter(v => v != null) as number[];
    const sigLine: (number | null)[] = [];
    let cnt = 0;
    for (const v of macdLine) {
      if (v == null) { sigLine.push(null); continue; }
      cnt++;
      sigLine.push(cnt >= sig ? (ema(valid, sig)[cnt - 1] ?? null) : null);
    }
    const hist: (number | null)[] = macdLine.map((m, i) =>
      m != null && sigLine[i] != null ? m - sigLine[i]! : null);
    return { macdLine, sigLine, hist };
  }

  private sma(src: (number | null)[], p: number): (number | null)[] {
    return src.map((_, i) => {
      const sl = src.slice(Math.max(0, i - p + 1), i + 1).filter(v => v != null) as number[];
      return sl.length === p ? sl.reduce((a, b) => a + b) / p : null;
    });
  }

  private calcStoch(kp: number, dp: number) {
    const source = this.getIndicatorSourceData();
    const kRaw: (number | null)[] = source.map((d, i) => {
      if (i < kp - 1) return null;
      const sl = source.slice(i - kp + 1, i + 1);
      const hi = Math.max(...sl.map(x => x.high)), lo = Math.min(...sl.map(x => x.low));
      return hi === lo ? 50 : (d.close - lo) / (hi - lo) * 100;
    });
    return { k: this.sma(kRaw, 3), d: this.sma(this.sma(kRaw, 3), dp) };
  }

  private calcCCI(period: number): (number | null)[] {
    const source = this.getIndicatorSourceData();
    return source.map((d, i) => {
      if (i < period - 1) return null;
      const tp = (d.high + d.low + d.close) / 3;
      const sl = source.slice(i - period + 1, i + 1).map((x) => (x.high + x.low + x.close) / 3);
      const mean = sl.reduce((a, b) => a + b) / period;
      const md   = sl.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
      return md === 0 ? 0 : (tp - mean) / (0.015 * md);
    });
  }

  private calcOBV(): number[] {
    const source = this.getIndicatorSourceData();
    const obv = [0];
    for (let i = 1; i < source.length; i++) {
      const p = obv[i - 1];
      obv.push(source[i].close > source[i-1].close ? p + source[i].volume
              : source[i].close < source[i-1].close ? p - source[i].volume : p);
    }
    return obv;
  }

  private calcVWAP(): (number | null)[] {
    const source = this.getIndicatorSourceData();
    let cpv = 0, cv = 0;
    return source.map((d) => {
      cpv += (d.high + d.low + d.close) / 3 * d.volume;
      cv  += d.volume;
      return cv === 0 ? null : cpv / cv;
    });
  }

  private calcIchimoku(tenkan: number, kijun: number, senkou: number) {
    const source = this.getIndicatorSourceData();
    const mid = (i: number, p: number) => {
      if (i < p - 1) return null;
      const sl = source.slice(i - p + 1, i + 1);
      return (Math.max(...sl.map(d => d.high)) + Math.min(...sl.map(d => d.low))) / 2;
    };
    const tLine = source.map((_, i) => mid(i, tenkan));
    const kLine = source.map((_, i) => mid(i, kijun));
    const sA    = tLine.map((t, i) => t != null && kLine[i] != null ? (t + kLine[i]!) / 2 : null);
    const sB    = source.map((_, i) => mid(i, senkou));
    return { tenkanLine: tLine, kijunLine: kLine, senkouA: sA, senkouB: sB };
  }

  private calcEnvelope(period: number, pct: number) {
    const mid = this.calcMA(period);
    return {
      mid,
      upper: mid.map(v => v != null ? v * (1 + pct / 100) : null),
      lower: mid.map(v => v != null ? v * (1 - pct / 100) : null),
    };
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
      this.requestOverlayDraw();
      return;
    }

    const plotHeight = Math.max(40, height - X_AXIS_HEIGHT);

    // 가격 텍스트 폭을 측정해 축 너비를 동적 계산
    let dynamicAxisPad = this.config.layout.rightPadding;
    {
      const quickVis = displayData.slice(this.startIndex, this.endIndex);
      let quickMax = -Infinity;
      quickVis.forEach(d => { quickMax = Math.max(quickMax, d.high); });
      if (isFinite(quickMax)) {
        ctx.font = `600 13px ${CHART_FONT_STACK}`;
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
    const subAxisStart = width - geometry.axisPad;
    const subChartRight = subAxisStart;
    const subChartW = Math.max(1, subChartRight - chartLeft);

    // Opaque market-axis strip (left in left-mode, right in right-mode).
    ctx.save();
    ctx.fillStyle = '#0f172a';
    if (geometry.side === 'left') {
      ctx.fillRect(0, 0, geometry.axisPad, mainH);
      ctx.strokeStyle = '#2a3142';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(geometry.axisPad + 0.5, 0);
      ctx.lineTo(geometry.axisPad + 0.5, mainH);
      ctx.stroke();
    } else {
      ctx.fillRect(chartRight, 0, geometry.axisPad, plotHeight);
      ctx.strokeStyle = '#2a3142';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartRight - 0.5, 0);
      ctx.lineTo(chartRight - 0.5, plotHeight);
      ctx.stroke();
    }
    ctx.restore();

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

    const gapBars = Math.min(Math.max(0, this.config.layout.rightGapBars ?? 0), 50 / Math.max(1, chartW / Math.max(1, visibleSlots)));
    const leftGap = Math.max(0, this.leftPanBars);
    const totalSp = chartW / (visibleSlots + gapBars + leftGap);
    const effectiveChartLeft = chartLeft + leftGap * totalSp;
    const candleW = Math.max(totalSp * 0.8, 1);
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
    const obvD   = indicatorLayerOn && ind.obv.show    ? this.calcOBV()                  : [];
    const obvSignal9 = indicatorLayerOn && ind.obv.show ? this.sma(obvD.map(v => v as number | null), 9) : [];
    const vwapD  = indicatorLayerOn && ind.vwap.show   ? this.calcVWAP()                 : [];
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
    const ichiD  = indicatorLayerOn && ind.ichimoku.show ? this.calcIchimoku(ind.ichimoku.tenkan, ind.ichimoku.kijun, ind.ichimoku.senkou) : null;
    const envD   = indicatorLayerOn && ind.envelope.show ? this.calcEnvelope(ind.envelope.period, ind.envelope.pct) : null;
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
        vwapD[gi],
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
    const rawRange = Math.max(1e-12, rawMaxP - rawMinP);
    const plotHeightPx = Math.max(1, mainH - R.top);
    const mainAxisStep = getMainAxisStepByRange(rawRange, plotHeightPx, this.config.quoteCurrency);

    minP = Math.floor(rawMinP / mainAxisStep) * mainAxisStep;
    maxP = Math.ceil(rawMaxP / mainAxisStep) * mainAxisStep;
    if (this.mainPricePanOffset !== 0) {
      minP += this.mainPricePanOffset;
      maxP += this.mainPricePanOffset;
    }
    if (maxP <= minP) maxP = minP + mainAxisStep;
    const pRng = maxP - minP || 1;
    const getY = (p: number) => R.top + (maxP - p) / pRng * (mainH - R.top);

    // 메인 패널 라인 그리기 헬퍼
    const line = (data: (number|null)[], color: string, lw = 1.5, dash: number[] = []) => {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
      ctx.beginPath(); let started = false;
      visData.forEach((_, i) => {
        const v = data[this.startIndex + i];
        if (v == null) { started = false; return; }
        const x = effectiveChartLeft + i * totalSp + candleW / 2;
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

    // 1) 메인 가로 격자/가격축
    ctx.save();
    ctx.strokeStyle = '#1e2230'; ctx.fillStyle = CHART_TEXT_SECONDARY;
    ctx.font = `600 13px ${CHART_FONT_STACK}`;
    ctx.textAlign = 'center';
    const axisDigits = Math.max(0, Math.ceil(-Math.log10(mainAxisStep)) + 2);
    const tickCount = Math.max(1, Math.floor((maxP - minP) / mainAxisStep) + 1);
    const axisBottomPadding = 14;
    for (let i = 0; i < tickCount; i += 1) {
      const p = maxP - i * mainAxisStep;
      if (p < minP - mainAxisStep * 0.5) break;
      const y = getY(p);
      if (y >= mainH - axisBottomPadding) continue;
      ctx.beginPath(); ctx.moveTo(chartLeft, y); ctx.lineTo(chartRight, y); ctx.stroke();
      const axisTextX = geometry.side === 'left'
        ? (geometry.axisPad * 0.5)
        : (chartRight + (geometry.axisPad * 0.5));
      ctx.fillText(formatWithComma(Number(p.toFixed(axisDigits)), symbolPriceDigits), axisTextX, y + 4);
    }
    ctx.restore();

    // 1-2) 세로 격자: 차트 영역에만 클리핑하여 시세영역 침범 방지
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartLeft, 0, chartW, plotHeight);
    ctx.clip();
    ctx.strokeStyle = '#1e2230';
    tickIndices.forEach((i) => {
      const x = effectiveChartLeft + i * totalSp + candleW / 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotHeight);
      ctx.stroke();
    });
    ctx.restore();

    // 메인 패널(가격 영역) 밖으로 캔들/메인지표가 침범하지 않도록 클리핑.
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartLeft, 0, chartW, mainH);
    ctx.clip();

    // 2) 일목구름
    if (ichiD && ind.ichimoku.show) {
      ctx.save();
      visData.forEach((_, i) => {
        const gi = this.startIndex + i;
        const a = ichiD.senkouA[gi], b = ichiD.senkouB[gi];
        if (a == null || b == null) return;
        ctx.fillStyle = a >= b ? 'rgba(34,171,148,0.1)' : 'rgba(242,54,69,0.1)';
        ctx.fillRect(effectiveChartLeft + i * totalSp, Math.min(getY(a), getY(b)), totalSp, Math.abs(getY(a) - getY(b)));
      });
      ctx.restore();
      const tenkanStyle = this.resolveStyle('ichimokuTenkan', '#f23645', 1);
      const kijunStyle = this.resolveStyle('ichimokuKijun', '#2962ff', 1);
      const senkouAStyle = this.resolveStyle('ichimokuSenkouA', 'rgba(34,171,148,0.6)', 1, [4, 4]);
      const senkouBStyle = this.resolveStyle('ichimokuSenkouB', 'rgba(242,54,69,0.6)', 1, [4, 4]);
      if (showLine('ichimokuTenkan')) line(ichiD.tenkanLine, tenkanStyle.color, tenkanStyle.width, tenkanStyle.dash);
      if (showLine('ichimokuKijun')) line(ichiD.kijunLine, kijunStyle.color, kijunStyle.width, kijunStyle.dash);
      if (showLine('ichimokuSenkouA')) line(ichiD.senkouA, senkouAStyle.color, senkouAStyle.width, senkouAStyle.dash);
      if (showLine('ichimokuSenkouB')) line(ichiD.senkouB, senkouBStyle.color, senkouBStyle.width, senkouBStyle.dash);
    }

    // 3) 볼린저 밴드 배경
    bbSeries.forEach((bbLine, index) => {
      const upKey = `${bbLine.id}Upper`;
      const loKey = `${bbLine.id}Lower`;
      if (!showLine(upKey) || !showLine(loKey)) return;
      ctx.save();
      ctx.fillStyle = index === 0 ? 'rgba(100,100,255,0.05)' : 'rgba(255,255,255,0.025)';
      ctx.beginPath(); let first = true;
      visData.forEach((_, i) => {
        const v = bbLine.data.upper[this.startIndex + i];
        if (v == null) return;
        if (first) { ctx.moveTo(effectiveChartLeft + i * totalSp + candleW/2, getY(v)); first = false; }
        else ctx.lineTo(effectiveChartLeft + i * totalSp + candleW/2, getY(v));
      });
      for (let i = visData.length - 1; i >= 0; i--) {
        const v = bbLine.data.lower[this.startIndex + i];
        if (v == null) continue;
        ctx.lineTo(effectiveChartLeft + i * totalSp + candleW/2, getY(v));
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    });

    // 4) 엔벨로프 배경
    if (envD && ind.envelope.show) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,200,50,0.05)';
      ctx.beginPath(); let first = true;
      visData.forEach((_, i) => {
        const v = envD.upper[this.startIndex + i];
        if (v == null) return;
        if (first) { ctx.moveTo(effectiveChartLeft + i * totalSp + candleW/2, getY(v)); first = false; }
        else ctx.lineTo(effectiveChartLeft + i * totalSp + candleW/2, getY(v));
      });
      for (let i = visData.length - 1; i >= 0; i--) {
        const v = envD.lower[this.startIndex + i];
        if (v == null) continue;
        ctx.lineTo(effectiveChartLeft + i * totalSp + candleW/2, getY(v));
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // 4-2) 메인지표 매물대(Visible Range Volume Profile)
    if (indicatorLayerOn && volumeProfileEnabled && volumeProfileRows > 0) {
      const bucketSpan = (maxP - minP) / volumeProfileRows;
      if (bucketSpan > 0) {
        const profile = Array.from({ length: volumeProfileRows }, () => ({
          up: 0,
          down: 0,
          total: 0,
        }));
        visData.forEach((c) => {
          const candleLow = Math.max(minP, Math.min(c.low, c.high));
          const candleHigh = Math.min(maxP, Math.max(c.low, c.high));
          const candleVol = Number(c.volume);
          if (!Number.isFinite(candleVol) || candleVol <= 0 || candleHigh < candleLow) return;

          const startBin = Math.max(0, Math.min(volumeProfileRows - 1, Math.floor((candleLow - minP) / bucketSpan)));
          const endBin = Math.max(0, Math.min(volumeProfileRows - 1, Math.floor((candleHigh - minP) / bucketSpan)));
          const from = Math.min(startBin, endBin);
          const to = Math.max(startBin, endBin);
          const touched = Math.max(1, to - from + 1);
          const allocated = candleVol / touched;
          const isUp = c.close >= c.open;

          for (let bi = from; bi <= to; bi += 1) {
            const bucket = profile[bi];
            if (isUp) bucket.up += allocated;
            else bucket.down += allocated;
            bucket.total += allocated;
          }
        });

        const maxBucketVolume = Math.max(...profile.map((bucket) => bucket.total), 0);
        if (maxBucketVolume > 0) {
          const profileMaxWidth = chartW * volumeProfileWidthRatio;
          const upStyle = this.resolveStyle('volumeProfileUp', 'rgba(38,166,154,0.45)', 1);
          const downStyle = this.resolveStyle('volumeProfileDown', 'rgba(239,83,80,0.45)', 1);
          const pocStyle = this.resolveStyle('volumeProfilePoc', 'rgba(255,193,7,0.95)', 1.2, [4, 3]);
          const upFillColor = toRgba(upStyle.color, volumeProfileUpOpacity);
          const downFillColor = toRgba(downStyle.color, volumeProfileDownOpacity);
          const pocStrokeColor = toRgba(pocStyle.color, volumeProfilePocOpacity);
          const showUp = showLine('volumeProfileUp');
          const showDown = showLine('volumeProfileDown');

          let pocIndex = 0;
          let pocValue = -1;
          profile.forEach((bucket, index) => {
            if (bucket.total > pocValue) {
              pocValue = bucket.total;
              pocIndex = index;
            }
          });

          ctx.save();
          ctx.beginPath();
          ctx.rect(chartLeft, R.top, chartW, Math.max(1, mainH - R.top));
          ctx.clip();

          for (let bi = 0; bi < volumeProfileRows; bi += 1) {
            const bucket = profile[bi];
            if (bucket.total <= 0) continue;

            const low = minP + bi * bucketSpan;
            const high = low + bucketSpan;
            const yTop = getY(high);
            const yBottom = getY(low);
            const y = Math.min(yTop, yBottom);
            const h = Math.max(1, Math.abs(yBottom - yTop) - 1);

            const totalWidth = (bucket.total / maxBucketVolume) * profileMaxWidth;
            if (totalWidth <= 0) continue;
            const downWidth = totalWidth * (bucket.down / bucket.total);
            const upWidth = Math.max(0, totalWidth - downWidth);
            let xCursor = chartRight - totalWidth;

            if (showDown && downWidth > 0.5) {
              ctx.fillStyle = downFillColor;
              ctx.fillRect(xCursor, y, downWidth, h);
            }
            xCursor += downWidth;
            if (showUp && upWidth > 0.5) {
              ctx.fillStyle = upFillColor;
              ctx.fillRect(xCursor, y, upWidth, h);
            }
          }

          if (showLine('volumeProfilePoc')) {
            const pocLow = minP + pocIndex * bucketSpan;
            const pocHigh = pocLow + bucketSpan;
            const pocY = (getY(pocLow) + getY(pocHigh)) * 0.5;
            ctx.strokeStyle = pocStrokeColor;
            ctx.lineWidth = pocStyle.width;
            ctx.setLineDash(pocStyle.dash);
            ctx.beginPath();
            ctx.moveTo(chartRight - profileMaxWidth, pocY);
            ctx.lineTo(chartRight, pocY);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.restore();
        }
      }
    }

    // 4-3) VPVR (Volume Profile Visible Range)
    if (indicatorLayerOn && ind.vpvr.show) {
      const vp = ind.vpvr;
      const vpRowLayout = (vp.rowsLayout === 'ticks_per_row' ? 'ticks_per_row' : 'number_of_rows') as 'number_of_rows' | 'ticks_per_row';
      const vpRowSize = Math.max(1, Math.floor(Number(vp.rowSize ?? 50) || 50));
      const vpVolumeMode = ((vp.volumeMode === 'total' || vp.volumeMode === 'delta') ? vp.volumeMode : 'up_down') as 'total' | 'up_down' | 'delta';
      const vpValueAreaVolume = Math.max(1, Math.min(100, Number(vp.valueAreaVolume ?? 70) || 70));
      const vpPlacement = vp.placement === 'left' ? 'left' : 'right';
      const vpWidthRatio = Math.max(0.05, Math.min(0.45, (Number(vp.widthPct ?? 22) || 22) / 100));
      const tickSize = Math.max(10 ** -symbolPriceDigits, 1e-12);
      const totalRange = Math.max(1e-12, maxP - minP);
      const vpBucketSpan = vpRowLayout === 'ticks_per_row'
        ? Math.max(tickSize * vpRowSize, tickSize)
        : Math.max(totalRange / Math.max(1, vpRowSize), tickSize);
      const vpRows = Math.max(1, Math.min(450, Math.ceil(totalRange / vpBucketSpan)));
      const vpEffectiveBucketSpan = totalRange / vpRows;

      const vpProfile = Array.from({ length: vpRows }, () => ({ up: 0, down: 0, total: 0, delta: 0 }));
      visData.forEach((c) => {
        const candleLow = Math.max(minP, Math.min(c.low, c.high));
        const candleHigh = Math.min(maxP, Math.max(c.low, c.high));
        const candleVol = Number(c.volume);
        if (!Number.isFinite(candleVol) || candleVol <= 0 || candleHigh < candleLow) return;
        const startBin = Math.max(0, Math.min(vpRows - 1, Math.floor((candleLow - minP) / vpEffectiveBucketSpan)));
        const endBin = Math.max(0, Math.min(vpRows - 1, Math.floor((candleHigh - minP) / vpEffectiveBucketSpan)));
        const from = Math.min(startBin, endBin);
        const to = Math.max(startBin, endBin);
        const touched = Math.max(1, to - from + 1);
        const allocated = candleVol / touched;
        const isUp = c.close >= c.open;
        for (let bi = from; bi <= to; bi += 1) {
          const bucket = vpProfile[bi];
          if (isUp) bucket.up += allocated;
          else bucket.down += allocated;
          bucket.total += allocated;
          bucket.delta = bucket.up - bucket.down;
        }
      });

      const vpMaxTotal = Math.max(...vpProfile.map((bucket) => bucket.total), 0);
      const vpMaxAbsDelta = Math.max(...vpProfile.map((bucket) => Math.abs(bucket.delta)), 0);
      const vpTotalVolume = vpProfile.reduce((sum, bucket) => sum + bucket.total, 0);
      if ((vpVolumeMode !== 'delta' && vpMaxTotal > 0) || (vpVolumeMode === 'delta' && vpMaxAbsDelta > 0)) {
        const vpRegionWidth = chartW * vpWidthRatio;
        const vpRegionStart = vpPlacement === 'left' ? chartLeft : (chartRight - vpRegionWidth);
        const vpRegionEnd = vpPlacement === 'left' ? (chartLeft + vpRegionWidth) : chartRight;
        const vpCenterX = (vpRegionStart + vpRegionEnd) / 2;
        const vpDashByMode = (mode: string): number[] => {
          if (mode === 'dotted') return [2, 3];
          if (mode === 'dashed') return [6, 4];
          return [];
        };
        const vpUpColor = toRgba(String(vp.upColor ?? '#26a69a'), Math.max(0, Math.min(1, (Number(vp.upOpacity ?? 45) || 0) / 100)));
        const vpDownColor = toRgba(String(vp.downColor ?? '#ef5350'), Math.max(0, Math.min(1, (Number(vp.downOpacity ?? 45) || 0) / 100)));
        const vpTotalColor = toRgba(String(vp.totalColor ?? '#7f8aa3'), Math.max(0, Math.min(1, (Number(vp.totalOpacity ?? 40) || 0) / 100)));
        const vpDeltaPosColor = toRgba(String(vp.deltaPosColor ?? '#26a69a'), Math.max(0, Math.min(1, (Number(vp.deltaOpacity ?? 50) || 0) / 100)));
        const vpDeltaNegColor = toRgba(String(vp.deltaNegColor ?? '#ef5350'), Math.max(0, Math.min(1, (Number(vp.deltaOpacity ?? 50) || 0) / 100)));
        let vpPocY: number | null = null;
        let vpVahY: number | null = null;
        let vpValY: number | null = null;

        let pocIndex = 0;
        let pocVolume = -1;
        vpProfile.forEach((bucket, index) => {
          if (bucket.total > pocVolume) {
            pocVolume = bucket.total;
            pocIndex = index;
          }
        });

        let vaLow = pocIndex;
        let vaHigh = pocIndex;
        let vaAccum = vpProfile[pocIndex]?.total ?? 0;
        const vaTarget = vpTotalVolume * (vpValueAreaVolume / 100);
        while (vaAccum < vaTarget && (vaLow > 0 || vaHigh < vpRows - 1)) {
          const nextLowVol = vaLow > 0 ? vpProfile[vaLow - 1].total : -1;
          const nextHighVol = vaHigh < vpRows - 1 ? vpProfile[vaHigh + 1].total : -1;
          if (nextHighVol >= nextLowVol && vaHigh < vpRows - 1) {
            vaHigh += 1;
            vaAccum += Math.max(0, nextHighVol);
          } else if (vaLow > 0) {
            vaLow -= 1;
            vaAccum += Math.max(0, nextLowVol);
          } else {
            break;
          }
        }
        const valPrice = minP + vaLow * vpEffectiveBucketSpan;
        const vahPrice = minP + (vaHigh + 1) * vpEffectiveBucketSpan;
        const pocLow = minP + pocIndex * vpEffectiveBucketSpan;
        const pocHigh = pocLow + vpEffectiveBucketSpan;
        const pocPrice = (pocLow + pocHigh) * 0.5;

        ctx.save();
        ctx.beginPath();
        ctx.rect(chartLeft, R.top, chartW, Math.max(1, mainH - R.top));
        ctx.clip();

        if (vp.showVaBackground !== false) {
          const vaBg = toRgba(String(vp.vaBgColor ?? '#3a5f94'), Math.max(0, Math.min(1, (Number(vp.vaBgOpacity ?? 18) || 0) / 100)));
          const yTop = getY(vahPrice);
          const yBottom = getY(valPrice);
          ctx.fillStyle = vaBg;
          ctx.fillRect(chartLeft, Math.min(yTop, yBottom), chartW, Math.max(1, Math.abs(yBottom - yTop)));
        }

        for (let bi = 0; bi < vpRows; bi += 1) {
          const bucket = vpProfile[bi];
          if (bucket.total <= 0) continue;
          const low = minP + bi * vpEffectiveBucketSpan;
          const high = low + vpEffectiveBucketSpan;
          const yTop = getY(high);
          const yBottom = getY(low);
          const y = Math.min(yTop, yBottom);
          const h = Math.max(1, Math.abs(yBottom - yTop) - 1);

          if (vpVolumeMode === 'total') {
            const w = (bucket.total / vpMaxTotal) * vpRegionWidth;
            if (w <= 0.5) continue;
            const x = vpPlacement === 'left' ? vpRegionStart : (vpRegionEnd - w);
            ctx.fillStyle = vpTotalColor;
            ctx.fillRect(x, y, w, h);
          } else if (vpVolumeMode === 'up_down') {
            const totalWidth = (bucket.total / vpMaxTotal) * vpRegionWidth;
            if (totalWidth <= 0.5) continue;
            const downWidth = totalWidth * (bucket.down / Math.max(bucket.total, 1e-12));
            const upWidth = Math.max(0, totalWidth - downWidth);
            if (vpPlacement === 'left') {
              let xCursor = vpRegionStart;
              if (downWidth > 0.5) {
                ctx.fillStyle = vpDownColor;
                ctx.fillRect(xCursor, y, downWidth, h);
              }
              xCursor += downWidth;
              if (upWidth > 0.5) {
                ctx.fillStyle = vpUpColor;
                ctx.fillRect(xCursor, y, upWidth, h);
              }
            } else {
              let xCursor = vpRegionEnd - totalWidth;
              if (downWidth > 0.5) {
                ctx.fillStyle = vpDownColor;
                ctx.fillRect(xCursor, y, downWidth, h);
              }
              xCursor += downWidth;
              if (upWidth > 0.5) {
                ctx.fillStyle = vpUpColor;
                ctx.fillRect(xCursor, y, upWidth, h);
              }
            }
          } else {
            const d = bucket.delta;
            const w = (Math.abs(d) / vpMaxAbsDelta) * (vpRegionWidth * 0.5);
            if (w <= 0.5) continue;
            if (d >= 0) {
              ctx.fillStyle = vpDeltaPosColor;
              ctx.fillRect(vpCenterX, y, w, h);
            } else {
              ctx.fillStyle = vpDeltaNegColor;
              ctx.fillRect(vpCenterX - w, y, w, h);
            }
          }

          if (vp.valuesVisible === true && h >= 10) {
            const value = vpVolumeMode === 'delta' ? bucket.delta : bucket.total;
            const text = formatThousandAdaptive(value, 0);
            if (text !== '-') {
              ctx.fillStyle = String(vp.valuesTextColor ?? '#cfd8ea');
              ctx.font = `10px ${CHART_FONT_STACK}`;
              ctx.textAlign = vpPlacement === 'left' ? 'left' : 'right';
              const textX = vpPlacement === 'left' ? (vpRegionStart + 2) : (vpRegionEnd - 2);
              ctx.fillText(text, textX, y + Math.max(9, h * 0.75));
            }
          }
        }

        if (vp.showPoc !== false) {
          ctx.strokeStyle = String(vp.pocColor ?? '#ffc107');
          ctx.lineWidth = Math.max(0.5, Number(vp.pocWidth ?? 1.2) || 1.2);
          ctx.setLineDash(vpDashByMode(String(vp.pocLineStyle ?? 'dashed')));
          const y = getY(pocPrice);
          vpPocY = y;
          ctx.beginPath();
          ctx.moveTo(vpRegionStart, y);
          ctx.lineTo(vpRegionEnd, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (vp.showVahVal !== false) {
          ctx.strokeStyle = String(vp.vahValColor ?? '#8ab4ff');
          ctx.lineWidth = Math.max(0.5, Number(vp.vahValWidth ?? 1) || 1);
          ctx.setLineDash(vpDashByMode(String(vp.vahValLineStyle ?? 'dashed')));
          const yVah = getY(vahPrice);
          const yVal = getY(valPrice);
          vpVahY = yVah;
          vpValY = yVal;
          ctx.beginPath();
          ctx.moveTo(vpRegionStart, yVah);
          ctx.lineTo(vpRegionEnd, yVah);
          ctx.moveTo(vpRegionStart, yVal);
          ctx.lineTo(vpRegionEnd, yVal);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.restore();

        const drawLevelTag = (y: number, price: number, suffix: string, bgColor: string, textColor: string) => {
          const label = `${formatWithComma(price, symbolPriceDigits)} ${suffix}`;
          ctx.save();
          ctx.font = `600 10px ${CHART_FONT_STACK}`;
          const padX = 6;
          const h = 16;
          const w = Math.ceil(ctx.measureText(label).width) + padX * 2;
          const clampedY = Math.max(h * 0.5 + 2, Math.min(mainH - h * 0.5 - 2, y));
          const yTop = Math.round(clampedY - h * 0.5);
          const x = vpPlacement === 'right'
            ? Math.max(chartLeft + 2, vpRegionEnd - w - 2)
            : Math.min(chartRight - w - 2, vpRegionStart + 2);
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, yTop, w, h);
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.fillText(label, x + padX, yTop + 11);
          ctx.restore();
        };

        if (vpPocY != null && vp.showPoc !== false) {
          drawLevelTag(vpPocY, pocPrice, 'POC', String(vp.pocColor ?? '#ffc107'), '#111827');
        }
        if (vpVahY != null && vp.showVahVal !== false) {
          drawLevelTag(vpVahY, vahPrice, 'VAH', String(vp.vahValColor ?? '#8ab4ff'), '#0b1220');
        }
        if (vpValY != null && vp.showVahVal !== false) {
          drawLevelTag(vpValY, valPrice, 'VAL', String(vp.vahValColor ?? '#8ab4ff'), '#0b1220');
        }
      }
    }

    // 5) 캔들/거래량
    // ZLMA area fill is rendered before candles so candles stay visually on top.
    drawZeroLagAreaUnderCandles({
      enabled:
        indicatorLayerOn
        && ind.zeroLagMaTrendLevels.show
        && showLine('zeroLagMaTrendLevelsZlma')
        && showLine('zeroLagMaTrendLevelsEma'),
      ctx,
      data: zeroLagMaTrendLevelsD,
      states: zeroLagStates,
      startIndex: this.startIndex,
      visLength: visData.length,
      chartLeft,
      chartRight,
      totalSp,
      candleW,
      getY,
      upColor: String(ind.zeroLagMaTrendLevels.upColor || '#30d453'),
      downColor: String(ind.zeroLagMaTrendLevels.downColor || '#4043f1'),
      fontStack: CHART_FONT_STACK,
      alpha: 0.22,
    });

    const vMax = ind.volume.show ? Math.max(...visRawData.map((d) => d.volume), 1) : 1;
    const volumeTopPaddingRatio = 0.14;
    const vScaleMax = ind.volume.show ? Math.max(1, vMax * (1 + volumeTopPaddingRatio)) : 1;
    const volH   = ind.volume.show && !hiddenPanels.has('volume') ? plotHeight * this.getPanelRatio('volume') : 0;
    const volTop = panelTops['volume'] ?? Math.max(0, mainH - volH);

    visData.forEach((c, i) => {
      const x = effectiveChartLeft + i * totalSp, isUp = c.close >= c.open;
      const upColor = this.config.candleStyle?.upColor ?? '#22ab94';
      const downColor = this.config.candleStyle?.downColor ?? '#f23645';
      const candleColor = isUp ? upColor : downColor;
      ctx.fillStyle = candleColor;
      ctx.strokeStyle = candleColor;
      const wickLineWidth = 1;
      ctx.lineWidth = wickLineWidth;
      const wickX = this.snapStrokeCenter(x + candleW / 2, wickLineWidth);
      const wickLowY = this.snapStrokeCenter(getY(c.low), wickLineWidth);
      const wickHighY = this.snapStrokeCenter(getY(c.high), wickLineWidth);
      ctx.beginPath();
      ctx.moveTo(wickX, wickLowY);
      ctx.lineTo(wickX, wickHighY);
      ctx.stroke();
      const bodyX = this.snapToDevice(x);
      const bodyY = this.snapToDevice(Math.min(getY(c.open), getY(c.close)));
      const bodyW = this.snapSize(Math.max(2, candleW), 2);
      const bodyH = this.snapSize(Math.max(2, Math.abs(getY(c.close) - getY(c.open))), 2);
      ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    });

    renderIndicatorBlocks.call(this, {
      ctx,
      ind,
      indicatorLayerOn,
      maSeries,
      emaSeries,
      maS,
      maL,
      ma60,
      ma120,
      ma200,
      bbSeries,
      vwapD,
      zeroLagMaTrendLevelsD,
      zeroLagStates,
      supertrendD,
      statisticalTrailingStopD,
      envD,
      rsiD,
      dmiD,
      macdD,
      stFD,
      stSD,
      cciD,
      obvD,
      obvSignal9,
      line,
      showLine,
      chartLeft,
      effectiveChartLeft,
      chartRight,
      totalSp,
      candleW,
      getY,
      visData,
      displayData,
      R,
      mainH,
      fontStack: CHART_FONT_STACK,
      vMax,
      vScaleMax,
      volH,
      volTop,
      chartW,
      visRawData,
      panels,
      panelTops,
      plotHeight,
      hiddenPanels,
      subAxisStart,
      geometry,
      width,
      subChartW,
      subChartRight,
      subLine,
      subHorizontalLine,
      getSubPlotBounds,
      formatKUnit,
      formatWithComma,
      chartTextSecondary: CHART_TEXT_SECONDARY,
    });
    if (geometry.side === 'left') {
      // Main price-axis background should remain opaque in left mode.
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, geometry.axisPad, mainH);
      ctx.strokeStyle = '#2a3142';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(geometry.axisPad - 0.5, 0);
      ctx.lineTo(geometry.axisPad - 0.5, mainH);
      ctx.stroke();
      ctx.fillStyle = CHART_TEXT_SECONDARY;
      ctx.font = `600 13px ${CHART_FONT_STACK}`;
      ctx.textAlign = 'right';
      const axisDigits = Math.max(0, Math.ceil(-Math.log10(mainAxisStep)) + 2);
      const tickCount = Math.max(1, Math.floor((maxP - minP) / mainAxisStep) + 1);
      const axisBottomPadding = 14;
      for (let i = 0; i < tickCount; i += 1) {
        const p = maxP - i * mainAxisStep;
        if (p < minP - mainAxisStep * 0.5) break;
        const y = getY(p);
        if (y >= mainH - axisBottomPadding) continue;
        ctx.fillText(formatWithComma(Number(p.toFixed(axisDigits)), symbolPriceDigits), geometry.axisPad - 6, y + 4);
      }
      ctx.restore();
    }

    // 차트(패널) 영역과 시간축 영역 구분선
    ctx.save();
    ctx.strokeStyle = '#3a4150';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, plotHeight + 0.5);
    ctx.lineTo(width, plotHeight + 0.5);
    ctx.stroke();
    ctx.restore();

    // X축 시간 + 세로 격자 (동적 간격)
    ctx.save();
    ctx.fillStyle = CHART_TEXT_MUTED; ctx.font = `12px ${CHART_FONT_STACK}`; ctx.textAlign = 'center';
    let nextRightBoundary = Number.POSITIVE_INFINITY;
    const labelGap = 10;
    for (let ti = tickIndices.length - 1; ti >= 0; ti -= 1) {
      const i = tickIndices[ti];
      if (i >= count) continue; // Future bars have no candle data ? skip time label
        const x = effectiveChartLeft + i * totalSp + candleW / 2;
      const lbl = formatAxisTime(visData[i].time, this.config.timezone, this.config.timeframe, stepCandles);
      const w = ctx.measureText(lbl).width;
      const left = x - w / 2;
      const right = x + w / 2;
      if (right + labelGap <= nextRightBoundary) {
        ctx.fillText(lbl, x, height - 4);
        nextRightBoundary = left;
      }
    }
    ctx.restore();

    this.lastDrawMeta = {
      chartLeft,
      chartRight,
      chartW,
      axisPad: geometry.axisPad,
      axisSide: geometry.side,
      totalSp,
      candleW,
      mainH,
      minP,
      maxP,
      leftGap,
      getY,
    };
    this.drawConfirmedPatternBoxes(this.lastDrawMeta);
    this.evaluateSubIndicatorAlerts({
      volume: this.data.map((d) => d.volume),
      rsi: rsiD,
      dmi: dmiD.adx,
      macd: macdD.macdLine,
      stochF: stFD?.k ?? [],
      stochS: stSD?.k ?? [],
      cci: cciD,
      obv: obvD.map((v) => v as number | null),
    });
    this.evaluateTrendlineAlerts();
    this.evaluatePatternAlerts();
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
      this.drawOverlay();
    });
  }

  private ensureDrawingToolbar() {
    if (this.drawingToolbarEl) return;
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
    [1, 2, 3, 4].forEach((w) => {
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
    widthMenu.style.cssText = [
      'position:absolute',
      'display:none',
      'top:40px',
      'left:0',
      'z-index:2200',
      'min-width:92px',
      'padding:4px',
      'border-radius:8px',
      'background:#f2f4f8',
      'border:1px solid #c8ced8',
      'box-shadow:0 10px 24px rgba(0,0,0,0.28)',
    ].join(';');

    const renderWidthButton = () => {
      const w = Math.max(1, Math.min(4, Number(widthSelect.value || '2')));
      widthBtn.innerHTML = `<svg viewBox="0 0 56 18" width="56" height="18" fill="none"><line x1="3" y1="9" x2="30" y2="9" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"></line><text x="36" y="12" font-size="11" fill="currentColor" font-weight="700">${w}px</text></svg>`;
    };

    [1, 2, 3, 4].forEach((w) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.style.cssText = 'width:100%;height:30px;border:none;background:transparent;border-radius:6px;display:flex;align-items:center;justify-content:flex-start;padding:0 6px;cursor:pointer;color:#1f2533;';
      item.innerHTML = `<svg viewBox="0 0 74 18" width="74" height="18" fill="none"><line x1="3" y1="9" x2="38" y2="9" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"></line><text x="46" y="12" font-size="11" fill="currentColor" font-weight="700">${w}px</text></svg>`;
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

    const lockBtn = mkBtn(LOCK_ICON_CLOSED_SVG, '잠금');
    lockBtn.dataset.k = 'lock';
    const hideBtn = mkBtn('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>', '감추기');
    hideBtn.dataset.k = 'hide';
    const delBtn = mkBtn('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg>', '삭제');
    delBtn.dataset.k = 'delete';

    bar.append(
      colorBtn,
      colorInput,
      widthBtn,
      widthSelect,
      styleBtn,
      styleSelect,
      alertBtn,
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
      selected.color = colorInput.value || '#2f6cff';
      colorBtn.style.color = selected.color;
      selected.width = Number(widthSelect.value || '2');
      selected.lineStyle = (styleSelect.value as DrawingShape['lineStyle']) ?? 'solid';
      this.upsertDrawing(selected);
      this.requestOverlayDraw();
    };
    const syncLockButtonVisual = (locked: boolean) => {
      lockBtn.innerHTML = locked ? LOCK_ICON_OPEN_SVG : LOCK_ICON_CLOSED_SVG;
      lockBtn.title = locked ? '잠금해제' : '잠금';
      lockBtn.style.color = locked ? '#2f6cff' : '#1f2533';
    };

    [colorInput, widthSelect, styleSelect]
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
    const widthSelect = q<HTMLSelectElement>('width');
    const styleSelect = q<HTMLSelectElement>('style');
    const lockBtn = q<HTMLButtonElement>('lock');
    const hideBtn = q<HTMLButtonElement>('hide');
    if (colorInput) colorInput.value = selected.color ?? '#2f6cff';
    if (colorBtn) colorBtn.style.color = selected.color ?? '#2f6cff';
    if (widthSelect) {
      const nextWidth = String(Math.max(1, Math.min(4, Math.round(selected.width ?? 2))));
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
    const range = this.lastDrawMeta.maxP - this.lastDrawMeta.minP || 1;
    const effectiveChartLeft = geometry.chartLeft + leftGap * totalSp;
    return {
      chartLeft: geometry.chartLeft,
      effectiveChartLeft,
      chartRight: geometry.chartRight,
      chartW: geometry.chartWidth,
      axisPad: geometry.axisPad,
      axisSide: geometry.side,
      mainH,
      top,
      totalSp,
      candleW,
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
    // No upper clamp ? allow drawing in the future (right margin) area beyond data.length.
    const index = Math.max(0, rawIndex);
    const price = m.maxP - ((my - m.top) / Math.max(1, m.mainH - m.top)) * m.range;
    return { index, price };
  }

  private xForIndex(index: number, totalSp: number, candleW: number): number {
    const chartLeft = this.lastDrawMeta?.chartLeft ?? 0;
    const leftGap = this.lastDrawMeta?.leftGap ?? 0;
    return chartLeft + (leftGap + index - this.startIndex) * totalSp + candleW / 2;
  }

  /** 앵커 가격을 캔들 OHLC 중 가장 가까운 값으로 자석 스냅 (약한 자석: 12px 이내) */
  private drawing_apply_magnet(anchor: DrawingAnchor): DrawingAnchor {
    if (this.drawingMagnetMode === 'off') return anchor;
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return anchor;
    const nearIdx = Math.round(anchor.index);
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
    // 기본 포지션 영역 박스 너비: 보이는 캔들의 18%
    const defaultBars = Math.max(7, Math.round(visibleBars * 0.075));
    return { anchor, defaultRisk, defaultBars };
  }

  private cloneShape(shape: DrawingShape): DrawingShape {
    return cloneDrawingShape(shape);
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
    const ax = this.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
    const ay = metrics.getY(shape.a.price);
    const bx = shape.b ? this.xForIndex(shape.b.index, metrics.totalSp, metrics.candleW) : ax;
    const by = shape.b ? metrics.getY(shape.b.price) : ay;
    const rawText = (shape.text ?? '').trim();
    const text = rawText || placeholder;
    const isPlaceholder = rawText.length === 0 && text.length > 0;
    if (text === '') {
      return { text: '', angle: 0, x: 0, y: 0, width: 0, height: 0, isPlaceholder: true };
    }
    let angle = Math.atan2(by - ay, bx - ax);
    if (angle > Math.PI / 2) angle -= Math.PI;
    else if (angle < -Math.PI / 2) angle += Math.PI;
    const x = (ax + bx) / 2;
    const y = (ay + by) / 2 - 10;
    this.overlayCtx.save();
    this.overlayCtx.font = `600 12px ${CHART_FONT_STACK}`;
    const width = Math.ceil(this.overlayCtx.measureText(text).width);
    this.overlayCtx.restore();
    return { text, angle, x, y, width, height: 14, isPlaceholder };
  }

  private applyTrendlineTextEdit(shapeId: string, rawValue: string): void {
    const shape = this.drawings.find((s) => s.id === shapeId && s.kind === 'trendline');
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
    const selected = this.drawings.find((shape) => shape.id === this.selectedDrawingId && shape.kind === 'trendline');
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

  private hitTestDrawing(shape: DrawingShape, mx: number, my: number, metrics: NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>): DrawingHitPart | null {
    if (shape.hidden) return null;
    const ax = this.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
    const ay = metrics.getY(shape.a.price);
    const bx = shape.b ? this.xForIndex(shape.b.index, metrics.totalSp, metrics.candleW) : ax;
    const by = shape.b ? metrics.getY(shape.b.price) : ay;
    const pad = 8;
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const anchorHitPad = isCoarsePointer ? 25 : 8;
    const pointInPolygon = (x: number, y: number, points: Array<{ x: number; y: number }>): boolean => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;
        const intersects = ((yi > y) !== (yj > y))
          && (x < ((xj - xi) * (y - yi)) / Math.max(1e-6, (yj - yi)) + xi);
        if (intersects) inside = !inside;
      }
      return inside;
    };

    if (shape.kind === 'trendline') {
      const lineHitPad = isCoarsePointer ? 22 : 16;
      const startHit = Math.hypot(mx - ax, my - ay) <= anchorHitPad;
      if (startHit) return 'start';
      const endHit = Math.hypot(mx - bx, my - by) <= anchorHitPad;
      if (endHit) return 'end';
      const hasText = (shape.text ?? '').trim().length > 0;
      const isHoveredGuide = shape.id === this.hoveredDrawingId
        && (this.hoveredDrawingPart === 'line' || this.hoveredDrawingPart === 'trendline-text-guide');
      const placeholder = !hasText && isHoveredGuide ? '텍스트 입력' : '';
      const label = this.getTrendlineTextLayout(shape, metrics, placeholder);
      if (label.text) {
        const relX = mx - label.x;
        const relY = my - label.y;
        const c = Math.cos(-label.angle);
        const s = Math.sin(-label.angle);
        const lx = relX * c - relY * s;
        const ly = relX * s + relY * c;
        const labelPadX = label.isPlaceholder ? 42 : 8;
        const labelPadY = label.isPlaceholder ? 24 : 8;
        if (
          lx >= -label.width / 2 - labelPadX &&
          lx <= label.width / 2 + labelPadX &&
          ly >= -label.height - labelPadY &&
          ly <= labelPadY * 1.8
        ) {
          return label.isPlaceholder ? 'trendline-text-guide' : 'body';
        }
      }
      if (this.pointToSegmentDistance(mx, my, ax, ay, bx, by) <= lineHitPad) return 'line';
      const left = Math.min(ax, bx) - lineHitPad;
      const right = Math.max(ax, bx) + lineHitPad;
      const top = Math.min(ay, by) - lineHitPad;
      const bottom = Math.max(ay, by) + lineHitPad;
      return (mx >= left && mx <= right && my >= top && my <= bottom) ? 'body' : null;
    }
    if (shape.kind === 'hline') {
      if (mx < metrics.chartLeft || mx > metrics.chartRight) return null;
      if (Math.abs(my - ay) <= 9) return 'line';
      return Math.abs(my - ay) <= 16 ? 'body' : null;
    }
    if (shape.kind === 'channel') {
      const g = this.getChannelGeometry(shape);
      const a2x = this.xForIndex(g.a2.index, metrics.totalSp, metrics.candleW);
      const a2y = metrics.getY(g.a2.price);
      const b2x = this.xForIndex(g.b2.index, metrics.totalSp, metrics.candleW);
      const b2y = metrics.getY(g.b2.price);
      if (Math.hypot(mx - ax, my - ay) <= anchorHitPad) return 'channel-a';
      if (Math.hypot(mx - bx, my - by) <= anchorHitPad) return 'channel-b';
      const baseMidX = (ax + bx) / 2;
      const baseMidY = (ay + by) / 2;
      const paraMidX = (a2x + b2x) / 2;
      const paraMidY = (a2y + b2y) / 2;
      if (mx >= baseMidX - 8 && mx <= baseMidX + 8 && my >= baseMidY - 8 && my <= baseMidY + 8) return 'channel-mid-base';
      if (mx >= paraMidX - 8 && mx <= paraMidX + 8 && my >= paraMidY - 8 && my <= paraMidY + 8) return 'channel-mid-parallel';
      const midX = (ax + bx + a2x + b2x) / 4;
      const midY = (ay + by + a2y + b2y) / 4;
      if (mx >= midX - 8 && mx <= midX + 8 && my >= midY - 8 && my <= midY + 8) return 'channel-center';
      if (Math.hypot(mx - a2x, my - a2y) <= 8 || Math.hypot(mx - b2x, my - b2y) <= 8) return 'channel-offset';
      const lineHit = this.pointToSegmentDistance(mx, my, ax, ay, bx, by) <= 10
        || this.pointToSegmentDistance(mx, my, a2x, a2y, b2x, b2y) <= 10;
      if (lineHit) return 'line';
      const insideChannel = pointInPolygon(mx, my, [
        { x: ax, y: ay },
        { x: bx, y: by },
        { x: b2x, y: b2y },
        { x: a2x, y: a2y },
      ]);
      if (insideChannel) return 'body';
      const left = Math.min(ax, bx, a2x, b2x) - 10;
      const right = Math.max(ax, bx, a2x, b2x) + 10;
      const top = Math.min(ay, by, a2y, b2y) - 10;
      const bottom = Math.max(ay, by, a2y, b2y) + 10;
      return (mx >= left && mx <= right && my >= top && my <= bottom) ? 'body' : null;
    }
    if (shape.kind === 'fib-retracement' || shape.kind === 'fib-trend') {
      const startHit = Math.hypot(mx - ax, my - ay) <= anchorHitPad;
      if (startHit) return 'start';
      const endHit = Math.hypot(mx - bx, my - by) <= anchorHitPad;
      if (endHit) return 'end';
      const fibRatios = [4.236, 3.618, 2.618, 1.618, 1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
      if (shape.kind === 'fib-trend' && shape.channelOffset) {
        const cx = this.xForIndex(shape.a.index + shape.channelOffset.index, metrics.totalSp, metrics.candleW);
        const cy = metrics.getY(shape.a.price + shape.channelOffset.price);
        if (Math.hypot(mx - cx, my - cy) <= anchorHitPad) return 'fib-offset';
      }
      if (shape.kind === 'fib-retracement') {
        const price0 = shape.a.price;
        const price1 = shape.b ? shape.b.price : shape.a.price;
        const rangePrice = price1 - price0;
        const toY = (ratio: number) => metrics.getY(price0 + rangePrice * ratio);
        const x0 = Math.min(ax, bx);
        const x1 = Math.max(ax, bx);
        const yValues = fibRatios.map(toY);
        const top = Math.min(...yValues) - pad;
        const bottom = Math.max(...yValues) + pad;
        if (mx < x0 - pad || mx > x1 + pad || my < top || my > bottom) return null;
        for (const y of yValues) {
          if (Math.abs(my - y) <= 9 && mx >= x0 - pad && mx <= x1 + pad) return 'line';
        }
        return 'body';
      }

      const fibOffset = shape.channelOffset ?? { index: 0, price: 0 };
      const cPrice = shape.a.price + fibOffset.price;
      const movePrice = (shape.b?.price ?? shape.a.price) - shape.a.price;
      const cXRaw = this.xForIndex(shape.a.index + fibOffset.index, metrics.totalSp, metrics.candleW);
      const xStart = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.min(bx, cXRaw)));
      const xEnd = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.max(bx, cXRaw)));
      const yValues = fibRatios.map((ratio) => metrics.getY(cPrice + movePrice * ratio));
      const top = Math.min(...yValues) - pad;
      const bottom = Math.max(...yValues) + pad;
      if (xEnd - xStart > 1) {
        if (mx >= xStart - pad && mx <= xEnd + pad && my >= top && my <= bottom) {
          for (const y of yValues) {
            if (Math.abs(my - y) <= 9) return 'line';
          }
          return 'body';
        }
      }
      const guideHit = this.pointToSegmentDistance(mx, my, ax, ay, bx, by) <= 9
        || this.pointToSegmentDistance(mx, my, bx, by, cXRaw, metrics.getY(cPrice)) <= 9;
      return guideHit ? 'line' : null;
    }
    if (shape.kind === 'long-position' || shape.kind === 'short-position') {
      const targetOffset = shape.channelOffset ?? { index: 0, price: 0 };
      const tx = this.xForIndex(shape.a.index + targetOffset.index, metrics.totalSp, metrics.candleW);
      const ty = metrics.getY(shape.a.price + targetOffset.price);
      // 박스 좌우 경계 계산
      let posLeft  = Math.min(ax, tx);
      let posRight = Math.max(ax, tx);
      if (Math.abs(posRight - posLeft) < 14) { posLeft -= 28; posRight += 28; }
      const badgeCenterX = (posLeft + posRight) / 2;
      const badgeW = Math.max(86, Math.abs(posRight - posLeft) * 0.62);
      const badgeH = 20;
      if (
        mx >= badgeCenterX - badgeW / 2
        && mx <= badgeCenterX + badgeW / 2
        && my >= ay - badgeH / 2
        && my <= ay + badgeH / 2
      ) return 'position-entry-info';

      // 진입가 앵커 (원형) ? 박스 왼쪽 진입 라인
      if (Math.hypot(mx - posLeft, my - ay) <= 14) return 'start';
      // 손절가 앵커 (사각) ? 박스 왼쪽 손절 라인
      if (Math.hypot(mx - posLeft, my - by) <= 14) return 'end';
      // 목표가 앵커 (사각) ? 박스 왼쪽 목표 라인
      if (shape.channelOffset) {
        if (Math.hypot(mx - posLeft, my - ty) <= 14) return 'position-target';
      }
      // 우측 앵커 (사각) ? 박스 오른쪽 라인 · 진입가 Y
      if (Math.hypot(mx - posRight, my - ay) <= 14) return 'position-right' as DrawingHitPart;
      // 라인 히트
      if (Math.abs(my - ty) <= 7 && mx >= posLeft - 4 && mx <= posRight + 4) return 'position-target';
      if (Math.abs(my - by) <= 7 && mx >= posLeft - 4 && mx <= posRight + 4) return 'end';
      // 박스 전체
      const boxTop    = Math.min(ay, by, ty) - pad;
      const boxBottom = Math.max(ay, by, ty) + pad;
      return (mx >= posLeft - pad && mx <= posRight + pad && my >= boxTop && my <= boxBottom) ? 'body' : null;
    }
    if (shape.kind === 'measure') {
      if (Math.hypot(mx - ax, my - ay) <= 10) return 'start';
      if (Math.hypot(mx - bx, my - by) <= 10) return 'end';
      const left = Math.min(ax, bx) - pad;
      const right = Math.max(ax, bx) + pad;
      const top = Math.min(ay, by) - pad;
      const bottom = Math.max(ay, by) + pad;
      return (mx >= left && mx <= right && my >= top && my <= bottom) ? 'body' : null;
    }
    if (shape.kind === 'text-note') {
      const txt = shape.text ?? '텍스트';
      const tw = Math.max(40, txt.length * 7 + 12);
      const th = 22;
      return (mx >= ax - pad && mx <= ax + tw + pad && my >= ay - th - pad && my <= ay + pad) ? 'body' : null;
    }
    return null;
  }

  private findDrawingAt(mx: number, my: number): { shape: DrawingShape; part: DrawingHitPart } | null {
    if (!this.drawingsVisible) return null;
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return null;
    for (let i = this.drawings.length - 1; i >= 0; i -= 1) {
      const shape = this.drawings[i];
      const part = this.hitTestDrawing(shape, mx, my, metrics);
      if (part) {
        return { shape, part };
      }
    }
    return null;
  }

  private moveShapeByDelta(base: DrawingShape, dx: number, dy: number, part: DrawingHitPart = 'line'): DrawingShape {
    const metrics = this.getMainViewportMetrics();
    if (!metrics) return this.cloneShape(base);
    const deltaIndex = dx / Math.max(1e-6, metrics.totalSp);
    const deltaPrice = -(dy / Math.max(1, metrics.mainH - metrics.top)) * metrics.range;
    // 편집 시 앵커 이동에도 자석 적용 (캔들 OHLC)
    const moveAnchor = (a: DrawingAnchor): DrawingAnchor => {
      const raw: DrawingAnchor = {
        index: Math.max(0, Math.min(this.data.length - 1, a.index + deltaIndex)),
        price: a.price + deltaPrice,
      };
      return this.drawing_apply_magnet(raw);
    };
    if (base.locked) return this.cloneShape(base);
    if (base.kind === 'trendline') {
      if (part === 'start') {
        return {
          ...this.cloneShape(base),
          a: moveAnchor(base.a),
          b: base.b ? { ...base.b } : base.b,
        };
      }
      if (part === 'end' && base.b) {
        return {
          ...this.cloneShape(base),
          a: { ...base.a },
          b: moveAnchor(base.b),
        };
      }
    }
    if (base.kind === 'fib-retracement' || base.kind === 'fib-trend') {
      const next = this.cloneShape(base);
      if (part === 'start') {
        return {
          ...next,
          a: moveAnchor(base.a),
          b: base.b ? { ...base.b } : base.b,
        };
      }
      if (part === 'end' && base.b) {
        return {
          ...next,
          a: { ...base.a },
          b: moveAnchor(base.b),
        };
      }
      if (base.kind === 'fib-trend' && part === 'fib-offset') {
        if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
        next.channelOffset = {
          index: next.channelOffset.index + deltaIndex,
          price: next.channelOffset.price + deltaPrice,
        };
        return next;
      }
      if (part === 'line' || part === 'body') {
        return {
          ...next,
          a: moveAnchor(base.a),
          b: base.b ? moveAnchor(base.b) : base.b,
        };
      }
    }
    if (base.kind === 'long-position' || base.kind === 'short-position') {
      const next = this.cloneShape(base);
      if (part === 'start') {
        // 진입가 앵커: 자유 이동
        next.a = moveAnchor(base.a);
        return next;
      }
      if (part === 'end' || part === 'position-stop') {
        // 손절가 앵커: Y축(상하)만 이동
        if (!base.b) return next;
        const movedY = moveAnchor(base.b);
        next.b = { index: base.a.index, price: movedY.price };
        return next;
      }
      if (part === 'position-target') {
        // 목표가 앵커: Y축(상하)만 이동
        if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
        next.channelOffset = {
          index: next.channelOffset.index,           // X 고정
          price: next.channelOffset.price + deltaPrice, // Y만 변경
        };
        return next;
      }
      if (part === 'position-right') {
        // 우측 앵커: X축(좌우)만 이동
        if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
        next.channelOffset = {
          index: next.channelOffset.index + deltaIndex, // X만 변경
          price: next.channelOffset.price,              // Y 고정
        };
        return next;
      }
      if (part === 'position-entry-info') {
        return next;
      }
      if (part === 'line' || part === 'body') {
        // 전체 이동
        next.a = moveAnchor(base.a);
        next.b = base.b ? moveAnchor(base.b) : base.b;
        return next;
      }
    }
    if (base.kind === 'measure') {
      const next = this.cloneShape(base);
      if (part === 'start') {
        next.a = moveAnchor(base.a);
        return next;
      }
      if (part === 'end' && base.b) {
        next.b = moveAnchor(base.b);
        return next;
      }
      if (part === 'line' || part === 'body') {
        next.a = moveAnchor(base.a);
        next.b = base.b ? moveAnchor(base.b) : base.b;
        return next;
      }
    }
    if (base.kind === 'channel') {
      const next = this.cloneShape(base);
      if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
      if (part === 'channel-a') {
        next.a = moveAnchor(base.a);
        return next;
      }
      if (part === 'channel-b' && base.b) {
        next.b = moveAnchor(base.b);
        return next;
      }
      if (part === 'channel-offset') {
        next.channelOffset = {
          index: next.channelOffset.index + deltaIndex,
          price: next.channelOffset.price + deltaPrice,
        };
        return next;
      }
      if (part === 'channel-mid-base') {
        next.a = moveAnchor(base.a);
        next.b = base.b ? moveAnchor(base.b) : base.b;
        if (next.channelOffset) {
          next.channelOffset = {
            index: next.channelOffset.index - deltaIndex,
            price: next.channelOffset.price - deltaPrice,
          };
        }
        return next;
      }
      if (part === 'channel-mid-parallel') {
        if (next.channelOffset) {
          next.channelOffset = {
            index: next.channelOffset.index + deltaIndex,
            price: next.channelOffset.price + deltaPrice,
          };
        }
        return next;
      }
      if (part === 'channel-center' || part === 'line' || part === 'body') {
        next.a = moveAnchor(base.a);
        next.b = base.b ? moveAnchor(base.b) : base.b;
        return next;
      }
    }
    return {
      id: base.id,
      kind: base.kind,
      a: moveAnchor(base.a),
      b: base.b ? moveAnchor(base.b) : undefined,
      text: base.text,
      color: base.color,
      width: base.width,
      lineStyle: base.lineStyle,
      channelOffset: base.channelOffset ? { ...base.channelOffset } : undefined,
      hidden: base.hidden,
      locked: base.locked,
      alert: base.alert ? { ...base.alert } : undefined,
    };
  }

  private drawSelectionOverlay(ctx: CanvasRenderingContext2D, shape: DrawingShape, metrics: NonNullable<ReturnType<SimpleChart['getMainViewportMetrics']>>) {
    const ax = this.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
    const ay = metrics.getY(shape.a.price);
    const bx = shape.b ? this.xForIndex(shape.b.index, metrics.totalSp, metrics.candleW) : ax;
    const by = shape.b ? metrics.getY(shape.b.price) : ay;
    const left = Math.min(ax, bx);
    const right = Math.max(ax, bx);
    const top = Math.min(ay, by);
    const bottom = Math.max(ay, by);
    ctx.save();
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    if (shape.kind === 'hline') {
      // hline selection overlay intentionally hidden to avoid dotted line overlap.
    } else if (shape.kind === 'measure') {
      // quick measure selection overlay intentionally hidden (no yellow dashed guide).
    } else if (shape.kind === 'trendline') {
      // trendline selection box/handles are intentionally hidden here.
    } else if (shape.kind === 'channel') {
      // channel selection overlay is handled by custom handles in drawDrawingShape.
    } else if (shape.kind === 'text-note') {
      const txt = shape.text ?? '텍스트';
      const tw = Math.max(40, txt.length * 7 + 12);
      const th = 22;
      ctx.strokeRect(ax - 2, ay - th - 2, tw + 4, th + 4);
    } else if (shape.kind === 'long-position' || shape.kind === 'short-position') {
      // position: 전용 앵커 핸들이 있으므로 노란 점선 박스 불필요
    } else if (shape.kind === 'fib-retracement' || shape.kind === 'fib-trend') {
      // 피보나치: 레벨선·수치값이 이미 표시되므로 노란 점선 박스 불필요
    } else {
      ctx.strokeRect(left - 4, top - 4, Math.max(8, right - left + 8), Math.max(8, bottom - top + 8));
    }
    ctx.setLineDash([]);
    if (shape.kind !== 'trendline' && shape.kind !== 'hline' && shape.kind !== 'measure'
        && shape.kind !== 'long-position' && shape.kind !== 'short-position'
        && shape.kind !== 'fib-retracement' && shape.kind !== 'fib-trend') {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (shape.b) {
        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawDrawingShape(ctx: CanvasRenderingContext2D, shape: DrawingShape | DrawingDraft, isDraft: boolean, metrics: ReturnType<SimpleChart['getMainViewportMetrics']>) {
    if (!metrics) return;
    if ('hidden' in shape && shape.hidden) return;
    const a = shape.a;
    const b = shape.b;
    const ax = this.xForIndex(a.index, metrics.totalSp, metrics.candleW);
    const ay = metrics.getY(a.price);
    const bx = b ? this.xForIndex(b.index, metrics.totalSp, metrics.candleW) : ax;
    const by = b ? metrics.getY(b.price) : ay;
    const alpha = isDraft ? 0.72 : 1;
    const strokeColor = ('color' in shape && shape.color) ? shape.color : '#2f6cff';
    const strokeWidth = ('width' in shape && shape.width) ? shape.width : 2;
    const lineStyle = ('lineStyle' in shape && shape.lineStyle) ? shape.lineStyle : 'solid';
    const dashByStyle: Record<'solid' | 'dash' | 'dot', number[]> = {
      solid: [],
      dash: [10, 6],
      dot: [2, 5],
    };
    const setStroke = (color: string, width = 1.5, dash: number[] = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.globalAlpha = alpha;
    };

    switch (shape.kind) {
      case 'trendline': {
        setStroke(strokeColor, strokeWidth, dashByStyle[lineStyle]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        if (!isDraft) {
          const shapeId = ('id' in shape) ? shape.id : null;
          const showHandles = shapeId != null && (shapeId === this.selectedDrawingId || shapeId === this.hoveredDrawingId);
          if (showHandles) {
            const isHovered = shapeId != null && shapeId === this.hoveredDrawingId;
            const pulse = (Math.sin(performance.now() * 0.012) + 1) * 0.5;
            const r = 8.25;  // 150% 확대: 5.5 → 8.25
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;  // 드로잉 두께와 동일
            ctx.setLineDash([]);
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(ax, ay, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (isHovered) {
              ctx.save();
              ctx.globalAlpha = 0.24 + pulse * 0.28;
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;  // 드로잉 두께와 동일
              ctx.beginPath();
              ctx.arc(ax, ay, r + 2 + pulse * 1.5, 0, Math.PI * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(bx, by, r + 2 + pulse * 1.5, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }
          const hasText = ((shape as DrawingShape).text ?? '').trim().length > 0;
          const isHoveredGuide = shapeId != null
            && shapeId === this.hoveredDrawingId
            && (this.hoveredDrawingPart === 'line' || this.hoveredDrawingPart === 'trendline-text-guide');
          const isEditingText = shapeId != null && shapeId === this.trendlineTextEditorShapeId;
          const placeholder = !hasText && isHoveredGuide ? '텍스트 입력' : '';
          const layout = this.getTrendlineTextLayout(shape as DrawingShape, metrics, placeholder);
          if (layout.text && !isEditingText) {
            ctx.save();
            ctx.translate(layout.x, layout.y);
            ctx.rotate(layout.angle);
            ctx.fillStyle = layout.isPlaceholder ? 'rgba(214,224,242,0.86)' : '#f0f5ff';
            ctx.font = `600 12px ${CHART_FONT_STACK}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(layout.text, 0, 0);
            if (layout.isPlaceholder) {
              ctx.strokeStyle = 'rgba(214,224,242,0.35)';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(-layout.width / 2 - 4, 2);
              ctx.lineTo(layout.width / 2 + 4, 2);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        break;
      }
      case 'hline': {
        setStroke(strokeColor, strokeWidth, dashByStyle[lineStyle]);
        ctx.beginPath();
        ctx.moveTo(metrics.chartLeft, ay);
        ctx.lineTo(metrics.chartRight, ay);
        ctx.stroke();

        // Axis price box follows the hline color automatically.
        const boxW = Math.max(20, metrics.axisPad - 2);
        const boxX = metrics.axisSide === 'left' ? 2 : metrics.chartRight;
        const boxH = 20;
        ctx.save();
        ctx.setLineDash([]);
        ctx.fillStyle = strokeColor;
        drawPriceArrowBox(ctx, boxX, ay, boxW, boxH, metrics.axisSide);
        ctx.fill();
        ctx.fillStyle = getContrastTextColor(strokeColor);
        ctx.font = `700 12px ${CHART_FONT_STACK}`;
        const hlineTextAnchor = getPriceArrowTextAnchor(boxX, boxW, metrics.axisSide, 5);
        ctx.textAlign = hlineTextAnchor.align;
        ctx.textBaseline = 'middle';
        ctx.fillText(
          formatWithComma(a.price, getSymbolPricePrecision(this.config.symbol, this.config.quoteCurrency)),
          hlineTextAnchor.x,
          ay,
        );
        ctx.restore();

        const text = ('text' in shape ? shape.text : '') ?? '';
        if (text.trim()) {
          ctx.save();
          ctx.fillStyle = '#f0f5ff';
          ctx.font = `600 12px ${CHART_FONT_STACK}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, 8, ay - 6);
          ctx.restore();
        }

        if (!isDraft) {
          const shapeId = ('id' in shape) ? shape.id : null;
          const showHandles = shapeId != null && (shapeId === this.selectedDrawingId || shapeId === this.hoveredDrawingId);
          if (showHandles) {
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = '#0f172a';
            ctx.lineWidth = Math.max(1.2, strokeWidth);
            const S = 10;
            const R = 3;
            const drawHandle = (hx: number, hy: number) => {
              ctx.beginPath();
              (ctx as any).roundRect(hx - S / 2, hy - S / 2, S, S, R);
              ctx.fill();
              ctx.stroke();
            };
            const handleOffset = Math.max(20, boxW * 2);
            const handleXRaw = metrics.axisSide === 'left'
              ? metrics.chartLeft + handleOffset
              : metrics.chartRight - handleOffset;
            const handleX = Math.max(metrics.chartLeft + 12, Math.min(metrics.chartRight - 12, handleXRaw));
            drawHandle(handleX, ay);
            ctx.restore();
          }
        }
        break;
      }
      case 'channel': {
        const g = this.getChannelGeometry(shape);
        const a2x = this.xForIndex(g.a2.index, metrics.totalSp, metrics.candleW);
        const a2y = metrics.getY(g.a2.price);
        const b2x = this.xForIndex(g.b2.index, metrics.totalSp, metrics.candleW);
        const b2y = metrics.getY(g.b2.price);
        const m1x = (ax + bx) / 2;
        const m1y = (ay + by) / 2;
        const m2x = (a2x + b2x) / 2;
        const m2y = (a2y + b2y) / 2;
        const leftMidX = (ax + a2x) / 2;
        const leftMidY = (ay + a2y) / 2;
        const rightMidX = (bx + b2x) / 2;
        const rightMidY = (by + b2y) / 2;
        const offsetPx = Math.hypot(a2x - ax, a2y - ay);
        setStroke(strokeColor, strokeWidth, dashByStyle[lineStyle]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        if (offsetPx > 0.8) {
          ctx.moveTo(a2x, a2y);
          ctx.lineTo(b2x, b2y);
        }
        ctx.stroke();
        if (offsetPx <= 0.8) {
          if (!isDraft) {
            const shapeId = ('id' in shape) ? shape.id : null;
            const showHandles = shapeId != null && (shapeId === this.selectedDrawingId || shapeId === this.hoveredDrawingId);
            if (showHandles) {
              ctx.save();
              ctx.setLineDash([]);
              ctx.strokeStyle = strokeColor;
              ctx.fillStyle = '#0f172a';
              ctx.lineWidth = strokeWidth;  // 드로잉 두께와 동일
              const drawCorner = (x: number, y: number) => {
                ctx.beginPath();
                ctx.arc(x, y, 6.75, 0, Math.PI * 2);  // 150% 확대: 4.5 → 6.75
                ctx.fill();
                ctx.stroke();
              };
              drawCorner(ax, ay);
              drawCorner(bx, by);
              ctx.restore();
            }
          }
          break;
        }
        ctx.save();
        ctx.globalAlpha = alpha * 0.14;
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(b2x, b2y);
        ctx.lineTo(a2x, a2y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        setStroke(strokeColor, Math.max(1, strokeWidth - 0.7), [4, 4]);
        ctx.beginPath();
        ctx.moveTo(leftMidX, leftMidY);
        ctx.lineTo(rightMidX, rightMidY);
        ctx.stroke();
        if (!isDraft) {
          const shapeId = ('id' in shape) ? shape.id : null;
          const showHandles = shapeId != null && (shapeId === this.selectedDrawingId || shapeId === this.hoveredDrawingId);
          if (showHandles) {
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = '#0f172a';
            ctx.lineWidth = strokeWidth;  // 드로잉 두께와 동일
            const drawCorner = (x: number, y: number) => {
              ctx.beginPath();
              ctx.arc(x, y, 6.75, 0, Math.PI * 2);  // 150% 확대: 4.5 → 6.75
              ctx.fill();
              ctx.stroke();
            };
            drawCorner(ax, ay);
            drawCorner(bx, by);
            drawCorner(a2x, a2y);
            drawCorner(b2x, b2y);
            const w = 10;
            const h = 8;
            const r = 2;
            const drawRoundedHandle = (x: number, y: number) => {
              ctx.beginPath();
              ctx.moveTo(x - w / 2 + r, y - h / 2);
              ctx.lineTo(x + w / 2 - r, y - h / 2);
              ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
              ctx.lineTo(x + w / 2, y + h / 2 - r);
              ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
              ctx.lineTo(x - w / 2 + r, y + h / 2);
              ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
              ctx.lineTo(x - w / 2, y - h / 2 + r);
              ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            };
            drawRoundedHandle(m1x, m1y);
            drawRoundedHandle(m2x, m2y);
            ctx.restore();
          }
        }
        break;
      }
      case 'fib-retracement':
      case 'fib-trend': {
        const price0 = a.price;
        const price1 = b ? b.price : a.price;
        const rangePrice = price1 - price0;
        const isTrendBased = shape.kind === 'fib-trend';
        const fibOffset = isTrendBased
          ? ((shape as DrawingShape | DrawingDraft).channelOffset ?? { index: 0, price: 0 })
          : { index: 0, price: 0 };
        const cx = this.xForIndex(a.index + fibOffset.index, metrics.totalSp, metrics.candleW);
        const cy = metrics.getY(a.price + fibOffset.price);
        const levels: Array<{
          ratio: number;
          lineColor: string;
          zoneColor: string;
        }> = [
          { ratio: 4.236, lineColor: '#ff2b74', zoneColor: 'rgba(255,43,116,0.16)' },
          { ratio: 3.618, lineColor: '#b437ff', zoneColor: 'rgba(180,55,255,0.14)' },
          { ratio: 2.618, lineColor: '#ff4b62', zoneColor: 'rgba(255,75,98,0.13)' },
          { ratio: 1.618, lineColor: '#2d69ff', zoneColor: 'rgba(45,105,255,0.14)' },
          { ratio: 1, lineColor: '#8d92a3', zoneColor: 'rgba(141,146,163,0.12)' },
          { ratio: 0.786, lineColor: '#00e1ff', zoneColor: 'rgba(0,225,255,0.12)' },
          { ratio: 0.618, lineColor: '#1dd6c4', zoneColor: 'rgba(29,214,196,0.11)' },
          { ratio: 0.5, lineColor: '#2ad65f', zoneColor: 'rgba(42,214,95,0.11)' },
          { ratio: 0.382, lineColor: '#ffa31a', zoneColor: 'rgba(255,163,26,0.12)' },
          { ratio: 0.236, lineColor: '#ff445f', zoneColor: 'rgba(255,68,95,0.12)' },
          { ratio: 0, lineColor: '#7d8495', zoneColor: 'rgba(125,132,149,0.10)' },
        ];
        const toPrice = (ratio: number) => price0 + rangePrice * ratio;
        const toY = (ratio: number) => metrics.getY(toPrice(ratio));
        const x0 = Math.min(ax, bx);
        const x1 = Math.max(ax, bx);
        const outsideLabelX = (left: number, right: number) => {
          const leftOutside = left - 132;
          if (leftOutside >= metrics.chartLeft + 6) return leftOutside;
          return Math.min(metrics.chartRight - 180, right + 8);
        };
        const labelX = outsideLabelX(x0, x1);
        const lineDash = dashByStyle[lineStyle];

        if (!isTrendBased) {
          // Retracement: horizontal levels
          for (let i = 0; i < levels.length - 1; i += 1) {
            const yA = toY(levels[i].ratio);
            const yB = toY(levels[i + 1].ratio);
            const top = Math.min(yA, yB);
            const h = Math.abs(yA - yB);
            if (h < 1) continue;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = levels[i].zoneColor;
            ctx.fillRect(x0, top, Math.max(1, x1 - x0), h);
            ctx.restore();
          }

          levels.forEach((lv) => {
            const y = toY(lv.ratio);
            setStroke(lv.lineColor, Math.max(1.1, strokeWidth * 0.9), lineDash);
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
            ctx.stroke();

            const p = toPrice(lv.ratio);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = lv.lineColor;
            ctx.font = `600 13px ${CHART_FONT_STACK}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const ratioText = Number.isInteger(lv.ratio) ? `${lv.ratio}` : lv.ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
            ctx.fillText(`${ratioText} (${p.toFixed(2)})`, labelX, y);
            ctx.restore();
          });
        } else {
          // TradingView-like 3-point Trend-Based Fib Extension:
          // A->B : base move, C : retracement anchor. Levels are projected horizontally from C.
          const cPrice = a.price + fibOffset.price;
          const movePrice = (b?.price ?? a.price) - a.price;
          const bXRaw = bx;
          const cXRaw = this.xForIndex(a.index + fibOffset.index, metrics.totalSp, metrics.candleW);
          const xStart = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.min(bXRaw, cXRaw)));
          const xEnd = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.max(bXRaw, cXRaw)));

          const projLevels = [...levels]
            .sort((l, r) => l.ratio - r.ratio)
            .map((lv) => {
              const p = cPrice + movePrice * lv.ratio;
              return {
                ratio: lv.ratio,
                p,
                y: metrics.getY(p),
                lineColor: lv.lineColor,
                zoneColor: lv.zoneColor,
              };
            });

          if (xEnd - xStart > 1) {
            // Zone fills between adjacent projected levels
            for (let i = 0; i < projLevels.length - 1; i += 1) {
              const u = projLevels[i];
              const d = projLevels[i + 1];
              const top = Math.min(u.y, d.y);
              const h = Math.abs(u.y - d.y);
              if (h < 1) continue;
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.fillStyle = d.zoneColor;
              ctx.fillRect(xStart, top, xEnd - xStart, h);
              ctx.restore();
            }

            projLevels.forEach((lv) => {
              setStroke(lv.lineColor, Math.max(1.1, strokeWidth * 0.9), lineDash);
              ctx.beginPath();
              ctx.moveTo(xStart, lv.y);
              ctx.lineTo(xEnd, lv.y);
              ctx.stroke();

              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.fillStyle = lv.lineColor;
              ctx.font = `600 13px ${CHART_FONT_STACK}`;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              const ratioText = Number.isInteger(lv.ratio) ? `${lv.ratio}` : lv.ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
              const lx = outsideLabelX(xStart, xEnd);
              ctx.fillText(`${ratioText} (${lv.p.toFixed(2)})`, lx, lv.y);
              ctx.restore();
            });
          }

          // Keep 3-point guide always visible even after editing.
          setStroke('rgba(190,205,233,0.78)', Math.max(1, strokeWidth * 0.85), [6, 6]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.moveTo(bx, by);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }

        if (!isDraft) {
          const shapeId = ('id' in shape) ? shape.id : null;
          const showHandles = shapeId != null && (shapeId === this.selectedDrawingId || shapeId === this.hoveredDrawingId);
          if (showHandles) {
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = '#2f6cff';
            ctx.fillStyle = '#0f172a';
            ctx.lineWidth = strokeWidth;  // 드로잉 두께와 동일
            const r = 9;  // 150% 확대: 6 → 9
            ctx.beginPath();
            ctx.arc(ax, ay, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (isTrendBased) {
              ctx.beginPath();
              ctx.arc(cx, cy, r, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        break;
      }
      case 'long-position':
      case 'short-position': {
        const isLong = shape.kind === 'long-position';
        const entryX = ax;
        const entryY = ay;
        const stopY  = by;
        const targetAnchor = ('channelOffset' in shape ? shape.channelOffset : undefined) ?? { index: 0, price: 0 };
        const targetX = this.xForIndex(a.index + targetAnchor.index, metrics.totalSp, metrics.candleW);
        const targetY = metrics.getY(a.price + targetAnchor.price);
        let left  = Math.min(entryX, targetX);
        let right = Math.max(entryX, targetX);
        if (Math.abs(right - left) < 14) { left -= 28; right += 28; }

        const profitY       = Math.min(entryY, targetY);
        const profitBottomY = Math.max(entryY, targetY);
        const lossY         = Math.min(entryY, stopY);
        const lossBottomY   = Math.max(entryY, stopY);

        // ── 영역 박스 ───────────────────────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(34,171,148,0.20)';
        ctx.fillRect(left, profitY, Math.max(1, right - left), Math.max(1, profitBottomY - profitY));
        ctx.fillStyle = 'rgba(242,54,69,0.20)';
        ctx.fillRect(left, lossY,   Math.max(1, right - left), Math.max(1, lossBottomY - lossY));
        ctx.restore();

        // ── 가격선 ──────────────────────────────────────────────────────────
        const entryColor  = '#c7d0e2';
        const stopColor   = '#f23645';
        const targetColor = '#22ab94';
        setStroke(entryColor,  Math.max(1, strokeWidth * 0.8), []);
        ctx.beginPath(); ctx.moveTo(left, entryY);  ctx.lineTo(right, entryY);  ctx.stroke();
        setStroke(stopColor,   Math.max(1.1, strokeWidth * 0.9), dashByStyle[lineStyle]);
        ctx.beginPath(); ctx.moveTo(left, stopY);   ctx.lineTo(right, stopY);   ctx.stroke();
        setStroke(targetColor, Math.max(1.1, strokeWidth * 0.9), dashByStyle[lineStyle]);
        ctx.beginPath(); ctx.moveTo(left, targetY); ctx.lineTo(right, targetY); ctx.stroke();

        if (!isDraft) {
          const shapeId    = ('id' in shape) ? shape.id : null;
          const isSelected = shapeId != null && shapeId === this.selectedDrawingId;
          const isHovered  = shapeId != null && shapeId === this.hoveredDrawingId;

          // ── 정보 텍스트 ? 선택(편집) 모드에서만 표시 ───────────────────
          if (isSelected) {
            const entryPrice  = a.price;
            const stopPrice   = b ? b.price : a.price;
            const targetPrice = a.price + targetAnchor.price;
            const risk   = Math.abs(entryPrice - stopPrice);
            const reward = Math.abs(targetPrice - entryPrice);
            const rr     = risk > 1e-8 ? reward / risk : 0;
            const symbolUpper = String(this.config.symbol || '').toUpperCase();
            const pnlCurrency = (symbolUpper === 'KOSPI' || symbolUpper === 'KOSDAQ' || symbolUpper === 'KOSPI200') ? 'KRW' : 'USD';
            const positionCfg = ('position' in shape && shape.position)
              ? shape.position
              : {
                  accountSize: 1000,
                  riskMode: 'percent' as const,
                  riskPercent: 25,
                  riskAmount: 250,
                  leverageEnabled: false,
                  leverage: 10000,
                };
            const baseRiskBudget = positionCfg.riskMode === 'amount'
              ? Math.max(0, positionCfg.riskAmount ?? 0)
              : Math.max(0, (positionCfg.accountSize ?? 0) * ((positionCfg.riskPercent ?? 0) / 100));
            const leverageFactor = positionCfg.leverageEnabled ? Math.max(0.1, positionCfg.leverage ?? 1) : 1;
            const qty = risk > 1e-8 ? (baseRiskBudget / risk) * leverageFactor : 0;
            const closePnl = qty * reward;
            const pct    = (v: number) => entryPrice !== 0
              ? ((v / Math.abs(entryPrice)) * 100).toFixed(2) + '%' : '';
            const fmt    = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const fmtMoney = (v: number) => Math.round(v).toLocaleString('ko-KR');

            const drawBadge = (text: string, centerX: number, y: number, fill: string) => {
              ctx.save();
              ctx.font = `700 12px ${CHART_FONT_STACK}`;
              ctx.textBaseline = 'middle';
              const w = Math.ceil(ctx.measureText(text).width) + 10;
              const h = 18;
              const x = centerX - w / 2;
              ctx.fillStyle = fill;
              ctx.beginPath();
              (ctx as any).roundRect(x, y - h / 2, w, h, 3);
              ctx.fill();
              ctx.fillStyle = '#f4f8ff';
              ctx.textAlign = 'center';
              ctx.fillText(text, centerX, y + 0.5);
              ctx.restore();
            };
            const drawDoubleLineBadge = (lineTop: string, lineBottom: string, centerX: number, centerY: number, fill: string) => {
              ctx.save();
              ctx.font = `700 12px ${CHART_FONT_STACK}`;
              const w = Math.max(
                Math.ceil(ctx.measureText(lineTop).width),
                Math.ceil(ctx.measureText(lineBottom).width),
              ) + 12;
              const h = 34;
              const x = centerX - w / 2;
              const y = centerY - h / 2;
              ctx.fillStyle = fill;
              ctx.beginPath();
              (ctx as any).roundRect(x, y, w, h, 4);
              ctx.fill();
              ctx.fillStyle = '#f4f8ff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(lineTop, centerX, centerY - 8);
              ctx.fillText(lineBottom, centerX, centerY + 9);
              ctx.restore();
            };

            // 매수(Long): 목표가(위) / 손절가(아래) 배치
            // 매도(Short): 손절가(위) / 목표가(아래) ? 방향 반전
            // 목표는 항상 profit 영역 바깥, 손절은 항상 loss 영역 바깥
            const tLabelY = isLong ? (profitY - 10)      : (profitBottomY + 10);
            const sLabelY = isLong ? (lossBottomY + 10)  : (lossY - 10);
            // 손익비: 진입가 라인 바로 옆
            const rrLabelY = entryY;
            const boxCenterX = (left + right) / 2;

            drawBadge(`목표 ${fmt(targetPrice)}  +${pct(reward)}`, boxCenterX, tLabelY, 'rgba(31,168,141,0.90)');
            drawBadge(`손절 ${fmt(stopPrice)}  -${pct(risk)}`,    boxCenterX, sLabelY, 'rgba(229,65,79,0.90)');

            // 손익비: 소수점 1자리 (기본 1:1은 정수 표시)
            const rrText = rr === 1.0 ? '1 : 1' : `1 : ${rr.toFixed(1)}`;
            drawDoubleLineBadge(
              `청산손익 +${fmtMoney(closePnl)} (${pct(reward)}) ${pnlCurrency}`,
              `손익비 ${rrText}`,
              boxCenterX,
              rrLabelY,
              'rgba(27,152,128,0.90)',
            );
          }

          // ── 앵커 핸들 ? 선택/hover 시 표시, 라인 위에 배치 ────────────
          if (isSelected || isHovered) {
            ctx.save();
            ctx.strokeStyle = '#2f6cff';
            ctx.fillStyle   = '#0f172a';
            ctx.lineWidth   = 1.8;
            const S = 10; // 핸들 크기 (다른 드로잉과 동일)
            const R = 3;  // 모서리 반경

            const drawHandle = (hx: number, hy: number) => {
              ctx.beginPath();
              (ctx as any).roundRect(hx - S / 2, hy - S / 2, S, S, R);
              ctx.fill();
              ctx.stroke();
            };
            const drawCircle = (hx: number, hy: number) => {
              ctx.beginPath();
              ctx.arc(hx, hy, S / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            };

            // 진입가 앵커: 원형, 진입 라인 왼쪽 끝
            ctx.strokeStyle = entryColor;
            drawCircle(left, entryY);

            // 손절가 앵커: 라운드사각, 손절 라인 왼쪽 끝
            ctx.strokeStyle = stopColor;
            drawHandle(left, stopY);

            // 목표가 앵커: 라운드사각, 목표 라인 왼쪽 끝
            ctx.strokeStyle = targetColor;
            drawHandle(left, targetY);

            // 우측(너비) 앵커: 라운드사각, 박스 오른쪽 라인 · 진입가 Y
            ctx.strokeStyle = '#7a9ccf';
            drawHandle(right, entryY);

            ctx.restore();
          }
        }
        break;
      }
      case 'text-note': {
        const txt = (shape as DrawingShape).text ?? '텍스트';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(20,26,38,0.9)';
        ctx.strokeStyle = '#5672a3';
        ctx.lineWidth = 1;
        ctx.font = `12px ${CHART_FONT_STACK}`;
        const tw = Math.ceil(ctx.measureText(txt).width) + 12;
        const th = 22;
        ctx.fillRect(ax, ay - th, tw, th);
        ctx.strokeRect(ax, ay - th, tw, th);
        ctx.fillStyle = '#e6edf9';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, ax + 6, ay - th / 2);
        break;
      }
      case 'measure': {
        const left = Math.min(ax, bx);
        const right = Math.max(ax, bx);
        const top = Math.min(ay, by);
        const bottom = Math.max(ay, by);
        const w = Math.max(1, right - left);
        const h = Math.max(1, bottom - top);
        const isDown = by > ay;
        const baseColor = isDown ? this.config.candleStyle.downColor : this.config.candleStyle.upColor;
        const lineColor = toRgba(baseColor, 0.95, isDown ? 'rgba(242,54,69,0.95)' : 'rgba(34,171,148,0.95)');
        const fillColor = toRgba(baseColor, 0.22, isDown ? 'rgba(242,54,69,0.22)' : 'rgba(34,171,148,0.22)');
        const priceDelta = (b?.price ?? a.price) - a.price;
        const pct = a.price !== 0 ? (priceDelta / Math.abs(a.price)) * 100 : 0;
        const absDelta = Math.abs(priceDelta);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fillColor;
        ctx.fillRect(left, top, w, h);

        const midX = left + w / 2;
        const midY = top + h / 2;
        const arrow = 7;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(left + 6, midY);
        ctx.lineTo(right - 8, midY);
        ctx.lineTo(right - 8 - arrow, midY - arrow * 0.5);
        ctx.moveTo(right - 8, midY);
        ctx.lineTo(right - 8 - arrow, midY + arrow * 0.5);
        ctx.stroke();

        ctx.beginPath();
        if (isDown) {
          ctx.moveTo(midX, top + 6);
          ctx.lineTo(midX, bottom - 8);
          ctx.lineTo(midX - arrow * 0.5, bottom - 8 - arrow);
          ctx.moveTo(midX, bottom - 8);
          ctx.lineTo(midX + arrow * 0.5, bottom - 8 - arrow);
        } else {
          ctx.moveTo(midX, bottom - 6);
          ctx.lineTo(midX, top + 8);
          ctx.lineTo(midX - arrow * 0.5, top + 8 + arrow);
          ctx.moveTo(midX, top + 8);
          ctx.lineTo(midX + arrow * 0.5, top + 8 + arrow);
        }
        ctx.stroke();

        const deltaText = absDelta.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const label = `${priceDelta >= 0 ? '+' : '-'}${deltaText} (${priceDelta >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        ctx.font = `700 13px ${CHART_FONT_STACK}`;
        const textW = Math.ceil(ctx.measureText(label).width);
        const boxW = textW + 22;
        const boxH = 30;
        const boxX = Math.max(metrics.chartLeft + 8, Math.min(metrics.chartRight - boxW - 8, midX - boxW / 2));
        const boxY = Math.min(this.viewportHeight - X_AXIS_HEIGHT - boxH - 6, bottom + 10);
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
        ctx.fillStyle = getContrastTextColor(lineColor);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2);
        ctx.restore();

        if (!isDraft) {
          const shapeId = ('id' in shape) ? shape.id : null;
          const showHandles = shapeId != null && (shapeId === this.selectedDrawingId || shapeId === this.hoveredDrawingId);
          if (showHandles) {
            ctx.save();
            ctx.strokeStyle = '#2f6cff';
            ctx.fillStyle = '#0f172a';
            ctx.lineWidth = 1.4;
            const r = 5;
            [[ax, ay], [bx, by]].forEach(([hx, hy]) => {
              ctx.beginPath();
              ctx.arc(hx as number, hy as number, r, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            });
            ctx.restore();
          }
        }
        break;
      }
      default:
        break;
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
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

    // 현재가 라인: draw()에서 계산된 캐시 스케일 재사용
    if (this.data.length && mainScale) {
      const priceIdx = Math.max(this.startIndex, this.endIndex - 1);
      const last = this.data[priceIdx].close;
      const prev = priceIdx > 0 ? this.data[priceIdx - 1].close : last;
      const py = mainScale.toY(last);
      if (py >= R.top && py <= mainH) {
        const isUp = last >= prev;
        const boxColor = isUp ? '#22ab94' : '#f23645';
        ctx.strokeStyle = isUp ? 'rgba(34,171,148,0.9)' : 'rgba(242,54,69,0.9)';
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 2]);
        ctx.lineCap = 'round';
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartLeft, R.top, chartW, Math.max(0, mainH - R.top));
        ctx.clip();
        ctx.beginPath(); ctx.moveTo(chartLeft, py); ctx.lineTo(chartRight, py); ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
        const boundaryPadding = 12;
        if (py < mainH - boundaryPadding) {
          ctx.fillStyle = boxColor;
          const priceBoxW = geometry.side === 'left'
            ? Math.max(20, geometry.axisPad - 10)
            : Math.max(20, geometry.axisPad - 2);
          const priceBoxX = geometry.side === 'left' ? 6 : chartRight;
          drawPriceArrowBox(ctx, priceBoxX, py, priceBoxW, 20, geometry.side);
          ctx.fill();
          ctx.fillStyle = getContrastTextColor(boxColor);
          const priceTextAnchor = getPriceArrowTextAnchor(priceBoxX, priceBoxW, geometry.side, 5);
          ctx.font = `600 13px ${CHART_FONT_STACK}`; ctx.textAlign = priceTextAnchor.align;
          ctx.fillText(formatWithComma(last, symbolPriceDigits), priceTextAnchor.x, py + 4);
        }
      }
    }

    const drawingMetrics = this.getMainViewportMetrics();
    if (this.drawingsVisible && drawingMetrics) {
      ctx.save();
      this.drawings.forEach((shape) => {
        this.drawDrawingShape(ctx, shape, false, drawingMetrics);
        if (shape.id === this.selectedDrawingId) {
          this.drawSelectionOverlay(ctx, shape, drawingMetrics);
        }
      });
      if (this.drawingDraft) {
        this.drawDrawingShape(ctx, this.drawingDraft, true, drawingMetrics);
      }
      ctx.restore();
    }

    // ????????????????????????????????????????????????????????????????????????????
    // ?? 터치 드로잉 모드: 십자선 렌더링 (TradingView 스타일)
    // ????????????????????????????????????????????????????????????????????????????
    const hasTouchCrosshair = this.touchDrawingCrosshairX > 0 || this.touchDrawingCrosshairY > 0;
    const selectedShapeForDrawingCrosshair = this.selectedDrawingId
      ? this.drawings.find((s) => s.id === this.selectedDrawingId) ?? null
      : null;
    const isSelectedPositionShape = Boolean(
      selectedShapeForDrawingCrosshair && (selectedShapeForDrawingCrosshair.kind === 'long-position' || selectedShapeForDrawingCrosshair.kind === 'short-position'),
    );
    const shouldShowDrawingCrosshair = Boolean(this.drawingTool || this.drawingMoveState || isSelectedPositionShape);
    if (shouldShowDrawingCrosshair && (this.isMouseOver || hasTouchCrosshair)) {
      ctx.save();
      // PC는 마우스 좌표, 터치는 마지막 드로잉 십자 좌표를 사용
      const x = this.isMouseOver ? this.mouseX : this.touchDrawingCrosshairX;
      const y = this.isMouseOver ? this.mouseY : this.touchDrawingCrosshairY;

      // 얇은 파란 점선 (전체 축)
      ctx.strokeStyle = 'rgba(64, 180, 255, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
      ctx.moveTo(0, y); ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 중심 십자: 작은 실선
      ctx.strokeStyle = 'rgba(64, 180, 255, 0.8)';
      ctx.lineWidth = 1;
      const dotSize = 8;
      ctx.beginPath();
      ctx.moveTo(x - dotSize, y); ctx.lineTo(x + dotSize, y);
      ctx.moveTo(x, y - dotSize); ctx.lineTo(x, y + dotSize);
      ctx.stroke();

      // 중심 점 (원형)
      ctx.fillStyle = 'rgba(64, 180, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // ── 가이드 멘트 (시간축 바로 위) ──────────────────────────────────
      const isPositionTool = this.drawingTool === 'long-position' || this.drawingTool === 'short-position';
      const guideY = plotHeight + 4;
      ctx.font = `600 12px ${CHART_FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (isPositionTool) {
        ctx.fillStyle = 'rgba(12,18,32,0.80)';
        ctx.fillRect(0, guideY, width, X_AXIS_HEIGHT);
        ctx.fillStyle = 'rgba(64,180,255,0.9)';
        ctx.fillText('이동 후 손을 떼면 포지션이 생성됩니다', width / 2, guideY + 4);
      } else if (this.drawingTool === 'fib-trend') {
        // draft 없음=0단계, draft.stage=1이면 2단계, =2이면 3단계
        const stage = this.drawingDraft ? ((this.drawingDraft as any).stage ?? 1) : 0;
        const guideTexts: Record<number, string> = {
          0: '① 첫 번째 기준점: 이동 후 손을 떼세요',
          1: '② 두 번째 기준점: 이동 후 손을 떼세요',
          2: '③ 세 번째 기준점: 이동 후 손을 떼세요',
        };
        ctx.fillStyle = 'rgba(12,18,32,0.80)';
        ctx.fillRect(0, guideY, width, X_AXIS_HEIGHT);
        ctx.fillStyle = 'rgba(64,180,255,0.9)';
        ctx.fillText(guideTexts[stage] ?? '', width / 2, guideY + 4);
      } else {
        // 일반 드로잉 단계 표시
        if (this.drawingDraft && this.touchDrawingTapCount >= 1) {
          const stage = this.touchDrawingTapCount === 1 ? '두번째 포인트 선택' : '완료 또는 다른 곳 터치';
          ctx.fillStyle = 'rgba(64, 180, 255, 0.9)';
          ctx.textAlign = 'left';
          ctx.fillText(`? 첫 포인트 고정 · ${stage}`, 12, 30);
        } else {
          ctx.fillStyle = 'rgba(64, 180, 255, 0.7)';
          ctx.textAlign = 'left';
          ctx.fillText('첫 포인트 선택', 12, 30);
        }
      }

      ctx.restore();
    }

    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const gapBars = Math.min(Math.max(0, this.config.layout.rightGapBars ?? 0), 50 / Math.max(1, chartW / Math.max(1, this.endIndex - this.startIndex)));
    const totalSp = chartW / (visibleCount + gapBars);
    const candleW = Math.max(totalSp * 0.8, 1);

    if (this.focusedTradeRange) {
      const rangeStart = Math.max(0, Math.min(this.focusedTradeRange.startIndex, this.focusedTradeRange.endIndex));
      const rangeEnd = Math.max(0, Math.max(this.focusedTradeRange.startIndex, this.focusedTradeRange.endIndex));
      const visibleStart = this.startIndex;
      const visibleEnd = this.endIndex - 1;
      const drawStart = Math.max(rangeStart, visibleStart);
      const drawEnd = Math.min(rangeEnd, visibleEnd);
      if (drawStart <= drawEnd) {
        const startLocal = drawStart - this.startIndex;
        const endLocal = drawEnd - this.startIndex;
        const x1 = chartLeft + startLocal * totalSp;
        const x2 = chartLeft + endLocal * totalSp + candleW;
        const elapsed = this.focusVisualStartedAt > 0 ? (Date.now() - this.focusVisualStartedAt) : 0;
        const pulse = 0.5 + 0.5 * Math.sin(elapsed / 170);
        const fillAlpha = 0.18 + pulse * 0.14;
        const strokeAlpha = 0.5 + pulse * 0.38;
        const glowAlpha = 0.14 + pulse * 0.22;
        const rangeW = Math.max(2, x2 - x1);
        const rangeH = Math.max(0, mainH - R.top);
        ctx.save();
        ctx.fillStyle = `rgba(72,118,255,${fillAlpha.toFixed(3)})`;
        ctx.strokeStyle = `rgba(145,188,255,${strokeAlpha.toFixed(3)})`;
        ctx.shadowColor = `rgba(96,154,255,${glowAlpha.toFixed(3)})`;
        ctx.shadowBlur = 16 + pulse * 10;
        ctx.lineWidth = 1.3 + pulse * 0.7;
        ctx.fillRect(x1, R.top, rangeW, rangeH);
        ctx.strokeRect(x1 + 0.5, R.top + 0.5, Math.max(1, rangeW - 1), Math.max(1, rangeH - 1));
        ctx.restore();
        this.requestOverlayDraw();
      }
    }

    if (this.gotoDateMarker && mainScale) {
      const idx = this.gotoDateMarker.candleIndex;
      if (idx >= this.startIndex && idx < this.endIndex && this.data[idx]) {
        const markerX = this.getCandleCenterX(idx) ?? (chartLeft + (idx - this.startIndex) * totalSp + candleW / 2);
        const markerY = Math.max(R.top + 14, Math.min(mainH - 10, mainScale.toY(this.data[idx].high) - 10));
        const text = this.gotoDateMarker.label;
        ctx.save();
        ctx.font = `700 11px ${CHART_FONT_STACK}`;
        const textW = Math.ceil(ctx.measureText(text).width);
        const boxW = Math.max(70, textW + 12);
        const boxH = 20;
        const boxX = Math.max(chartLeft + 4, Math.min(chartRight - boxW - 4, markerX - boxW / 2));
        const boxY = Math.max(R.top + 2, markerY - boxH - 12);

        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(markerX - 6, boxY + boxH);
        ctx.lineTo(markerX + 6, boxY + boxH);
        ctx.closePath();
        ctx.fillStyle = '#111827';
        ctx.fill();

        ctx.fillStyle = '#111827';
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f9fafb';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2 + 0.5);
        ctx.restore();
      }
    }

    const _isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;

    if (!this.isMouseOver) {
      if (!_isTouchDevice && this.onCrosshairOHLC && this._lastCrosshairOHLCIdx !== -1) {
        this._lastCrosshairOHLCIdx = -1;
        this.onCrosshairOHLC(null);
      }
      return;
    }

    // X축(세로선)은 메인 캔들 패널에서만 자석 스냅.
    // 단, 드로잉 중 자석이 OFF면 자유 이동(비스냅) 유지.
    let snapX = this.mouseX;
    let snappedCandleIndex = -1;
    const isInMainPanelForMagnet = this.mouseY >= R.top && this.mouseY <= mainH;
    const allowCrosshairXSnap = this.drawingMagnetMode !== 'off';
    if (allowCrosshairXSnap && isInMainPanelForMagnet && this.mouseX >= chartLeft && this.mouseX <= chartRight) {
      const nearestIndex = Math.round((this.mouseX - chartLeft - candleW / 2) / totalSp);
      const clampedIndex = Math.max(0, Math.min(visibleCount - 1, nearestIndex));
      snapX = chartLeft + clampedIndex * totalSp + candleW / 2;
      snappedCandleIndex = this.startIndex + clampedIndex;
    }

    const solidX = snapX;
    const selectedShape = this.getSelectedDrawing();
    const isTrendlineEditMode = !this.drawingTool && (
      (selectedShape?.kind === 'trendline') || this.trendlineTextEditorEl != null
    );
    const isChannelEditMode = !this.drawingTool && selectedShape?.kind === 'channel';
    const isPositionEditMode = !this.drawingTool && (
      selectedShape?.kind === 'long-position' || selectedShape?.kind === 'short-position'
    );
    const noDrawingInteraction = !this.drawingTool && !this.selectedDrawingId;
    const isDrawingEditMode = Boolean(this.drawingTool && this.drawingTool !== 'eraser');
    const shouldDrawCrosshairGuides = noDrawingInteraction || isTrendlineEditMode || isChannelEditMode || isPositionEditMode || isDrawingEditMode;

    if (shouldDrawCrosshairGuides) {
      const useBlueEditGuide = isDrawingEditMode || isChannelEditMode;
      const guideLineColor = useBlueEditGuide ? 'rgba(47,108,255,0.90)' : 'rgba(214,219,233,0.65)';
      const guideCenterColor = useBlueEditGuide ? 'rgba(47,108,255,0.98)' : 'rgba(255,255,255,0.92)';
      ctx.save();
      ctx.strokeStyle = guideLineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(solidX, 0); ctx.lineTo(solidX, height);
      ctx.moveTo(0, this.mouseY); ctx.lineTo(width, this.mouseY);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = guideCenterColor;
      ctx.lineWidth = 1.4;
      const centerLen = 10;
      ctx.beginPath();
      ctx.moveTo(solidX - centerLen, this.mouseY); ctx.lineTo(solidX + centerLen, this.mouseY);
      ctx.moveTo(solidX, this.mouseY - centerLen); ctx.lineTo(solidX, this.mouseY + centerLen);
      ctx.stroke();
      if (useBlueEditGuide) {
        // 드로잉 완료 전 중심 포인트 유지
        ctx.fillStyle = '#2f6cff';
        ctx.beginPath();
        ctx.arc(solidX, this.mouseY, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (noDrawingInteraction && snappedCandleIndex >= 0 && snappedCandleIndex < this.data.length) {
      const c = this.data[snappedCandleIndex];
      const label = formatCrosshairTimelineLabel(c.time, this.config.timezone);
      ctx.save();
      ctx.font = `12px ${CHART_FONT_STACK}`;
      const boxW = Math.ceil(ctx.measureText(label).width) + 16;
      const boxH = X_AXIS_HEIGHT;
      const boxX = Math.min(Math.max(chartLeft + 2, solidX - boxW / 2), chartRight - boxW - 2);
      const boxY = plotHeight;
      ctx.fillStyle = 'rgba(70,76,88,0.96)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2 + 0.5);
      ctx.restore();

      // OHLCV 툴팁: 모바일=canvas floating, PC=헤더 콜백
      if (noDrawingInteraction && _isTouchDevice && this.isMobileCrosshairTooltipEnabled()) {
        const isUp = c.close >= c.open;
        const closeColor = isUp ? '#ef5350' : '#26a69a';
        const tradingValue = c.close * c.volume;
        const d = symbolPriceDigits;
        const tooltipRows: Array<{ label: string; value: string; color: string }> = [
          { label: '시가', value: formatWithComma(c.open,  d), color: '#c9d4e8' },
          { label: '고가', value: formatWithComma(c.high,  d), color: '#ef5350' },
          { label: '저가', value: formatWithComma(c.low,   d), color: '#26a69a' },
          { label: '종가', value: formatWithComma(c.close, d), color: closeColor },
          { label: '거래량', value: formatKUnit(c.volume),        color: '#c9d4e8' },
          { label: '거래대금', value: formatKUnitWithComma(tradingValue), color: '#c9d4e8' },
        ];
        ctx.save();
        ctx.font = `600 11px ${CHART_FONT_STACK}`;
        const tPadX = 9, tPadY = 6, tLineH = 17;
        const tLabelW = 44;
        const tValueW = Math.max(...tooltipRows.map(r => Math.ceil(ctx.measureText(r.value).width))) + 4;
        const tBoxW = tPadX * 2 + tLabelW + tValueW + 6;
        const tHeaderH = tLineH;
        const tBoxH = tPadY * 2 + tHeaderH + tooltipRows.length * tLineH;
        const gap = 14;
        const fitsRight = solidX + gap + tBoxW <= chartRight - 2;
        const tBoxX = fitsRight ? solidX + gap : solidX - gap - tBoxW;
        const tBoxY = Math.max(R.top + 2, Math.min(this.mouseY - tBoxH / 2, mainH - tBoxH - 4));
        const tRadius = 5;
        ctx.beginPath();
        ctx.moveTo(tBoxX + tRadius, tBoxY);
        ctx.lineTo(tBoxX + tBoxW - tRadius, tBoxY);
        ctx.arcTo(tBoxX + tBoxW, tBoxY, tBoxX + tBoxW, tBoxY + tRadius, tRadius);
        ctx.lineTo(tBoxX + tBoxW, tBoxY + tBoxH - tRadius);
        ctx.arcTo(tBoxX + tBoxW, tBoxY + tBoxH, tBoxX + tBoxW - tRadius, tBoxY + tBoxH, tRadius);
        ctx.lineTo(tBoxX + tRadius, tBoxY + tBoxH);
        ctx.arcTo(tBoxX, tBoxY + tBoxH, tBoxX, tBoxY + tBoxH - tRadius, tRadius);
        ctx.lineTo(tBoxX, tBoxY + tRadius);
        ctx.arcTo(tBoxX, tBoxY, tBoxX + tRadius, tBoxY, tRadius);
        ctx.closePath();
        ctx.fillStyle = 'rgba(15, 20, 32, 0.75)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 80, 110, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textBaseline = 'middle';
        ctx.font = `600 11px ${CHART_FONT_STACK}`;
        ctx.fillStyle = '#7a8aab';
        ctx.textAlign = 'left';
        ctx.fillText(label, tBoxX + tPadX, tBoxY + tPadY + tLineH / 2);
        ctx.strokeStyle = 'rgba(60, 80, 110, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tBoxX + 4, tBoxY + tPadY + tLineH + 2);
        ctx.lineTo(tBoxX + tBoxW - 4, tBoxY + tPadY + tLineH + 2);
        ctx.stroke();
        tooltipRows.forEach((row, i) => {
          const rowY = tBoxY + tPadY + tHeaderH + i * tLineH + tLineH / 2;
          ctx.font = `600 11px ${CHART_FONT_STACK}`;
          ctx.fillStyle = '#4e5d78';
          ctx.textAlign = 'left';
          ctx.fillText(row.label, tBoxX + tPadX, rowY);
          ctx.fillStyle = row.color;
          ctx.textAlign = 'right';
          ctx.fillText(row.value, tBoxX + tBoxW - tPadX, rowY);
        });
        ctx.restore();
      } else if (noDrawingInteraction && this.onCrosshairOHLC && this._lastCrosshairOHLCIdx !== snappedCandleIndex) {
        this._lastCrosshairOHLCIdx = snappedCandleIndex;
        this.onCrosshairOHLC({ open: c.open, high: c.high, low: c.low, close: c.close, time: c.time });
      }
    }

    if (this.mouseY < mainH && mainScale && noDrawingInteraction) {
      const lo = mainScale.lo;
      const hi = mainScale.hi;
      const price = hi - (this.mouseY - R.top) / (mainH - R.top || 1) * (hi - lo);
      ctx.fillStyle = '#2a2e39';
      const priceBoxW = geometry.side === 'left'
        ? Math.max(20, geometry.axisPad - 10)
        : Math.max(20, geometry.axisPad - 2);
      const priceBoxX = geometry.side === 'left' ? 6 : chartRight;
      drawPriceArrowBox(ctx, priceBoxX, this.mouseY, priceBoxW, 20, geometry.side);
      ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
      ctx.stroke();
      const crossTextAnchor = getPriceArrowTextAnchor(priceBoxX, priceBoxW, geometry.side, 5);
      ctx.fillStyle = CHART_TEXT_PRIMARY; ctx.font = `600 13px ${CHART_FONT_STACK}`; ctx.textAlign = crossTextAnchor.align;
      ctx.fillText(formatWithComma(price, symbolPriceDigits), crossTextAnchor.x, this.mouseY + 4);

      // 가격박스 왼쪽 원형 + 아이콘 (클릭 시 수평선 생성)
      const plusR  = 9;
      const plusX  = geometry.side === 'left'
        ? (geometry.axisRight + plusR + 4)
        : (geometry.axisLeft - plusR - 4);
      const plusY  = this.mouseY;
      const hovered = this.crosshairPlusHovered;
      ctx.save();
      ctx.beginPath();
      ctx.arc(plusX, plusY, plusR, 0, Math.PI * 2);
      ctx.fillStyle = hovered ? '#2962ff' : 'rgba(41,98,255,0.75)';
      ctx.fill();
      ctx.strokeStyle = hovered ? '#6fa3ff' : 'rgba(130,170,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(plusX - 4.5, plusY); ctx.lineTo(plusX + 4.5, plusY);
      ctx.moveTo(plusX, plusY - 4.5); ctx.lineTo(plusX, plusY + 4.5);
      ctx.stroke();
      ctx.restore();
      // 히트 반경: 아이콘 직경 수준으로 확장 (plusR*2 = 18px + 여유 4px = 22px)
      this.crosshairPlusHit = { x: plusX, y: plusY, r: plusR * 2 + 4, price };
    } else {
      this.crosshairPlusHit = null;
    }

    // 보조지표 패널 크로스헤어: 좌측 Y축 수치 박스
    if (this.mouseY >= mainH && this.mouseY <= plotHeight) {
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

        let lo = 0;
        let hi = 100;
        let accentColor = '#7aa2ff';
        let labelText = '';
        const ind = this.config.indicators as any;
        const visStart = this.startIndex;
        const visEnd = this.endIndex;

        if (hoveredPanelId === 'volume') {
          const vis = this.data.slice(visStart, visEnd);
          const vMax = Math.max(...vis.map((d) => d.volume), 1);
          const vScaleMax = Math.max(1, vMax * 1.14);
          lo = 0;
          hi = vScaleMax;
          accentColor = '#22ab94';
        } else if (hoveredPanelId === 'rsi') {
          lo = 0; hi = 100;
          accentColor = this.resolveStyle('rsi', '#ffeb3b').color;
        } else if (hoveredPanelId === 'dmi') {
          const dmiD = this.calcDMI(ind.dmi.period);
          const topThreshold = Number.isFinite(Number(ind.dmi.topThreshold)) ? Number(ind.dmi.topThreshold) : 30;
          const bottomThreshold = Number.isFinite(Number(ind.dmi.bottomThreshold)) ? Number(ind.dmi.bottomThreshold) : 20;
          const axisMode = ind.dmi.axisMode === 'fixed' ? 'fixed' : 'auto';
          let dmiLo = 0;
          let dmiHi = 60;
          if (axisMode === 'auto') {
            const values = [
              ...dmiD.plusDI.slice(visStart, visEnd).filter((v): v is number => v != null && Number.isFinite(v)),
              ...dmiD.minusDI.slice(visStart, visEnd).filter((v): v is number => v != null && Number.isFinite(v)),
              ...dmiD.adx.slice(visStart, visEnd).filter((v): v is number => v != null && Number.isFinite(v)),
            ];
            let loTarget = values.length ? Math.min(...values) : 0;
            let hiTarget = values.length ? Math.max(...values) : 60;
            const pad = Math.max(4, (hiTarget - loTarget) * 0.12);
            loTarget = Math.max(0, loTarget - pad);
            hiTarget = Math.min(100, hiTarget + pad);
            loTarget = Math.min(loTarget, 23);
            hiTarget = Math.max(hiTarget, 27);
            if (hiTarget - loTarget < 20) {
              const center = (hiTarget + loTarget) / 2;
              loTarget = Math.max(0, center - 10);
              hiTarget = Math.min(100, center + 10);
            }
            if (this.dmiScaleRange) {
              dmiLo = this.dmiScaleRange.lo;
              dmiHi = this.dmiScaleRange.hi;
            } else {
              dmiLo = loTarget;
              dmiHi = hiTarget;
            }
          }
          const snapUnit = Math.abs(dmiHi - dmiLo) >= 80 ? 10 : 5;
          dmiLo = Math.max(0, Math.floor(dmiLo / snapUnit) * snapUnit);
          dmiHi = Math.min(100, Math.ceil(dmiHi / snapUnit) * snapUnit);
          if (dmiHi - dmiLo < snapUnit * 2) dmiHi = Math.min(100, dmiLo + snapUnit * 2);
          lo = Math.min(dmiLo, bottomThreshold);
          hi = Math.max(dmiHi, topThreshold);
          accentColor = this.resolveStyle('dmiAdx', '#ffffff').color;
        } else if (hoveredPanelId === 'macd') {
          const macdD = this.calcMACD(ind.macd.fast, ind.macd.slow, ind.macd.signal);
          const vals = [
            ...macdD.hist.slice(visStart, visEnd).filter((v): v is number => v != null),
            ...macdD.macdLine.slice(visStart, visEnd).filter((v): v is number => v != null),
            ...macdD.sigLine.slice(visStart, visEnd).filter((v): v is number => v != null),
          ];
          const mMaxBase = Math.max(...vals.map((v) => Math.abs(v)), 0.001);
          const mMax = mMaxBase * 1.4;
          lo = -mMax;
          hi = mMax;
          accentColor = this.resolveStyle('macdLine', '#2962ff').color;
        } else if (hoveredPanelId === 'stochF' || hoveredPanelId === 'stochS') {
          lo = 0; hi = 100;
          accentColor = hoveredPanelId === 'stochF'
            ? this.resolveStyle('stochFastK', '#22ab94').color
            : this.resolveStyle('stochSlowK', '#22ab94').color;
        } else if (hoveredPanelId === 'cci') {
          const cciD = this.calcCCI(ind.cci.period);
          const vis = cciD.slice(visStart, visEnd).filter((v): v is number => v != null);
          const cMax = Math.max(...vis.map((v) => Math.abs(v)), 100);
          lo = -cMax;
          hi = cMax;
          accentColor = this.resolveStyle('cci', '#22ab94').color;
        } else if (hoveredPanelId === 'obv') {
          const obvD = this.calcOBV();
          const obvSignal9 = this.sma(obvD.map((v) => v as number | null), 9);
          const rangeValues = [
            ...obvD.slice(visStart, visEnd).filter((v): v is number => v != null),
            ...obvSignal9.slice(visStart, visEnd).filter((v): v is number => v != null),
          ];
          let obvLo = Math.min(...rangeValues, 0);
          let obvHi = Math.max(...rangeValues, 1);
          if (obvLo === obvHi) obvHi = obvLo + 1;
          const pad = Math.max((obvHi - obvLo) * 0.18, 1);
          lo = obvLo - pad;
          hi = obvHi + pad;
          accentColor = this.resolveStyle('obv', '#22ab94').color;
        }

        const clampedY = Math.max(plotTop, Math.min(plotTop + plotH, this.mouseY));
        const value = hi - ((clampedY - plotTop) / (plotH || 1)) * (hi - lo);
        if (hoveredPanelId === 'volume') {
          labelText = formatKUnit(value, 1);
        } else {
          labelText = value.toFixed(2);
          if (hoveredPanelId === 'macd' || hoveredPanelId === 'cci' || hoveredPanelId === 'obv') {
            accentColor = value >= 0 ? '#22ab94' : '#f23645';
          }
        }

        ctx.save();
        ctx.font = `600 12px ${CHART_FONT_STACK}`;
        const boxW = Math.ceil(ctx.measureText(labelText).width) + 12;
        const boxH = 18;
        const boxX = width - boxW - 2;
        const boxY = Math.max(panelTop + 2, Math.min(panelTop + panelHeight - boxH - 2, clampedY - boxH / 2));
        const plusR = 9;
        const plusCx = boxX - 4 - plusR;
        const plusCy = boxY + boxH / 2;

        ctx.fillStyle = toRgba(accentColor, 0.28, 'rgba(80,90,110,0.28)');
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, boxX + boxW / 2, boxY + boxH / 2 + 0.5);

        ctx.beginPath();
        ctx.fillStyle = 'rgba(14,20,31,0.96)';
        ctx.strokeStyle = toRgba(accentColor, 0.95, '#7aa2ff');
        ctx.lineWidth = 1.2;
        ctx.arc(plusCx, plusCy, plusR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#f2f6ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(plusCx - 3.2, plusCy);
        ctx.lineTo(plusCx + 3.2, plusCy);
        ctx.moveTo(plusCx, plusCy - 3.2);
        ctx.lineTo(plusCx, plusCy + 3.2);
        ctx.stroke();
        ctx.restore();

        this.hoveredSubIndicatorAddButton = {
          panelId: hoveredPanelId,
          value,
          color: accentColor,
          x: plusCx,
          y: plusCy,
          r: plusR,
        };
      }
    }

    // 시그널 아이콘 호버: 진입가격 툴팁
    // Fallback: even without precise hit, show signal info when X-axis aligns with a signal candle.
    let hoverSignal: (typeof this.signalHitAreas)[number] | null = null;
    let minDistSq = Number.POSITIVE_INFINITY;
    for (const area of this.signalHitAreas) {
      const dx = this.mouseX - area.x;
      const dy = this.mouseY - area.y;
      const distSq = dx * dx + dy * dy;
      const hitR = area.r + 6;
      if (distSq <= hitR * hitR && distSq < minDistSq) {
        minDistSq = distSq;
        hoverSignal = area;
      }
    }

    if (!hoverSignal && this.focusedSignalCandleIndex != null) {
      hoverSignal = this.signalHitAreas.find((area) => area.candleIndex === this.focusedSignalCandleIndex) ?? null;
    }

    if (!hoverSignal) {
      const axisCandleIndex = (() => {
        if (this.mouseX < chartLeft || this.mouseX > chartRight) return -1;
        const nearestIndex = Math.round((this.mouseX - chartLeft - candleW / 2) / totalSp);
        const clampedIndex = Math.max(0, Math.min(visibleCount - 1, nearestIndex));
        return this.startIndex + clampedIndex;
      })();

      if (axisCandleIndex >= 0) {
        hoverSignal = this.signalHitAreas.find((area) => area.candleIndex === axisCandleIndex) ?? null;
      }
    }

    if (hoverSignal) {
      const sideText = hoverSignal.signal > 0 ? 'LONG' : 'SHORT';
      const priceText = `진입가 ${formatWithComma(hoverSignal.entryPrice, symbolPriceDigits)}`;
      const text = `${sideText} · ${priceText}`;
      ctx.font = `12px ${CHART_FONT_STACK}`;
      const textWidth = Math.ceil(ctx.measureText(text).width);
      const boxW = textWidth + 16;
      const boxH = 24;
      const boxX = Math.min(
        Math.max(chartLeft + 8, hoverSignal.x + 12),
        chartRight - boxW - 4,
      );
      const boxY = Math.max(8, hoverSignal.y - boxH - 8);

      ctx.save();
      if (mainScale) {
        const entryY = mainScale.toY(hoverSignal.entryPrice);
        if (entryY >= R.top && entryY <= mainH) {
          const lineColor = hoverSignal.signal > 0 ? '#2ecc71' : '#ff5252';
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(chartLeft, entryY);
          ctx.lineTo(chartRight, entryY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = lineColor;
          const entryBoxW = geometry.side === 'left'
            ? Math.max(20, geometry.axisPad - 10)
            : Math.max(20, geometry.axisPad - 4);
          const entryBoxX = geometry.side === 'left' ? 6 : (width - entryBoxW - 2);
          ctx.fillRect(entryBoxX, entryY - 10, entryBoxW, 20);
          ctx.fillStyle = getContrastTextColor(lineColor);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            formatWithComma(hoverSignal.entryPrice, symbolPriceDigits),
            entryBoxX + (entryBoxW / 2),
            entryY,
          );
        }
      }

      ctx.beginPath();
      ctx.strokeStyle = hoverSignal.signal > 0 ? '#2ecc71' : '#ff5252';
      ctx.lineWidth = 1.5;
      ctx.arc(hoverSignal.x, hoverSignal.y, hoverSignal.r + 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(19,23,34,0.96)';
      ctx.strokeStyle = '#4a5060';
      ctx.lineWidth = 1;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#f2f4f8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, boxX + 8, boxY + boxH / 2);
      ctx.restore();
    }

    const hoveredTrendline = this.hoveredDrawingId
      ? this.drawings.find((shape) => shape.id === this.hoveredDrawingId && shape.kind === 'trendline')
      : null;
    if (hoveredTrendline && this.isMouseOver) {
      this.requestOverlayDraw();
    }
  }

  // 마우스/휠 이벤트 핸들러

  private isHoveringCandle(mx: number, my: number): boolean {
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const plotHeight = Math.max(40, height - X_AXIS_HEIGHT);
    const geometry = this.getChartGeometry(width, this.lastDrawMeta?.axisPad);
    const R = { top: 10 };
    const panels = this.activePanels;
    const subRat = panels.reduce((s, id) => s + this.getPanelRatio(id), 0);
    const mainH = plotHeight * (1 - subRat);
    const chartW = geometry.chartWidth;
    if (mx < geometry.chartLeft || mx > geometry.chartRight || my < R.top || my > mainH) return false;

    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const gapBars = Math.min(Math.max(0, this.config.layout.rightGapBars ?? 0), 50 / Math.max(1, chartW / Math.max(1, this.endIndex - this.startIndex)));
    const totalSp = chartW / (visibleCount + gapBars);
    const candleW = Math.max(totalSp * 0.8, 1);
    const nearestIndex = Math.max(0, Math.min(visibleCount - 1, Math.round((mx - geometry.chartLeft - candleW / 2) / totalSp)));
    const candleIndex = this.startIndex + nearestIndex;
    const candle = this.data[candleIndex];
    if (!candle) return false;

    const visible = this.data.slice(this.startIndex, this.endIndex);
    if (!visible.length) return false;
    let lo = Infinity;
    let hi = -Infinity;
    visible.forEach((d) => {
      lo = Math.min(lo, d.low);
      hi = Math.max(hi, d.high);
    });
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const toY = (price: number) => R.top + (hi - price) / (hi - lo || 1) * (mainH - R.top);
    const yHigh = toY(candle.high);
    const yLow = toY(candle.low);
    const xCenter = geometry.chartLeft + nearestIndex * totalSp + candleW / 2;

    const xHit = Math.abs(mx - xCenter) <= Math.max(6, candleW * 0.7);
    const yHit = my >= yHigh - 5 && my <= yLow + 5;
    return xHit && yHit;
  }

  private updateChartCursor(): void {
    if (!this.isMouseOver) {
      this.canvas.style.cursor = 'default';
      return;
    }
    const selectedShape = this.getSelectedDrawing();
    const isTrendlineEditMode = !this.drawingTool && (
      (selectedShape?.kind === 'trendline') || this.trendlineTextEditorEl != null
    );
    if (isTrendlineEditMode) {
      this.canvas.style.cursor = 'none';
      return;
    }
    // 십자선 + 아이콘 위 → pointer
    if (this.crosshairPlusHit) {
      const { x: hx, y: hy, r: hr } = this.crosshairPlusHit;
      const dx = this.mouseX - hx;
      const dy = this.mouseY - hy;
      if (dx * dx + dy * dy <= hr * hr) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }
    const hitDrawing = this.findDrawingAt(this.mouseX, this.mouseY);
    if (this.drawingTool) {
      if (this.drawingTool === 'eraser') {
        this.canvas.style.cursor = ERASER_CURSOR;
        return;
      }
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    if (this.isDragging) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (this.drawingMoveState) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    const hitSubAlert = this.findSubIndicatorAlertHit(this.mouseX, this.mouseY);
    if (hitSubAlert) {
      this.canvas.style.cursor = 'pointer';
      return;
    }
    if (hitDrawing && hitDrawing.shape.kind === 'trendline') {
      this.canvas.style.cursor = 'none';
      return;
    }
    if (hitDrawing) {
      this.canvas.style.cursor = 'pointer';
      return;
    }
    if (this.isHoveringCandle(this.mouseX, this.mouseY)) {
      this.canvas.style.cursor = 'pointer';
      return;
    }
    this.canvas.style.cursor = 'none';
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const shift = Math.floor(e.deltaX / 5);
      const visibleCount = Math.max(1, this.endIndex - this.startIndex);
      const nextStart = this.normalizeHorizontalVirtualStart(this.startIndex + shift, this.startIndex);
      const ns = this.clampPanStartIndex(nextStart, visibleCount);
      this.startIndex = ns;
      this.endIndex = ns + visibleCount;
    } else {
      // 최신 캔들(오른쪽 끝)을 확대/축소 기준(anchor)으로 고정
      const minVisible = 5;
      const maxVisible = this.data.length;
      const currentVisible = Math.max(minVisible, this.endIndex - this.startIndex);
      // Dynamic acceleration: when many candles are visible, zoom faster.
      const zoomStep = Math.max(8, Math.min(64, Math.round(currentVisible * 0.06)));
      const zoomOut = e.deltaY > 0;
      const nextVisible = zoomOut
        ? Math.min(maxVisible, currentVisible + zoomStep)   // 아래 스크롤: 축소(더 많은 캔들)
        : Math.max(minVisible, currentVisible - zoomStep);  // 위 스크롤: 확대(더 적은 캔들)

      this.endIndex = this.data.length;
      this.startIndex = Math.max(0, this.endIndex - nextVisible);
    }
    this.draw();
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.isMouseOver = true;

    // 십자선 + 아이콘 클릭 → 수평선(hline) 생성
    // stale crosshairPlusHovered 의존하지 않고 클릭 시점 좌표로 직접 재계산
    if (this.crosshairPlusHit) {
      const { x: hx, y: hy, r: hr, price } = this.crosshairPlusHit;
      const dx = this.mouseX - hx;
      const dy = this.mouseY - hy;
      if (dx * dx + dy * dy <= hr * hr) {
        const anchor = this.getMouseAnchor(this.mouseX, this.mouseY);
        const hline: DrawingShape = {
          id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'hline',
          a: { index: anchor?.index ?? this.startIndex, price },
          color: '#2962ff',
          width: HLINE_DEFAULT_WIDTH,
          lineStyle: 'solid',
        };
        this.drawings.push(hline);
        // 선택 해제 상태 유지 → 연속 생성 가능
        this.selectedDrawingId = null;
        this.selectedDrawingPart = 'line';
        this.drawingMoveState = null;
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        e.preventDefault();
        return;
      }
    }

    const hitSubAlert = this.findSubIndicatorAlertHit(this.mouseX, this.mouseY);
    if (hitSubAlert) {
      const alert = this.subIndicatorAlerts.find((a) => a.id === hitSubAlert.id);
      if (alert) {
        this.openSubIndicatorAlertEditPopup(alert, {
          panelTop: hitSubAlert.panelTop,
          panelHeight: hitSubAlert.panelHeight,
        });
      }
      return;
    }

    if (this.hoveredSubIndicatorAddButton) {
      const dx = this.mouseX - this.hoveredSubIndicatorAddButton.x;
      const dy = this.mouseY - this.hoveredSubIndicatorAddButton.y;
      const hitRadius = this.hoveredSubIndicatorAddButton.r + 4;
      const hit = dx * dx + dy * dy <= hitRadius * hitRadius;
      if (hit) {
        this.openSubIndicatorAlertPopup(
          this.hoveredSubIndicatorAddButton.x,
          this.hoveredSubIndicatorAddButton.y,
          {
            panelId: this.hoveredSubIndicatorAddButton.panelId,
            value: this.hoveredSubIndicatorAddButton.value,
            color: this.hoveredSubIndicatorAddButton.color,
          },
        );
        return;
      }
    }

    if (this.subIndicatorAlertPopupEl) {
      this.closeSubIndicatorAlertPopup();
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
        const snappedAnchor: DrawingAnchor = { index: Math.round(shiftAnchor.index), price: shiftAnchor.price };
        if (!this.drawingDraft || this.drawingDraft.kind !== 'measure') {
          this.drawingDraft = {
            kind: 'measure',
            a: snappedAnchor,
            b: snappedAnchor,
          };
          this.drawingDragActive = true;
          this.requestOverlayDraw();
          return;
        }
        this.drawingDraft.b = snappedAnchor;
        const a = this.drawingDraft.a;
        const b = this.drawingDraft.b;
        const moved = Math.abs(a.index - b.index) > 0.2
          || Math.abs(a.price - b.price) > Math.max(1e-6, (this.lastDrawMeta?.maxP ?? 1) * 0.0005);
        if (moved) {
          const created: DrawingShape = {
            id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: 'measure',
            a,
            b,
            color: '#2f6cff',
            width: 1.5,
            lineStyle: 'solid',
          };
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
    const hoveredGuideTrendline = (
      !this.drawingTool
      && this.hoveredDrawingPart === 'trendline-text-guide'
      && this.hoveredDrawingId
    )
      ? this.drawings.find((shape) => shape.id === this.hoveredDrawingId && shape.kind === 'trendline')
      : null;
    if (
      hoveredGuideTrendline
      && (!hitDrawing || (hitDrawing.shape.kind === 'trendline' && hitDrawing.shape.id === hoveredGuideTrendline.id))
    ) {
      this.selectedDrawingId = hoveredGuideTrendline.id;
      this.selectedDrawingPart = 'trendline-text-guide';
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openTrendlineTextEditor(hoveredGuideTrendline);
      this.updateChartCursor();
      return;
    }
    if (
      !this.drawingTool
      && hitDrawing
      && hitDrawing.shape.kind === 'trendline'
      && hitDrawing.part === 'trendline-text-guide'
    ) {
      this.selectedDrawingId = hitDrawing.shape.id;
      this.selectedDrawingPart = 'trendline-text-guide';
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openTrendlineTextEditor(hitDrawing.shape);
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
      this.drawings = this.drawings.filter((shape) => shape.id !== hitDrawing.shape.id);
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
        this.drawings = this.drawings.filter((shape) => shape.kind !== 'measure');
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
      this.selectedDrawingId = hitDrawing.shape.id;
      this.selectedDrawingPart = hitDrawing.part;
      this.drawingMoveState = hitDrawing.shape.locked
        ? null
        : {
            startX: this.mouseX,
            startY: this.mouseY,
            baseShape: this.cloneShape(hitDrawing.shape),
          };
      this.isDragging = false;
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      this.updateChartCursor();
      return;
    }

    const anchor = this.getMouseAnchor(this.mouseX, this.mouseY);
    if (this.drawingTool && anchor) {
      if (this.drawingTool === 'measure') {
        const snappedAnchor: DrawingAnchor = { index: Math.round(anchor.index), price: anchor.price };
        if (!this.drawingDraft || this.drawingDraft.kind !== 'measure') {
          this.drawingDraft = {
            kind: 'measure',
            a: snappedAnchor,
            b: snappedAnchor,
          };
          this.drawingDragActive = true;
          this.requestOverlayDraw();
          return;
        }
        this.drawingDraft.b = snappedAnchor;
        const a = this.drawingDraft.a;
        const b = this.drawingDraft.b;
        const moved = Math.abs(a.index - b.index) > 0.2
          || Math.abs(a.price - b.price) > Math.max(1e-6, (this.lastDrawMeta?.maxP ?? 1) * 0.0005);
        if (moved) {
          const created: DrawingShape = {
            id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: 'measure',
            a,
            b,
            color: '#2f6cff',
            width: 1.5,
            lineStyle: 'solid',
          };
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
        const stopPrice   = isLong ? (snappedAnchor.price - defaultRisk) : (snappedAnchor.price + defaultRisk);
        const targetPrice = isLong ? (snappedAnchor.price + defaultRisk) : (snappedAnchor.price - defaultRisk);

        const created: DrawingShape = {
          id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: this.drawingTool,
          a: { index: snappedAnchor.index, price: snappedAnchor.price },
          b: { index: snappedAnchor.index, price: stopPrice },
          channelOffset: { index: defaultBars, price: targetPrice - snappedAnchor.price },
          color: '#2f6cff', width: 2, lineStyle: 'solid',
          alert: { enabled: false, mode: 'up', target: 'trendline', appPush: false, onsite: true, sound: false },
        };
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'position-target';
        this.syncDrawingToolbar();
        this.drawingDraft = null;
        this.setDrawingTool(null);
        this.showPositionGuide(1, isLong ? 'long-position' : 'short-position');
        this.requestOverlayDraw();
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
          const offset = {
            index: anchor.index - baseA.index,
            price: anchor.price - baseA.price,
          };
          const moved = Math.abs(baseA.index - baseB.index) > 0.2 || Math.abs(baseA.price - baseB.price) > Math.max(1e-6, (this.lastDrawMeta?.maxP ?? 1) * 0.0005);
          if (moved) {
            const created: DrawingShape = {
              id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              kind: 'fib-trend',
              a: baseA,
              b: baseB,
              channelOffset: offset,
              color: '#2f6cff',
              width: 2,
              lineStyle: 'solid',
              alert: {
                enabled: false,
                mode: 'up',
                target: 'trendline',
                appPush: false,
                onsite: true,
                sound: false,
              },
            };
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
        const created: DrawingShape = {
          id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'hline',
          a: anchor,
          color: '#2f6cff',
          width: HLINE_DEFAULT_WIDTH,
          lineStyle: 'solid',
        };
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'line';
        this.syncDrawingToolbar();
        this.requestOverlayDraw();
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        return;
      }
      if (this.drawingTool === 'text-note') {
        const text = window.prompt('텍스트를 입력하세요', '메모');
        if (text && text.trim()) {
          const created: DrawingShape = {
            id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: 'text-note',
            a: anchor,
            text: text.trim(),
            color: '#2f6cff',
            width: 2,
            lineStyle: 'solid',
          };
          this.upsertDrawing(created);
          this.selectedDrawingId = created.id;
          this.selectedDrawingPart = 'body';
          this.syncDrawingToolbar();
          this.requestOverlayDraw();
          if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        }
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
    const hitDrawing = this.findDrawingAt(mx, my);
    if (hitDrawing && hitDrawing.shape.kind === 'trendline') {
      this.selectedDrawingId = hitDrawing.shape.id;
      this.selectedDrawingPart = hitDrawing.part === 'start' || hitDrawing.part === 'end' ? 'body' : hitDrawing.part;
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.openTrendlineTextEditor(hitDrawing.shape);
      this.updateChartCursor();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left; this.mouseY = e.clientY - rect.top;
    this.isMouseOver = true;
    const hoveredDrawing = this.findDrawingAt(this.mouseX, this.mouseY);
    this.hoveredDrawingId = hoveredDrawing?.shape.id ?? null;
    this.hoveredDrawingPart = hoveredDrawing?.part ?? null;

    // + 아이콘 hover 감지
    if (this.crosshairPlusHit) {
      const dx = this.mouseX - this.crosshairPlusHit.x;
      const dy = this.mouseY - this.crosshairPlusHit.y;
      const wasHovered = this.crosshairPlusHovered;
      this.crosshairPlusHovered = dx * dx + dy * dy <= this.crosshairPlusHit.r * this.crosshairPlusHit.r;
      if (this.crosshairPlusHovered !== wasHovered) this.requestOverlayDraw();
    } else {
      this.crosshairPlusHovered = false;
    }

    this.updateChartCursor();
    if (this.drawingMoveState && this.selectedDrawingId) {
      const dx = this.mouseX - this.drawingMoveState.startX;
      const dy = this.mouseY - this.drawingMoveState.startY;
      const moved = this.moveShapeByDelta(this.drawingMoveState.baseShape, dx, dy, this.selectedDrawingPart);
      this.upsertDrawing(moved);
      this.syncDrawingToolbar();
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
        if (this.drawingDraft.kind === 'measure') {
          this.drawingDraft.b = { index: Math.round(anchor.index), price: anchor.price };
        } else {
          this.drawingDraft.b = anchor;
        }
      }
      this.requestOverlayDraw();
      return;
    }
    this.requestOverlayDraw();
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    const visibleCount = Math.max(1, this.endIndex - this.startIndex);
    const chartW = this.viewportWidth - this.config.layout.rightPadding;
    const cpw = chartW / (visibleCount + Math.max(0, this.config.layout.rightGapBars ?? 0));
    let changed = false;
    if (cpw > 0) {
      const shift = Math.floor(dx / cpw) * -1;
      const baseVirtualStart = this.dragStartIndex - this.dragStartLeftPanBars;
      const virtualStart = this.normalizeHorizontalVirtualStart(baseVirtualStart + shift, baseVirtualStart);
      if (this.applyHorizontalPan(virtualStart, visibleCount)) changed = true;
    }
    if (this.isVerticalPanEnabled()) {
      const pricePerPixel = this.getMainPricePerPixel();
      const nextPriceOffset = this.dragStartPriceOffset + dy * pricePerPixel;
      if (Number.isFinite(nextPriceOffset) && Math.abs(nextPriceOffset - this.mainPricePanOffset) > 1e-12) {
        this.mainPricePanOffset = nextPriceOffset;
        changed = true;
      }
    }
    if (changed) {
      this.draw();
    }
  }

  private handleMouseUp() {
    if (this.drawingMoveState) {
      if (this.pendingChannelId && this.selectedDrawingId === this.pendingChannelId && this.selectedDrawingPart === 'channel-offset') {
        this.pendingChannelId = null;
        this.setDrawingTool(null);
      }
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      this.updateChartCursor();
      return;
    }
    if (this.drawingDragActive && this.drawingDraft) {
      if (this.drawingDraft.kind === 'measure') {
        this.requestOverlayDraw();
        this.updateChartCursor();
        return;
      }
      const a = this.drawingDraft.a;
      const b = this.drawingDraft.b;
      const moved = Math.abs(a.index - b.index) > 0.2 || Math.abs(a.price - b.price) > Math.max(1e-6, (this.lastDrawMeta?.maxP ?? 1) * 0.0005);
      if (moved) {
        const created: DrawingShape = {
          id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: this.drawingDraft.kind,
          a,
          b,
          color: '#2f6cff',
          width: 2,
          lineStyle: 'solid',
          alert: {
            enabled: false,
            mode: 'up',
            target: 'trendline',
            appPush: false,
            onsite: true,
            sound: false,
          },
        };
        if (created.kind === 'channel') {
          created.channelOffset = this.getDefaultChannelOffset(a, b);
        }
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = created.kind === 'channel' ? 'channel-offset' : 'line';
        this.pendingChannelId = null;
        if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
        this.syncDrawingToolbar();
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

    const a = this.drawingDraft.a;
    const b = this.drawingDraft.b;
    
    // 포인트가 유의미한 거리에 있는지 확인
    const moved = Math.abs(a.index - (b?.index ?? a.index)) > 0.2 
      || Math.abs(a.price - (b?.price ?? a.price)) > Math.max(1e-6, (this.lastDrawMeta?.maxP ?? 1) * 0.0005);
    
    if (moved) {
      const created: DrawingShape = {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: this.drawingDraft.kind,
        a: this.drawingDraft.a,
        b: this.drawingDraft.b,
        color: '#2f6cff',
        width: 2,
        lineStyle: 'solid',
        alert: {
          enabled: false,
          mode: 'up',
          target: 'trendline',
          appPush: false,
          onsite: true,
          sound: false,
        },
      };
      
      // 채널은 기울기 방향 기준 기본 간격 오프셋을 자동 적용
      if (created.kind === 'channel') {
        created.channelOffset = this.getDefaultChannelOffset(created.a, created.b ?? created.a);
      }
      // 피보나치 추세의 경우 채널 오프셋 추가
      if (created.kind === 'fib-trend' && this.drawingDraft.channelOffset) {
        created.channelOffset = this.drawingDraft.channelOffset;
      }
      
      this.upsertDrawing(created);
      this.selectedDrawingId = created.id;
      this.selectedDrawingPart = created.kind === 'channel' ? 'channel-offset' : 'line';
      this.pendingChannelId = null;
      if (this.shouldAutoDisarmAfterCreate(created.kind)) this.setDrawingTool(null);
      
      this.syncDrawingToolbar();
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
    }
    this.crosshairAutoHideTimer = setTimeout(() => {
      this.crosshairAutoHideTimer = null;
      this.exitCrosshairMode();
    }, SimpleChart.CROSSHAIR_AUTO_HIDE_MS);
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
      this.touchStartX = pos.x;
      this.touchStartY = pos.y;

      // ??????????????????????????????????????????????????????????????????
      // ? 기존 드로잉 선택: 드래그해서 편집 가능
      // ??????????????????????????????????????????????????????????????????
      const hitDrawing = this.findDrawingAt(pos.x, pos.y);
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
      if (!this.drawingTool && hitDrawing && hitDrawing.shape.kind === 'trendline' && hitDrawing.part === 'trendline-text-guide') {
        this.selectedDrawingId = hitDrawing.shape.id;
        this.selectedDrawingPart = 'trendline-text-guide';
        this.drawingMoveState = null;
        this.syncDrawingToolbar();
        this.openTrendlineTextEditor(hitDrawing.shape);
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
      if (hitDrawing && !hitDrawing.shape.locked) {
        this.selectedDrawingId = hitDrawing.shape.id;
        this.selectedDrawingPart = hitDrawing.part;
        this.drawingMoveState = {
          startX: pos.x,
          startY: pos.y,
          baseShape: this.cloneShape(hitDrawing.shape),
        };
        if (hitDrawing.shape.kind === 'trendline') {
          this.cancelLongPress();
          const capturedPos = { x: pos.x, y: pos.y };
          this.longPressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
            const dup: DrawingShape = {
              ...this.cloneShape(hitDrawing.shape),
              id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            };
            this.drawings.push(dup);
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
        this.clearDrawingSelection();
        // Mobile UX: tapping outside while editing should finish editing
        // instead of immediately falling through to a new drawing flow.
        this.setDrawingTool(null);
        this.updateChartCursor();
        return;
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
        // 기본 열십자 즉시 해제
        if (this.isCrosshairMode) this.exitCrosshairMode();

        // ── Position: 십자선 이동만, 박스생성은 touchEnd ──────────────────
        if (this.drawingTool === 'long-position' || this.drawingTool === 'short-position') {
          this.requestOverlayDraw();
          return;
        }

        // ── fib-trend: 십자선 이동만, 앵커 확정은 touchEnd ─────────────────
        if (this.drawingTool === 'fib-trend') {
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

      // 이미 십자선 모드라면 → 터치 위치 업데이트 (이동 가능), 탭이면 해제
      if (this.isCrosshairMode) {
        // 십자선 이동: 터치 위치로 업데이트
        this.touchCrosshairX = pos.x;
        this.touchCrosshairY = pos.y;
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        this.isMouseOver = true;
        // 이동 중에는 자동 숨김 타이머 재시작
        this.crosshair_reset_auto_hide();
        this.requestOverlayDraw();
        this.isTouchPanning = false;
        this.isTouchPinching = false;
        return;
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
    }
  }


  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();

    if (this.isTouchPinching && e.touches.length === 2) {
      // ── 핀치 줌 ──────────────────────────────────────────────────────
      const newDist = this.getTouchDist(e.touches);
      if (this.touchPinchDist === 0) return;
      const scale      = this.touchPinchDist / newDist;
      const nextVisible = Math.round(this.touchPinchStartVisible * scale);
      const clamped    = Math.max(5, Math.min(this.data.length, nextVisible));
      this.endIndex    = this.data.length;
      this.startIndex  = Math.max(0, this.endIndex - clamped);
      this.draw();
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const pos = this.touchPos(touch);

      // ????????????????????????????????????????????????????????????????????
      // ? 기존 드로잉 드래그: 터치로 앵커 이동
      // ????????????????????????????????????????????????????????????????????
      if (this.drawingMoveState && this.selectedDrawingId) {
        const dx = pos.x - this.drawingMoveState.startX;
        const dy = pos.y - this.drawingMoveState.startY;
        if (Math.sqrt(dx * dx + dy * dy) > SimpleChart.LONG_PRESS_MOVE_THRESHOLD) {
          this.cancelLongPress();
        }
        const moved = this.moveShapeByDelta(this.drawingMoveState.baseShape, dx, dy, this.selectedDrawingPart);
        this.upsertDrawing(moved);
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
            if (!this.drawingDragActive) {
              const dx2 = pos.x - this.touchStartX;
              const dy2 = pos.y - this.touchStartY;
              if (Math.sqrt(dx2 * dx2 + dy2 * dy2) > 4) this.drawingDragActive = true;
            }
            if (this.drawingDraft.kind === 'measure') {
              this.drawingDraft.b = { index: Math.round(anchor.index), price: anchor.price };
            } else if (this.drawingDraft.kind === 'channel' && !this.drawingDraft.b ||
                       (this.drawingDraft.b &&
                        (this.drawingDraft.b.index === this.drawingDraft.a.index ||
                         this.drawingDraft.b.price === this.drawingDraft.a.price))) {
              this.drawingDraft.b = anchor;
              this.fibTrendPointStage = 2;
            } else {
              this.drawingDraft.b = anchor;
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
        const dx = pos.x - this.touchStartX;
        const dy = pos.y - this.touchStartY;
        const visibleCount = Math.max(1, this.endIndex - this.startIndex);
        const chartW = this.viewportWidth - this.config.layout.rightPadding;
        const cpw    = chartW / (visibleCount + Math.max(0, this.config.layout.rightGapBars ?? 0));
        let changed = false;
        if (cpw > 0) {
          const shift = Math.floor(dx / cpw) * -1;
          const baseVirtualStart = this.touchStartIndex - this.touchStartLeftPanBars;
          const virtualStart = this.normalizeHorizontalVirtualStart(baseVirtualStart + shift, baseVirtualStart);
          if (this.applyHorizontalPan(virtualStart, visibleCount)) changed = true;
        }
        if (this.isVerticalPanEnabled()) {
          const pricePerPixel = this.getMainPricePerPixel();
          const nextPriceOffset = this.touchStartPriceOffset + dy * pricePerPixel;
          if (Number.isFinite(nextPriceOffset) && Math.abs(nextPriceOffset - this.mainPricePanOffset) > 1e-12) {
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

    // ????????????????????????????????????????????????????????????????????????????
    // ? 기존 드로잉 편집: 드래그 완료 (선택은 유지하여 toolbar 표시)
    // ????????????????????????????????????????????????????????????????????????????
    if (this.drawingMoveState && e.changedTouches.length > 0 && e.touches.length === 0) {
      // 드래그 상태만 종료, 선택은 유지
      this.drawingMoveState = null;
      this.syncDrawingToolbar();
      this.requestOverlayDraw();
      this.updateChartCursor();
      return;
    }

    // ????????????????????????????????????????????????????????????????????????????
    // ? 터치 드로잉 모드: 손가락 뗄 때 드로잉 완료 또는 취소
    // ????????????????????????????????????????????????????????????????????????????
    if (this.drawingTool && e.changedTouches.length > 0 && e.touches.length === 0) {
      const rect  = this.canvas.getBoundingClientRect();
      const tx    = e.changedTouches[0].clientX - rect.left;
      const ty    = e.changedTouches[0].clientY - rect.top;

      // ── Position 드로잉: 손 뗄 때 십자선 최종 위치로 박스 생성 ──────────
      if (this.drawingTool === 'long-position' || this.drawingTool === 'short-position') {
        // 십자선이 이동되었으면 십자선 위치 우선, 아니면 touchEnd 위치
        const useX = this.touchDrawingCrosshairX || tx;
        const useY = this.touchDrawingCrosshairY || ty;
        const defaults = this.position_calc_defaults(useX, useY, true);
        if (!defaults) { this.requestOverlayDraw(); return; }
        const { anchor: snappedAnchor, defaultRisk, defaultBars } = defaults;
        const isLong      = this.drawingTool === 'long-position';
        const stopPrice   = isLong ? (snappedAnchor.price - defaultRisk) : (snappedAnchor.price + defaultRisk);
        const targetPrice = isLong ? (snappedAnchor.price + defaultRisk) : (snappedAnchor.price - defaultRisk);
        const created: DrawingShape = {
          id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: this.drawingTool,
          a: { index: snappedAnchor.index, price: snappedAnchor.price },
          b: { index: snappedAnchor.index, price: stopPrice },
          channelOffset: { index: defaultBars, price: targetPrice - snappedAnchor.price },
          color: '#2f6cff', width: 2, lineStyle: 'solid',
          alert: { enabled: false, mode: 'up', target: 'trendline', appPush: false, onsite: true, sound: false },
        };
        this.upsertDrawing(created);
        this.selectedDrawingId = created.id;
        this.selectedDrawingPart = 'position-target';
        this.syncDrawingToolbar();
        this.drawingDraft = null;
        this.isCrosshairMode = false;
        this.setDrawingTool(null);
        this.showPositionGuide(1, isLong ? 'long-position' : 'short-position');
        this.requestOverlayDraw();
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
          const offset = {
            index: anchor.index - this.drawingDraft.a.index,
            price: anchor.price - this.drawingDraft.a.price,
          };
          const moved = Math.abs(this.drawingDraft.a.index - (this.drawingDraft.b?.index ?? this.drawingDraft.a.index)) > 0.2
            || Math.abs(this.drawingDraft.a.price - (this.drawingDraft.b?.price ?? this.drawingDraft.a.price)) > 1e-6;
          if (moved) {
            const created: DrawingShape = {
              id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              kind: 'fib-trend',
              a: this.drawingDraft.a,
              b: this.drawingDraft.b!,
              channelOffset: offset,
              color: '#2f6cff', width: 2, lineStyle: 'solid',
              alert: { enabled: false, mode: 'up', target: 'trendline', appPush: false, onsite: true, sound: false },
            };
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
              const anchor = this.getMouseAnchor(tx, ty);
              const hline: DrawingShape = {
                id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                kind: 'hline',
                a: { index: anchor?.index ?? this.startIndex, price },
                color: '#2962ff', width: HLINE_DEFAULT_WIDTH, lineStyle: 'solid',
              };
              this.drawings.push(hline);
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
          // + 버튼 외 어디든 탭 → 십자선 해제
          this.exitCrosshairMode();
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

