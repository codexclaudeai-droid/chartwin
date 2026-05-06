import { getCandleCountForPeriod } from '../../chart/axis-utils';
import type { TimeframeKey } from '../../catalog/time';
import { isBetaAppVariant } from '../../app/runtime';

type CandleLike = {
  time?: number;
  close: number;
};

type StrategyReportChartLike = {
  config: {
    symbol: string;
    timeframe: string;
  };
  getCandles: () => CandleLike[];
  getStrategySignalSeries: () => number[];
  getActiveStrategyName: () => string | null;
  focusRangeByIndex?: (
    startIndex: number,
    endIndex: number,
    paddingBars?: number,
    options?: { showCrosshair?: boolean },
  ) => void;
  buildStrategyReport?: (args: {
    feeBps: number;
    slippageBps: number;
    periodBars: number;
    rangeStartSec: number | null;
    rangeEndSec: number | null;
    sideFilter: SideFilter;
  }) => ReportResult | null;
};

type CreateStrategyReportPanelArgs<TChart extends StrategyReportChartLike> = {
  app: HTMLElement;
  height: number;
  leftInset?: number;
  getActiveChart: () => TChart;
  onHeightChange?: (height: number) => void;
  onModeChange?: (mode: 'normal' | 'expanded' | 'collapsed', prevMode: 'normal' | 'expanded' | 'collapsed') => void;
};

type SideFilter = 'all' | 'long' | 'short';
type WidgetKey = 'equity' | 'performance' | 'tradeAnalysis' | 'capitalEfficiency' | 'runupDrawdown';
type MainTab = 'metrics' | 'trades';

type ReportTrade = {
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  pnl: number;
  entryIndex: number;
  exitIndex: number;
  entryTime: number | null;
  exitTime: number | null;
};

type ReportResult = {
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
  trades: ReportTrade[];
};

const REPORT_WORKER_SOURCE = `
self.onmessage = function (event) {
  const payload = event.data || {};
  const requestId = payload.requestId || 0;
  const closes = Array.isArray(payload.closes) ? payload.closes : [];
  const times = Array.isArray(payload.times) ? payload.times : [];
  const signals = Array.isArray(payload.signals) ? payload.signals : [];
  const feeBps = Number(payload.feeBps || 0);
  const slippageBps = Number(payload.slippageBps || 0);
  const periodBars = Number(payload.periodBars || 0);
  const hasRangeStart = payload.rangeStartSec !== null && payload.rangeStartSec !== undefined && Number.isFinite(Number(payload.rangeStartSec));
  const hasRangeEnd = payload.rangeEndSec !== null && payload.rangeEndSec !== undefined && Number.isFinite(Number(payload.rangeEndSec));
  const rangeStartSec = hasRangeStart ? Number(payload.rangeStartSec) : NaN;
  const rangeEndSec = hasRangeEnd ? Number(payload.rangeEndSec) : NaN;
  const sideFilter = String(payload.sideFilter || 'all');

  var pos = 0;
  var entry = 0;
  var entryIndex = -1;
  var entryTime = null;
  var equity = [];
  var buyHold = [];
  var excursion = [];
  var runup = [];
  var drawdown = [];
  var trades = [];
  var cum = 0;
  var peak = 0;
  var trough = 0;
  var maxDrawdown = 0;
  var maxDrawdownPct = 0;
  var wins = 0;
  var grossProfit = 0;
  var grossLoss = 0;
  var tradeCount = 0;
  var absExcursion = 0;

  var nAll = Math.min(closes.length, signals.length || closes.length);
  var start = 0;
  var end = nAll;

  if (Number.isFinite(rangeStartSec) || Number.isFinite(rangeEndSec)) {
    while (start < nAll) {
      var tsStart = Number(times[start]);
      if (!Number.isFinite(tsStart)) {
        start += 1;
        continue;
      }
      if (!Number.isFinite(rangeStartSec) || tsStart >= rangeStartSec) break;
      start += 1;
    }
    while (end > start) {
      var tsEnd = Number(times[end - 1]);
      if (!Number.isFinite(tsEnd)) {
        end -= 1;
        continue;
      }
      if (!Number.isFinite(rangeEndSec) || tsEnd <= rangeEndSec) break;
      end -= 1;
    }
  }

  if (periodBars > 0 && periodBars < end - start) start = end - periodBars;
  if (end <= start) {
    self.postMessage({
      requestId: requestId,
      result: {
        equity: [],
        buyHold: [],
        excursion: [],
        runup: [],
        drawdown: [],
        netProfit: 0,
        winRate: 0,
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        profitFactor: 0,
        tradeCount: 0,
        grossProfit: 0,
        grossLoss: 0,
        averagePnl: 0,
        trades: []
      }
    });
    return;
  }

  var baseClose = Number(closes[start] || 0);
  if (!Number.isFinite(baseClose) || baseClose <= 0) baseClose = 1;

  for (var i = start; i < end; i += 1) {
    var close = Number(closes[i]);
    if (!Number.isFinite(close)) {
      equity.push(cum);
      buyHold.push(0);
      excursion.push(absExcursion);
      runup.push(Math.max(0, cum - trough));
      drawdown.push(Math.max(0, peak - cum));
      continue;
    }

    var sig = Number(signals[i] || 0);
    if (sig === 1) {
      if (pos === -1) {
        var pnlShort = entry - close;
        var costShort = (entry + close) * ((feeBps + slippageBps) / 10000);
        pnlShort -= costShort;
        var includeShort = sideFilter === 'all' || sideFilter === 'short';
        if (includeShort) {
          cum += pnlShort;
          absExcursion += Math.abs(pnlShort);
          tradeCount += 1;
          if (pnlShort > 0) {
            wins += 1;
            grossProfit += pnlShort;
          } else if (pnlShort < 0) {
            grossLoss += Math.abs(pnlShort);
          }
          trades.push({
            side: 'SHORT',
            entry: entry,
            exit: close,
            pnl: pnlShort,
            entryIndex: entryIndex,
            exitIndex: i,
            entryTime: entryTime,
            exitTime: Number.isFinite(Number(times[i])) ? Number(times[i]) : null
          });
        }
      }
      if (pos !== 1) {
        pos = 1;
        entry = close;
        entryIndex = i;
        entryTime = Number.isFinite(Number(times[i])) ? Number(times[i]) : null;
      }
    } else if (sig === -1) {
      if (pos === 1) {
        var pnlLong = close - entry;
        var costLong = (entry + close) * ((feeBps + slippageBps) / 10000);
        pnlLong -= costLong;
        var includeLong = sideFilter === 'all' || sideFilter === 'long';
        if (includeLong) {
          cum += pnlLong;
          absExcursion += Math.abs(pnlLong);
          tradeCount += 1;
          if (pnlLong > 0) {
            wins += 1;
            grossProfit += pnlLong;
          } else if (pnlLong < 0) {
            grossLoss += Math.abs(pnlLong);
          }
          trades.push({
            side: 'LONG',
            entry: entry,
            exit: close,
            pnl: pnlLong,
            entryIndex: entryIndex,
            exitIndex: i,
            entryTime: entryTime,
            exitTime: Number.isFinite(Number(times[i])) ? Number(times[i]) : null
          });
        }
      }
      if (pos !== -1) {
        pos = -1;
        entry = close;
        entryIndex = i;
        entryTime = Number.isFinite(Number(times[i])) ? Number(times[i]) : null;
      }
    }

    if (cum > peak) peak = cum;
    if (cum < trough) trough = cum;
    var dd = peak - cum;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (peak > 0) {
      var ddPct = (dd / peak) * 100;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    }

    equity.push(cum);
    buyHold.push(close - baseClose);
    excursion.push(absExcursion);
    runup.push(Math.max(0, cum - trough));
    drawdown.push(Math.max(0, peak - cum));
  }

  var winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
  var profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);
  var averagePnl = tradeCount > 0 ? (cum / tradeCount) : 0;

  self.postMessage({
    requestId: requestId,
    result: {
      equity: equity,
      buyHold: buyHold,
      excursion: excursion,
      runup: runup,
      drawdown: drawdown,
      netProfit: cum,
      winRate: winRate,
      maxDrawdown: maxDrawdown,
      maxDrawdownPct: maxDrawdownPct,
      profitFactor: profitFactor,
      tradeCount: tradeCount,
      grossProfit: grossProfit,
      grossLoss: grossLoss,
      averagePnl: averagePnl,
      trades: trades
    }
  });
};
`;

function createReportWorker(): Worker {
  const blob = new Blob([REPORT_WORKER_SOURCE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

function mkIconBtn(title: string, svg: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = title;
  btn.innerHTML = svg;
  btn.style.cssText = 'height:24px;min-width:24px;padding:0 6px;border:1px solid #34435f;background:#1b2438;color:#dce4f5;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#263655';
    btn.style.color = '#ffffff';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#1b2438';
    btn.style.color = '#dce4f5';
  });
  return btn;
}

function ensurePeriodPickerStyle(): void {
  if (document.getElementById('strategy-report-period-picker-style')) return;
  const style = document.createElement('style');
  style.id = 'strategy-report-period-picker-style';
  style.textContent = `
    .strategy-report-period-input {
      color-scheme: dark;
    }
    .strategy-report-period-input::-webkit-calendar-picker-indicator {
      /* Force white calendar icon inside datetime-local controls */
      filter: brightness(0) invert(1);
      opacity: 1;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

function formatAmount(value: number): string {
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatAmount2(value: number): string {
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent2(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatTsLabel(ts: number): string {
  const d = new Date(ts * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function niceStep(min: number, max: number, targetTicks = 5): number {
  const span = Math.max(1e-9, max - min);
  const rough = span / Math.max(2, targetTicks);
  const pow10 = 10 ** Math.floor(Math.log10(rough));
  const ratio = rough / pow10;
  if (ratio <= 1) return pow10;
  if (ratio <= 2) return 2 * pow10;
  if (ratio <= 5) return 5 * pow10;
  return 10 * pow10;
}

function secToLocalInput(sec: number): string {
  const d = new Date(sec * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function localInputToSec(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

const icon = {
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12,0A11.972,11.972,0,0,0,4,3.073V1A1,1,0,0,0,2,1V4A3,3,0,0,0,5,7H8A1,1,0,0,0,8,5H5a.854.854,0,0,1-.1-.021A9.987,9.987,0,1,1,2,12a1,1,0,0,0-2,0A12,12,0,1,0,12,0Z"/><path d="M12,6a1,1,0,0,0-1,1v5a1,1,0,0,0,.293.707l3,3a1,1,0,0,0,1.414-1.414L13,11.586V7A1,1,0,0,0,12,6Z"/></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"></path><polyline points="7 10 12 15 17 10"></polyline><rect x="4" y="17" width="16" height="4" rx="1.5"></rect></svg>`,
  menu: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>`,
  maximize: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><polyline points="9 3 3 3 3 9"></polyline><polyline points="15 3 21 3 21 9"></polyline><polyline points="21 15 21 21 15 21"></polyline><polyline points="9 21 3 21 3 15"></polyline></svg>`,
  restore: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 4 10 10 4 10"></polyline><polyline points="14 4 14 10 20 10"></polyline><polyline points="10 20 10 14 4 14"></polyline><polyline points="14 20 14 14 20 14"></polyline></svg>`,
  fold: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  unfold: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 15 12 9 18 15"></polyline></svg>`,
  camera: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h3l1.2-2h7.6L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
  settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12,8a4,4,0,1,0,4,4A4,4,0,0,0,12,8Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,14Z"/><path d="M21.294,13.9l-.444-.256a9.1,9.1,0,0,0,0-3.29l.444-.256a3,3,0,1,0-3-5.2l-.445.257A8.977,8.977,0,0,0,15,3.513V3A3,3,0,0,0,9,3v.513A8.977,8.977,0,0,0,6.152,5.159L5.705,4.9a3,3,0,0,0-3,5.2l.444.256a9.1,9.1,0,0,0,0,3.29l-.444.256a3,3,0,1,0,3,5.2l.445-.257A8.977,8.977,0,0,0,9,20.487V21a3,3,0,0,0,6,0v-.513a8.977,8.977,0,0,0,2.848-1.646l.447.258a3,3,0,0,0,3-5.2Zm-2.548-3.776a7.048,7.048,0,0,1,0,3.75,1,1,0,0,0,.464,1.133l1.084.626a1,1,0,0,1-1,1.733l-1.086-.628a1,1,0,0,0-1.215.165,6.984,6.984,0,0,1-3.243,1.875,1,1,0,0,0-.751.969V21a1,1,0,0,1-2,0V19.748a1,1,0,0,0-.751-.969A6.984,6.984,0,0,1,7.006,16.9a1,1,0,0,0-1.215-.165l-1.084.627a1,1,0,1,1-1-1.732l1.084-.626a1,1,0,0,0,.464-1.133,7.048,7.048,0,0,1,0-3.75A1,1,0,0,0,4.79,8.992L3.706,8.366a1,1,0,0,1,1-1.733l1.086.628A1,1,0,0,0,7.006,7.1a6.984,6.984,0,0,1,3.243-1.875A1,1,0,0,0,11,4.252V3a1,1,0,0,1,2,0V4.252a1,1,0,0,0,.751.969A6.984,6.984,0,0,1,16.994,7.1a1,1,0,0,0,1.215.165l1.084-.627a1,1,0,1,1,1,1.732l-1.084.626A1,1,0,0,0,18.746,10.125Z"/></svg>`,
  details: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="9" x2="17" y2="9"></line><line x1="7" y1="13" x2="14" y2="13"></line></svg>`,
  eyeOn: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  eyeOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a20.1 20.1 0 0 1 5.1-5.9"></path><path d="M9.9 4.2A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a20.4 20.4 0 0 1-3 4.3"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
};

export function createStrategyReportPanel<TChart extends StrategyReportChartLike>({
  app,
  height,
  leftInset = 0,
  getActiveChart,
  onHeightChange,
  onModeChange,
}: CreateStrategyReportPanelArgs<TChart>): {
  refresh: () => void;
  setVisible: (visible: boolean) => void;
  isVisible: () => boolean;
  setLeftInset: (left: number) => void;
  setAutoExpandedHeight: (extraHeight: number) => void;
  openTradesTab: () => void;
  openSettings: () => void;
  collapse: () => void;
  setTradeViewAlertActive: (active: boolean) => void;
} {
  const betaVariant = isBetaAppVariant();
  ensurePeriodPickerStyle();
  const headerHeight = 34;
  const getMinNormalHeight = () => (window.matchMedia('(max-width: 760px)').matches ? 204 : 430);
  const maxNormalHeightRatio = 0.85;
  const defaultHeight = window.matchMedia('(max-width: 760px)').matches ? 264 : Math.max(height, 360);

  let panelMode: 'normal' | 'expanded' | 'collapsed' = 'normal';
  let panelVisible = true;
  let normalHeight = Math.max(defaultHeight, getMinNormalHeight());
  let autoExpandedHeight = 0;
  let activeWidget: WidgetKey = 'equity';
  let activeTab: MainTab = 'metrics';
  let periodBars = 0;
  let periodStartSec: number | null = null;
  let periodEndSec: number | null = null;
  let feeBps = 4;
  let slippageBps = 1;
  let initialCapital = 10_000;
  let leverage = 1;
  let sideFilter: SideFilter = 'all';
  let nextRequestId = 0;
  let lastAppliedRequestId = 0;
  let latestResult: ReportResult | null = null;
  let timelineTimes: number[] = [];
  let netProfitPctBase: number | null = null;
  let latestMeta = { symbol: '', timeframe: '', strategyName: '전략 없음' };
  let tradeViewAlertActive = false;
  const sectionOpen: Record<Exclude<WidgetKey, 'equity'>, boolean> = {
    performance: true,
    tradeAnalysis: true,
    capitalEfficiency: false,
    runupDrawdown: false,
  };
  const seriesVisible = {
    equity: true,
    buyHold: true,
    excursion: false,
    runupDrawdown: false,
  };

  const worker = createReportWorker();
  const ensureTradeViewAlertStyle = () => {
    if (document.getElementById('strategy-report-trade-view-alert-style')) return;
    const style = document.createElement('style');
    style.id = 'strategy-report-trade-view-alert-style';
    style.textContent = `
      @keyframes strategyTradeViewAlertSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes strategyTradeViewInnerSweep {
        0% { transform: translateX(-130%); opacity: 0; }
        20% { opacity: 0.9; }
        55% { opacity: 0.7; }
        100% { transform: translateX(130%); opacity: 0; }
      }
      @keyframes strategyTradeViewInnerPulse {
        0% { background-color: #1b2a43; box-shadow: inset 0 0 0 1px rgba(79,121,201,0.35); }
        50% { background-color: #233a5d; box-shadow: inset 0 0 0 1px rgba(128,186,255,0.55), 0 0 8px rgba(79,140,255,0.28); }
        100% { background-color: #1b2a43; box-shadow: inset 0 0 0 1px rgba(79,121,201,0.35); }
      }
      .strategy-trade-view-alert {
        position: relative;
        overflow: hidden;
        border-color: #4f79c9 !important;
        animation: strategyTradeViewInnerPulse 1.6s ease-in-out infinite;
      }
      .strategy-trade-view-alert::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: 42%;
        border-radius: inherit;
        background: linear-gradient(90deg, rgba(255,255,255,0), rgba(170,225,255,0.95), rgba(255,255,255,0));
        animation: strategyTradeViewInnerSweep 1.25s ease-out infinite;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  };
  ensureTradeViewAlertStyle();

  const panel = document.createElement('div');
  panel.style.cssText = `position:absolute;left:${leftInset}px;right:0;bottom:0;height:${normalHeight}px;background:#0f1524;border-top:1px solid #2a2e3e;z-index:1010;display:flex;flex-direction:column;`;
  app.appendChild(panel);

  const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `position:absolute;left:0;right:0;top:${isTouchDevice ? '-12px' : '-4px'};height:${isTouchDevice ? '24px' : '8px'};cursor:ns-resize;z-index:15;display:flex;align-items:center;justify-content:center;touch-action:none;`;
  const resizeGrip = document.createElement('div');
  resizeGrip.style.cssText = isTouchDevice
    ? 'width:40px;height:4px;border-radius:2px;background:rgba(180,190,210,0.35);pointer-events:none;transition:background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;'
    : 'width:36px;height:2px;border-radius:999px;background:#2a2e3e;pointer-events:none;transition:background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;';
  resizeHandle.appendChild(resizeGrip);
  panel.appendChild(resizeHandle);

  const header = document.createElement('div');
  header.style.cssText = 'height:34px;display:flex;align-items:center;justify-content:flex-start;padding:0 8px 0 10px;background:#131b2d;border-bottom:1px solid #24314a;color:#d5deef;font:600 12px Segoe UI,Arial,sans-serif;position:relative;';
  panel.appendChild(header);
  const headerTitle = document.createElement('div');
  headerTitle.style.cssText = 'display:inline-flex;align-items:center;gap:6px;min-width:0;cursor:pointer;';
  const headerTitleIcon = document.createElement('span');
  headerTitleIcon.style.cssText = 'width:18px;height:18px;border:1px solid #3a4158;border-radius:5px;background:#ffffff;color:#0f1218;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;';
  headerTitleIcon.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 16 9 11 13 13 19 7"></polyline>
    <path d="M5 4v4"></path>
    <path d="M3 7l2 2 2-2"></path>
    <path d="M19 17v-4"></path>
    <path d="M17 15l2-2 2 2"></path>
  </svg>`;
  const headerTitleText = document.createElement('span');
  headerTitleText.style.cssText = 'display:inline-block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  headerTitleText.textContent = '전략 리포트';
  const headerStrategyName = document.createElement('span');
  headerStrategyName.style.cssText = 'font-size:10px;color:#6a84a8;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;';
  headerTitle.appendChild(headerTitleIcon);
  headerTitle.appendChild(headerTitleText);
  headerTitle.appendChild(headerStrategyName);
  header.appendChild(headerTitle);
  const titleControls = document.createElement('div');
  titleControls.style.cssText = 'display:flex;align-items:center;gap:6px;position:absolute;right:8px;top:50%;transform:translateY(-50%);';
  header.appendChild(titleControls);

  const shotBtn = mkIconBtn('스크린샷', icon.camera);
  titleControls.appendChild(shotBtn);
  const expandBtn = mkIconBtn('전체화면', icon.maximize);
  titleControls.appendChild(expandBtn);
  const collapseBtn = mkIconBtn('접기', icon.fold);
  titleControls.appendChild(collapseBtn);

  const tabRow = document.createElement('div');
  tabRow.style.cssText = 'height:30px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;border-bottom:1px solid #23314a;background:#10192c;';
  panel.appendChild(tabRow);
  const tabLeft = document.createElement('div');
  tabLeft.style.cssText = 'display:flex;align-items:center;gap:6px;';
  tabRow.appendChild(tabLeft);
  const tabMetrics = document.createElement('button');
  tabMetrics.textContent = '지표';
  tabMetrics.style.cssText = 'height:22px;border:1px solid #38507b;background:#1f2e4a;color:#e3ecff;border-radius:999px;padding:0 10px;font-size:11px;cursor:pointer;';
  const tabTrades = document.createElement('button');
  tabTrades.textContent = '거래내역';
  tabTrades.style.cssText = 'height:22px;border:1px solid #2b3b58;background:#131d31;color:#9fb1d3;border-radius:999px;padding:0 10px;font-size:11px;cursor:pointer;';
  tabLeft.appendChild(tabMetrics);
  tabLeft.appendChild(tabTrades);
  const tabRight = document.createElement('div');
  tabRight.style.cssText = 'display:flex;align-items:center;gap:6px;';
  tabRow.appendChild(tabRight);

  const periodBtn = mkIconBtn('기간 설정', icon.calendar);
  const periodText = document.createElement('span');
  periodText.textContent = '전체';
  periodText.style.cssText = 'font-size:11px;color:#aab8d2;margin-right:4px;';
  periodBtn.prepend(periodText);
  periodBtn.style.gap = '4px';
  periodBtn.style.paddingRight = '8px';
  tabRight.appendChild(periodBtn);

  const detailsBtn = mkIconBtn('거래내역 전환', icon.details);
  tabRight.appendChild(detailsBtn);
  const exportCsvBtn = mkIconBtn('Trade CSV Download', icon.download);
  tabRight.appendChild(exportCsvBtn);
  const widgetBtn = mkIconBtn('리포트 항목', icon.menu);
  tabRight.appendChild(widgetBtn);
  const settingsBtn = mkIconBtn('리포트 설정', icon.settings);
  tabRight.appendChild(settingsBtn);

  const body = document.createElement('div');
  body.style.cssText = 'position:relative;flex:1;min-height:0;display:flex;flex-direction:column;';
  panel.appendChild(body);

  const periodMenu = document.createElement('div');
  periodMenu.style.cssText = 'position:absolute;top:0;left:0;background:#171f32;border:1px solid #30405e;border-radius:8px;padding:8px;display:none;z-index:950;min-width:280px;';
  panel.appendChild(periodMenu);
  const widgetMenu = document.createElement('div');
  widgetMenu.style.cssText = 'position:absolute;top:0;left:0;background:#171f32;border:1px solid #30405e;border-radius:8px;padding:6px;display:none;z-index:950;min-width:210px;';
  panel.appendChild(widgetMenu);
  const settingsMenu = document.createElement('div');
  settingsMenu.style.cssText = 'position:absolute;top:0;left:0;background:#171f32;border:1px solid #30405e;border-radius:8px;padding:8px;display:none;z-index:950;min-width:210px;';
  panel.appendChild(settingsMenu);

  const metricsView = document.createElement('div');
  metricsView.style.cssText = 'display:flex;flex-direction:column;min-height:0;flex:1;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;';
  body.appendChild(metricsView);

  const kpiRow = document.createElement('div');
  kpiRow.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;padding:10px 10px;border-bottom:1px solid #22304a;background:#101a2d;flex:0 0 auto;';
  metricsView.appendChild(kpiRow);

  const legendRow = document.createElement('div');
  legendRow.style.cssText = 'height:28px;display:flex;align-items:center;gap:6px;padding:0 8px;border-bottom:1px solid #22304a;background:#10192c;flex:0 0 auto;';
  metricsView.appendChild(legendRow);

  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative;flex:0 0 40%;min-height:190px;max-height:62%;border-bottom:1px solid #22304a;touch-action:pan-y;';
  metricsView.appendChild(canvasWrap);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;background:#0f1524;touch-action:pan-y;';
  canvasWrap.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for strategy report panel.');

  const expandedSections = document.createElement('div');
  expandedSections.style.cssText = 'display:none;overflow:auto;flex:1;min-height:0;padding:8px 10px;background:#0f1728;';
  metricsView.appendChild(expandedSections);

  const tradesView = document.createElement('div');
  tradesView.style.cssText = 'display:none;flex:1;overflow:auto;padding:8px;background:#0f1524;';
  body.appendChild(tradesView);

  const settingsGrid = document.createElement('div');
  settingsGrid.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;color:#d5deef;font:12px Segoe UI,Arial,sans-serif;';
  settingsMenu.appendChild(settingsGrid);
  settingsGrid.innerHTML = `
    <span>방향 필터</span>
    <select data-k="side" style="width:88px;height:24px;background:#121b2e;border:1px solid #30405e;color:#d7e0f1;border-radius:6px;">
      <option value="all">전체</option><option value="long">롱만</option><option value="short">숏만</option>
    </select>
    <span>초기자본</span>
    <input data-k="icap" type="number" min="1" step="1" value="10000" style="width:88px;height:24px;background:#121b2e;border:1px solid #30405e;color:#d7e0f1;border-radius:6px;padding:0 6px;">
    <span>레버리지</span>
    <input data-k="lev" type="number" min="1" max="1000" step="1" value="1" style="width:88px;height:24px;background:#121b2e;border:1px solid #30405e;color:#d7e0f1;border-radius:6px;padding:0 6px;">
    <span>수수료(bps)</span>
    <input data-k="fee" type="number" min="0" step="0.1" value="4" style="width:88px;height:24px;background:#121b2e;border:1px solid #30405e;color:#d7e0f1;border-radius:6px;padding:0 6px;">
    <span>슬리피지(bps)</span>
    <input data-k="slip" type="number" min="0" step="0.1" value="1" style="width:88px;height:24px;background:#121b2e;border:1px solid #30405e;color:#d7e0f1;border-radius:6px;padding:0 6px;">
  `;
  const sideSelect = settingsMenu.querySelector('[data-k="side"]') as HTMLSelectElement;
  const initialCapitalInput = settingsMenu.querySelector('[data-k="icap"]') as HTMLInputElement;
  const leverageInput = settingsMenu.querySelector('[data-k="lev"]') as HTMLInputElement;
  const feeInput = settingsMenu.querySelector('[data-k="fee"]') as HTMLInputElement;
  const slipInput = settingsMenu.querySelector('[data-k="slip"]') as HTMLInputElement;

  const _liStyle = 'display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #1a2740;color:#c8d6ef;font-size:13px;padding:13px 16px;cursor:pointer;';
  periodMenu.innerHTML = `
    <div data-k="list-panel">
      <div style="font-size:13px;color:#e0e9ff;font-weight:700;padding:12px 16px 10px;border-bottom:1px solid #1a2740;">차트 범위 선택</div>
      <div style="font-size:10px;color:#4a6280;font-weight:600;letter-spacing:0.05em;padding:10px 16px 4px;">기타 범위</div>
      <button data-days="7"   type="button" style="${_liStyle}">최근 1주일</button>
      <button data-days="10"  type="button" style="${_liStyle}">최근 10일</button>
      <button data-days="30"  type="button" style="${_liStyle}">최근 30일</button>
      <button data-days="90"  type="button" style="${_liStyle}">최근 3개월</button>
      <button data-days="180" type="button" style="${_liStyle}">최근 6개월</button>
      <button data-days="365" type="button" style="${_liStyle}">최근 1년</button>
      <button data-days="0"   type="button" style="${_liStyle}">전체 이력</button>
      <div style="height:1px;background:#1a2740;"></div>
      <button data-k="custom-toggle" type="button" style="display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;color:#8aaed6;font-size:13px;padding:13px 16px;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        사용자 범위 설정
      </button>
    </div>
    <div data-k="input-panel" style="display:none;">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 16px 10px;border-bottom:1px solid #1a2740;">
        <button data-k="back" type="button" style="background:none;border:none;color:#8aaed6;font-size:18px;line-height:1;cursor:pointer;padding:0 6px 0 0;display:flex;align-items:center;">&#8592;</button>
        <span style="font-size:13px;color:#e0e9ff;font-weight:700;">날짜 범위 설정</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px 10px;">
        <div>
          <label style="display:block;font-size:11px;color:#9fb3d5;margin-bottom:5px;">시작</label>
          <input data-k="start" type="date" style="width:100%;height:32px;background:#121b2e;border:1px solid #30405e;color:#d7e0f1;border-radius:6px;padding:0 6px;box-sizing:border-box;font-size:12px;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:#9fb3d5;margin-bottom:5px;">종료</label>
          <input data-k="end" type="date" style="width:100%;height:32px;background:#121b2e;border:1px solid #30405e;color:#d7e0f1;border-radius:6px;padding:0 6px;box-sizing:border-box;font-size:12px;">
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:4px 16px 16px;">
        <button data-k="apply" type="button" style="flex:1;height:36px;background:#2962ff;border:1px solid #2962ff;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">적용</button>
        <button data-k="reset" type="button" style="flex:1;height:36px;background:#131d31;border:1px solid #2b3b58;color:#d6dff0;border-radius:8px;cursor:pointer;font-size:13px;">초기화</button>
      </div>
    </div>
  `;
  const periodStartInput = periodMenu.querySelector('[data-k="start"]') as HTMLInputElement;
  const periodEndInput = periodMenu.querySelector('[data-k="end"]') as HTMLInputElement;
  const periodApplyBtn = periodMenu.querySelector('[data-k="apply"]') as HTMLButtonElement;
  const periodResetBtn = periodMenu.querySelector('[data-k="reset"]') as HTMLButtonElement;
  periodStartInput.classList.add('strategy-report-period-input');
  periodEndInput.classList.add('strategy-report-period-input');

  const isMobileSlide = () => Math.max(320, panel.clientWidth) < 760;

  const hideSlideMenu = (
    menu: HTMLDivElement,
    timerRef: { v: ReturnType<typeof setTimeout> | null },
  ) => {
    if (timerRef.v != null) { clearTimeout(timerRef.v); timerRef.v = null; }
    if (isMobileSlide() && menu.style.display === 'block') {
      menu.style.transform = 'translateY(100%)';
      menu.style.opacity = '0';
      timerRef.v = setTimeout(() => {
        menu.style.display = 'none';
        if (menu.parentElement === document.body) panel.appendChild(menu);
        timerRef.v = null;
      }, 180);
      return;
    }
    menu.style.display = 'none';
    if (menu.parentElement === document.body) panel.appendChild(menu);
  };

  const openSlideMenu = (menu: HTMLDivElement, btn: HTMLButtonElement, onClose?: () => void) => {
    if (isMobileSlide()) {
      // Move to document.body to escape panel's stacking context (panel z-index:1010 < bottom bar z-index:1500)
      if (menu.parentElement !== document.body) document.body.appendChild(menu);

      // Ensure pill close-handle exists as first child
      let handle = menu.querySelector<HTMLDivElement>(':scope > .slide-close-handle');
      if (!handle) {
        handle = document.createElement('div');
        handle.className = 'slide-close-handle';
        handle.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:10px 0 6px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;flex-shrink:0;';
        const pill = document.createElement('div');
        pill.style.cssText = 'width:40px;height:4px;border-radius:2px;background:#3a4a5e;';
        handle.appendChild(pill);
        menu.insertBefore(handle, menu.firstChild);
      }
      handle.style.display = 'flex';
      handle.onclick = onClose ?? null;

      menu.style.display = 'block';
      menu.style.position = 'fixed';
      menu.style.left = '0';
      menu.style.right = '0';
      menu.style.bottom = '0';
      menu.style.top = 'auto';
      menu.style.zIndex = '3200';
      menu.style.borderRadius = '16px 16px 0 0';
      menu.style.boxSizing = 'border-box';
      menu.style.width = '100%';
      menu.style.maxWidth = 'none';
      menu.style.minWidth = '0';
      menu.style.maxHeight = '62vh';
      menu.style.overflowY = 'auto';
      menu.style.transform = 'translateY(100%)';
      menu.style.opacity = '0';
      menu.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
      requestAnimationFrame(() => {
        menu.style.transform = 'translateY(0)';
        menu.style.opacity = '1';
      });
      return;
    }
    if (menu.parentElement === document.body) panel.appendChild(menu);
    const handle = menu.querySelector<HTMLDivElement>(':scope > .slide-close-handle');
    if (handle) handle.style.display = 'none';
    menu.style.position = 'absolute';
    menu.style.left = '0';
    menu.style.right = '';
    menu.style.bottom = '';
    menu.style.top = '0';
    menu.style.zIndex = '950';
    menu.style.borderRadius = '8px';
    menu.style.boxSizing = '';
    menu.style.width = '';
    menu.style.maxWidth = '';
    menu.style.minWidth = '';
    menu.style.maxHeight = '';
    menu.style.overflowY = '';
    menu.style.transform = '';
    menu.style.opacity = '';
    menu.style.transition = '';
    placeMenuAtButton(menu, btn);
    menu.style.display = 'block';
  };

  const _periodTimer  = { v: null as ReturnType<typeof setTimeout> | null };
  const _widgetTimer  = { v: null as ReturnType<typeof setTimeout> | null };
  const _settingsTimer = { v: null as ReturnType<typeof setTimeout> | null };

  const hidePeriodMenu   = () => hideSlideMenu(periodMenu,   _periodTimer);
  const hideWidgetMenu   = () => hideSlideMenu(widgetMenu,   _widgetTimer);
  const hideSettingsMenu = () => hideSlideMenu(settingsMenu, _settingsTimer);

  const closeMenus = () => {
    hidePeriodMenu();
    hideWidgetMenu();
    hideSettingsMenu();
  };

  const openPeriodMenu   = () => openSlideMenu(periodMenu,   periodBtn,   hidePeriodMenu);
  const openWidgetMenu   = () => openSlideMenu(widgetMenu,   widgetBtn,   hideWidgetMenu);
  const openSettingsMenu = () => openSlideMenu(settingsMenu, settingsBtn, hideSettingsMenu);

  const placeMenuAtButton = (menu: HTMLDivElement, btn: HTMLButtonElement) => {
    const panelRect = panel.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    menu.style.display = 'block';
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';
    const menuW = Math.max(120, menu.offsetWidth);
    const menuH = Math.max(80, menu.offsetHeight);

    let left = btnRect.left - panelRect.left;
    if (left + menuW > panelRect.width - 8) left = panelRect.width - menuW - 8;
    if (left < 8) left = 8;

    // 버튼 위에 표시 (패널이 화면 하단이므로 메뉴는 버튼 위쪽)
    let top = btnRect.top - panelRect.top - menuH - 4;
    if (top < 4) top = btnRect.bottom - panelRect.top + 4;
    if (top + menuH > panelRect.height - 4) top = Math.max(4, panelRect.height - menuH - 4);

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';
  };

  const fmtShortDate = (sec: number): string => {
    const d = new Date(sec * 1000);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  };

  const updatePeriodText = () => {
    const finiteTimes = timelineTimes.filter((t) => Number.isFinite(t));
    if (finiteTimes.length >= 1) {
      const startSec = finiteTimes[0];
      const endSec = finiteTimes[finiteTimes.length - 1] ?? startSec;
      periodText.textContent = `${fmtShortDate(startSec)} ~ ${fmtShortDate(endSec)}`;
      return;
    }
    if (periodStartSec != null && periodEndSec != null) {
      periodText.textContent = `${fmtShortDate(periodStartSec)} ~ ${fmtShortDate(periodEndSec)}`;
      return;
    }
    const candles = getActiveChart().getCandles();
    const firstSec = Number(candles[0]?.time);
    const lastSec = Number(candles[candles.length - 1]?.time);
    if (Number.isFinite(firstSec) && Number.isFinite(lastSec)) {
      periodText.textContent = `${fmtShortDate(firstSec)} ~ ${fmtShortDate(lastSec)}`;
      return;
    }
    periodText.textContent = '-';
  };

  const applyResponsiveLayout = () => {
    const width = Math.max(320, panel.clientWidth);

    if (width < 760) {
      tabRow.style.height = '30px';
      tabRow.style.padding = '0 8px';
      tabRow.style.flexWrap = 'nowrap';
      tabLeft.style.width = '';
      tabLeft.style.flexShrink = '0';
      tabRight.style.width = '';
      tabRight.style.flex = '1';
      tabRight.style.minWidth = '0';
      tabRight.style.flexWrap = 'nowrap';
      tabRight.style.overflowX = 'auto';
      tabRight.style.justifyContent = 'flex-end';
      tabRight.style.gap = '4px';
    } else {
      tabRow.style.height = '30px';
      tabRow.style.padding = '0 8px';
      tabRow.style.flexWrap = 'nowrap';
      tabLeft.style.width = '';
      tabLeft.style.flexShrink = '';
      tabRight.style.width = '';
      tabRight.style.flex = '';
      tabRight.style.minWidth = '';
      tabRight.style.flexWrap = '';
      tabRight.style.overflowX = '';
      tabRight.style.justifyContent = '';
      tabRight.style.gap = '6px';
    }

    if (width >= 1200) {
      kpiRow.style.display = 'grid';
      kpiRow.style.overflowX = '';
      kpiRow.style.gridTemplateColumns = 'repeat(4,minmax(120px,1fr))';
    } else if (width >= 900) {
      kpiRow.style.display = 'grid';
      kpiRow.style.overflowX = '';
      kpiRow.style.gridTemplateColumns = 'repeat(3,minmax(120px,1fr))';
    } else if (width >= 620) {
      kpiRow.style.display = 'grid';
      kpiRow.style.overflowX = '';
      kpiRow.style.gridTemplateColumns = 'repeat(2,minmax(120px,1fr))';
    } else {
      kpiRow.style.display = 'grid';
      kpiRow.style.overflowX = '';
      kpiRow.style.gridTemplateColumns = 'repeat(1,minmax(120px,1fr))';
    }

    if (width < 880) {
      legendRow.style.height = 'auto';
      legendRow.style.padding = '6px 8px';
      legendRow.style.flexWrap = 'wrap';
    } else {
      legendRow.style.height = '28px';
      legendRow.style.padding = '0 8px';
      legendRow.style.flexWrap = 'nowrap';
    }

    periodText.style.display = 'inline';
    periodText.style.maxWidth = 'none';
    periodText.style.whiteSpace = 'nowrap';
    periodText.style.overflow = 'visible';
    periodText.style.textOverflow = 'clip';
    periodText.style.fontSize = width < 520 ? '10px' : '11px';

    const maxMenuWidth = Math.max(180, panel.clientWidth - 16);
    const applyMenuSize = (menu: HTMLDivElement, w: number) => {
      if (menu.parentElement === document.body) return; // mobile slide mode: don't override
      menu.style.maxWidth = `${maxMenuWidth}px`;
      menu.style.width = width < 520 ? `${w}px` : '';
    };
    applyMenuSize(periodMenu, maxMenuWidth);
    applyMenuSize(widgetMenu, Math.min(maxMenuWidth, 240));
    applyMenuSize(settingsMenu, Math.min(maxMenuWidth, 240));
  };

  const updateTabStyles = () => {
    const activeStyle = 'height:22px;border:1px solid #38507b;background:#1f2e4a;color:#e3ecff;border-radius:999px;padding:0 10px;font-size:11px;cursor:pointer;';
    const normalStyle = 'height:22px;border:1px solid #2b3b58;background:#131d31;color:#9fb1d3;border-radius:999px;padding:0 10px;font-size:11px;cursor:pointer;';
    tabMetrics.style.cssText = activeTab === 'metrics' ? activeStyle : normalStyle;
    tabTrades.style.cssText = activeTab === 'trades' ? activeStyle : normalStyle;
    metricsView.style.display = activeTab === 'metrics' ? 'flex' : 'none';
    tradesView.style.display = activeTab === 'trades' ? 'block' : 'none';
  };

  const metricCard = (label: string, value: string, color = '#d7e0f3') =>
    `<div style="padding:8px;border:1px solid #2a3a58;background:#141f33;border-radius:8px;">
      <div style="font-size:11px;color:#95a8cb;">${label}</div>
      <div style="font-size:14px;font-weight:700;color:${color};margin-top:2px;">${value}</div>
    </div>`;

  const formatNetProfitValue = (netProfit: number): string => {
    const amountText = formatAmount2(netProfit);
    const base = Number.isFinite(initialCapital) && initialCapital > 0 ? initialCapital : netProfitPctBase;
    if (base == null || !Number.isFinite(base) || base <= 0) {
      return amountText;
    }
    const pct = (netProfit / base) * 100;
    return `${amountText} (${formatPercent2(pct)})`;
  };

  const formatWinRateValue = (r: ReportResult, isMobile = false): string => {
    const winCount = Math.min(r.tradeCount, Math.max(0, Math.round((r.winRate * r.tradeCount) / 100)));
    if (isMobile) {
      return `<span style="display:block;">${r.winRate.toFixed(2)}%</span><span style="display:block;margin-top:2px;font-size:11px;">${winCount}/${r.tradeCount}</span>`;
    }
    return `<span>${r.winRate.toFixed(2)}%</span><span style="margin-left:10pt;">${winCount}/${r.tradeCount}</span>`;
  };

  const applyCapitalBasedRatios = (result: ReportResult): ReportResult => {
    const lever = Math.max(1, Math.min(1000, Math.floor(leverage) || 1));
    const applied = lever === 1 ? result : {
      ...result,
      equity: result.equity.map((v) => v * lever),
      buyHold: result.buyHold.map((v) => v * lever),
      excursion: result.excursion.map((v) => v * lever),
      runup: result.runup.map((v) => v * lever),
      drawdown: result.drawdown.map((v) => v * lever),
      netProfit: result.netProfit * lever,
      maxDrawdown: result.maxDrawdown * lever,
      grossProfit: result.grossProfit * lever,
      grossLoss: result.grossLoss * lever,
      averagePnl: result.averagePnl * lever,
      trades: result.trades.map((t) => ({ ...t, pnl: t.pnl * lever })),
    };

    const base = Number.isFinite(initialCapital) && initialCapital > 0 ? initialCapital : null;
    if (base == null) return applied;
    return {
      ...applied,
      maxDrawdownPct: (applied.maxDrawdown / base) * 100,
    };
  };

  const renderKpi = () => {
    const r = latestResult;
    if (!r) {
      kpiRow.innerHTML = '<div style="grid-column:1 / -1;color:#8ea0c2;font-size:12px;">리포트 계산 중...</div>';
      return;
    }
    const panelWidth = Math.max(320, panel.clientWidth);
    const isMobileKpi = panelWidth < 760;
    const pnlColor = r.netProfit >= 0 ? '#39d98a' : '#ff7f7f';
    const kpiGap = isMobileKpi ? '4px' : '8px';
    const kpiPad = isMobileKpi ? '8px' : '10px';
    const kpiLabelFs = isMobileKpi ? '10px' : '11px';
    const kpiValueFs = isMobileKpi ? '12px' : '14px';
    const kpiTitleMb = isMobileKpi ? '6px' : '8px';
    kpiRow.innerHTML = `
      <div style="grid-column:1 / -1;padding:${kpiPad};border:1px solid #2a3a58;background:#141f33;border-radius:8px;">
        <div style="font-size:12px;color:#c9d6ee;font-weight:700;margin-bottom:${kpiTitleMb};">핵심 성과 요약</div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:${kpiGap};">
          <div>
            <div style="font-size:${kpiLabelFs};color:#95a8cb;">총손익</div>
            <div style="font-size:${kpiValueFs};font-weight:700;color:${pnlColor};margin-top:2px;">${formatNetProfitValue(r.netProfit)}</div>
          </div>
          <div>
            <div style="font-size:${kpiLabelFs};color:#95a8cb;">승률</div>
            <div style="font-size:${kpiValueFs};font-weight:700;color:#8ab4ff;margin-top:2px;">${formatWinRateValue(r, isMobileKpi)}</div>
          </div>
          <div>
            <div style="font-size:${kpiLabelFs};color:#95a8cb;">${isMobileKpi ? '최대감소' : '최대 자본 감소'}</div>
            <div style="font-size:${kpiValueFs};font-weight:700;color:#ff8fa3;margin-top:2px;">${formatAmount(r.maxDrawdown)} (${r.maxDrawdownPct.toFixed(2)}%)</div>
          </div>
          <div>
            <div style="font-size:${kpiLabelFs};color:#95a8cb;">수익지수</div>
            <div style="font-size:${kpiValueFs};font-weight:700;color:#f7c948;margin-top:2px;">${r.profitFactor.toFixed(2)}</div>
          </div>
        </div>
      </div>
    `;
  };

  const renderLegend = () => {
    legendRow.innerHTML = '';
    const items: Array<{ key: keyof typeof seriesVisible; label: string; color: string }> = [
      { key: 'equity', label: '자본', color: '#39d98a' },
      { key: 'buyHold', label: '매수 후 보유', color: '#8ab4ff' },
      { key: 'excursion', label: '거래 익스커션', color: '#f4c95d' },
      { key: 'runupDrawdown', label: '상승/하락폭', color: '#ff8fa3' },
    ];
    items.forEach((item) => {
      const btn = document.createElement('button');
      const on = seriesVisible[item.key];
      btn.type = 'button';
      btn.style.cssText = `height:22px;border:1px solid ${on ? '#3f5b86' : '#28354e'};background:${on ? '#1c2b45' : '#131c2e'};color:${on ? '#dbe7ff' : '#8fa1c2'};border-radius:6px;padding:0 8px;display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;`;
      btn.innerHTML = `${on ? icon.eyeOn : icon.eyeOff}<span style="width:8px;height:8px;border-radius:999px;background:${item.color};display:inline-block;"></span><span>${item.label}</span>`;
      btn.addEventListener('click', () => {
        seriesVisible[item.key] = !seriesVisible[item.key];
        renderLegend();
        drawChart();
      });
      legendRow.appendChild(btn);
    });
  };

  const drawLine = (series: number[], color: string, rect: { x: number; y: number; w: number; h: number }, lo: number, hi: number) => {
    if (!series.length) return;
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = rect.x + (i / Math.max(1, series.length - 1)) * rect.w;
      const y = rect.y + ((hi - v) / (hi - lo || 1)) * rect.h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };

  const drawChart = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 30 || h < 30) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f1524';
    ctx.fillRect(0, 0, w, h);

    const pad = { left: 12, top: 8, right: 70, bottom: 24 };
    const plot = {
      x: pad.left,
      y: pad.top,
      w: Math.max(10, w - pad.left - pad.right),
      h: Math.max(10, h - pad.top - pad.bottom),
    };

    ctx.fillStyle = '#111b2d';
    ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
    ctx.strokeStyle = '#27354f';
    ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);

    const r = latestResult;
    if (!r || r.equity.length < 2) {
      ctx.fillStyle = '#8b99b3';
      ctx.font = '12px Segoe UI, Arial, sans-serif';
      ctx.fillText('전략 시그널 데이터가 부족합니다.', plot.x + 10, plot.y + 22);
      return;
    }

    const merged: number[] = [];
    if (seriesVisible.equity) merged.push(...r.equity);
    if (seriesVisible.buyHold) merged.push(...r.buyHold);
    if (seriesVisible.excursion) merged.push(...r.excursion);
    if (seriesVisible.runupDrawdown) merged.push(...r.runup, ...r.drawdown.map((v) => -v));
    if (!merged.length) return;

    let lo = Math.min(...merged);
    let hi = Math.max(...merged);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }

    const step = niceStep(lo, hi, 5);
    const yStart = Math.floor(lo / step) * step;
    const yEnd = Math.ceil(hi / step) * step;
    lo = yStart;
    hi = yEnd;

    ctx.save();
    ctx.strokeStyle = '#24344f';
    ctx.fillStyle = '#9fb3d5';
    ctx.font = '11px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let yValue = yStart; yValue <= yEnd + step * 0.5; yValue += step) {
      const py = plot.y + ((hi - yValue) / (hi - lo || 1)) * plot.h;
      ctx.beginPath();
      ctx.moveTo(plot.x, py);
      ctx.lineTo(plot.x + plot.w, py);
      ctx.stroke();
      ctx.fillText(formatAmount(yValue), plot.x + plot.w + 60, py);
    }
    ctx.restore();

    if (seriesVisible.equity) drawLine(r.equity, '#39d98a', plot, lo, hi);
    if (seriesVisible.buyHold) drawLine(r.buyHold, '#8ab4ff', plot, lo, hi);
    if (seriesVisible.excursion) drawLine(r.excursion, '#f4c95d', plot, lo, hi);
    if (seriesVisible.runupDrawdown) {
      drawLine(r.runup, '#ffb86c', plot, lo, hi);
      drawLine(r.drawdown.map((v) => -v), '#ff6b8b', plot, lo, hi);
    }

    const count = Math.min(timelineTimes.length, r.equity.length);
    if (count < 2) return;
    const xTicks = 5;
    ctx.save();
    ctx.fillStyle = '#9fb3d5';
    ctx.strokeStyle = '#253550';
    ctx.font = '11px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xTicks; i += 1) {
      const idx = Math.round((i / xTicks) * (count - 1));
      const x = plot.x + (idx / Math.max(1, count - 1)) * plot.w;
      ctx.beginPath();
      ctx.moveTo(x, plot.y + plot.h);
      ctx.lineTo(x, plot.y + plot.h + 4);
      ctx.stroke();
      const ts = timelineTimes[idx];
      if (Number.isFinite(ts)) {
        ctx.fillText(formatTsLabel(ts), x, plot.y + plot.h + 6);
      }
    }
    ctx.restore();
  };

  const sectionHtml = (key: Exclude<WidgetKey, 'equity'>, title: string, bodyHtml: string) => {
    const open = sectionOpen[key];
    return `<div style="border:1px solid #2a3a58;border-radius:8px;overflow:hidden;margin-bottom:8px;">
      <button data-sec="${key}" style="width:100%;text-align:left;height:32px;padding:0 10px;background:#132039;border:none;color:#d9e3f6;font:600 12px Segoe UI,Arial,sans-serif;cursor:pointer;">${open ? '▼' : '▶'} ${title}</button>
      <div style="display:${open ? 'block' : 'none'};padding:8px;background:#10182b;">${bodyHtml}</div>
    </div>`;
  };

  const renderExpandedSections = () => {
    const r = latestResult;
    if (!r) {
      expandedSections.innerHTML = '<div style="color:#8ea0c2;">리포트 계산 중...</div>';
      return;
    }
    const perf = `<div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;">
      ${metricCard('총손익', formatNetProfitValue(r.netProfit), r.netProfit >= 0 ? '#39d98a' : '#ff7f7f')}
      ${metricCard('승률', formatWinRateValue(r), '#8ab4ff')}
      ${metricCard('수익지수', r.profitFactor.toFixed(2), '#f7c948')}
    </div>`;
    const trade = `<div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px;">
      ${metricCard('평균 손익', formatAmount(r.averagePnl), '#9fd2ff')}
      ${metricCard('총 이익/손실', `${formatAmount(r.grossProfit)} / ${formatAmount(r.grossLoss)}`, '#c5d1ea')}
    </div>`;
    const cap = `<div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px;">
      ${metricCard('최대 자본 감소', `${formatAmount(r.maxDrawdown)} (${r.maxDrawdownPct.toFixed(2)}%)`, '#ff8fa3')}
      ${metricCard('손익 대비 DD', r.maxDrawdown > 0 ? (r.netProfit / r.maxDrawdown).toFixed(2) : 'N/A', '#9fd2ff')}
    </div>`;
    const run = `<div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px;">
      ${metricCard('최대 상승폭', formatAmount(Math.max(...r.runup, 0)), '#ffb86c')}
      ${metricCard('최대 하락폭', formatAmount(Math.max(...r.drawdown, 0)), '#ff6b8b')}
    </div>`;
    expandedSections.innerHTML = [
      sectionHtml('performance', '성과', perf),
      sectionHtml('tradeAnalysis', '거래분석', trade),
      sectionHtml('capitalEfficiency', '자본효율', cap),
      sectionHtml('runupDrawdown', '상승/하락폭', run),
    ].join('');
    expandedSections.querySelectorAll('button[data-sec]').forEach((el) => {
      el.addEventListener('click', () => {
        const key = (el as HTMLButtonElement).dataset.sec as Exclude<WidgetKey, 'equity'>;
        sectionOpen[key] = !sectionOpen[key];
        renderExpandedSections();
      });
    });
  };

  const formatTradeTs = (sec: number | null): string => {
    if (!Number.isFinite(Number(sec))) return '-';
    const d = new Date(Number(sec) * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };


  const formatTradeTsCompact = (sec: number | null): string => {
    if (!Number.isFinite(Number(sec))) return '-';
    const d = new Date(Number(sec) * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
  };

  const escapeCsvCell = (value: string | number): string => {
    const text = String(value ?? '');
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const createCsvContent = (trades: ReportTrade[]): string => {
    const header = [
      'no',
      'side',
      'entry',
      'exit',
      'pnl',
      'entry_index',
      'exit_index',
      'entry_time',
      'exit_time',
    ];
    const rows = trades.map((trade, idx) => [
      idx + 1,
      trade.side,
      trade.entry,
      trade.exit,
      trade.pnl,
      trade.entryIndex,
      trade.exitIndex,
      formatTradeTs(trade.entryTime),
      formatTradeTs(trade.exitTime),
    ]);
    return [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');
  };

  const downloadTradesCsv = () => {
    const trades = latestResult?.trades ?? [];
    if (!trades.length) {
      window.alert('다운로드할 거래내역이 없습니다.');
      return;
    }
    const csv = `\uFEFF${createCsvContent(trades)}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const symbol = (latestMeta.symbol || 'symbol').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timeframe = (latestMeta.timeframe || 'tf').replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy_trades_${symbol}_${timeframe}_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const moveToTradeSignal = (trade: ReportTrade) => {
    if (panelMode === 'expanded') {
      applyPanelMode('normal');
    }
    const chart = getActiveChart();
    if (typeof chart.focusRangeByIndex !== 'function') return;
    const padding = panelMode === 'expanded' ? 10 : 6;
    chart.focusRangeByIndex(trade.entryIndex, trade.exitIndex, padding, { showCrosshair: false });
    window.dispatchEvent(new CustomEvent('chart-signal-trade-viewed'));
  };

  const renderTradesTable = () => {
    const r = latestResult;
    if (!r || !r.trades.length) {
      tradesView.innerHTML = '<div style="padding:8px;color:#93a5c4;">표시할 거래가 없습니다.</div>';
      return;
    }
    const panelWidth = Math.max(320, panel.clientWidth);
    const isPhoneWidth = panelWidth < 760;
    const baseColumns = isPhoneWidth ? '20px 34px 1.15fr 2fr 62px' : '32px 56px 1fr 1fr 86px';
    const fullColumns = isPhoneWidth ? '20px 34px 1.15fr 2fr 62px 52px' : '32px 56px 1fr 1fr 86px 88px';
    const rowArrowSvg = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;opacity:.95;"><path d="M2 8h9"></path><path d="M8 4l4 4-4 4"></path></svg>';

    const headerRow = `<div style="display:grid;grid-template-columns:${baseColumns};gap:8px;align-items:center;padding:8px;border-bottom:1px solid #2b3d5d;background:#17243a;color:#9fb3d5;font-size:11px;font-weight:700;text-align:center;">
      <div>#</div>
      <div>타입</div>
      <div>진입 -> 청산</div>
      <div>일시</div>
      <div style="text-align:right;">손익</div>
    </div>`;

    const rows = r.trades
      .slice()
      .reverse()
      .map((t, idx) => {
        const pnlColor = t.pnl >= 0 ? '#39d98a' : '#ff7f7f';
        const sideColor = t.side === 'LONG' ? '#39d98a' : '#ff7f7f';
        const entryTs = formatTradeTsCompact(t.entryTime);
        const exitTs = formatTradeTsCompact(t.exitTime);
        return `<div style="display:grid;grid-template-columns:${baseColumns};gap:8px;align-items:center;padding:7px 8px;border-bottom:1px solid #1f2b44;">
          <div style="color:#8aa0c5;text-align:center;">${idx + 1}</div>
          <div style="color:${sideColor};font-weight:700;text-align:center;font-size:${isPhoneWidth ? '10px' : '12px'};white-space:nowrap;letter-spacing:${isPhoneWidth ? '-0.1px' : '0'};">${t.side}</div>
          <div style="color:#cdd8ee;font-size:${isPhoneWidth ? '15px' : '12px'};line-height:1.12;font-weight:${isPhoneWidth ? '700' : '500'};">
            ${isPhoneWidth
              ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${formatAmount(t.entry)}</div>
                 <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${rowArrowSvg}${formatAmount(t.exit)}</div>`
              : `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${formatAmount(t.entry)} ${rowArrowSvg} ${formatAmount(t.exit)}</div>`
            }
          </div>
          <div style="color:#aab9d6;font-size:${isPhoneWidth ? '11px' : '13px'};line-height:1.22;">
            ${isPhoneWidth
              ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${entryTs}</div>
                 <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${rowArrowSvg}${exitTs}</div>`
              : `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${entryTs} ${rowArrowSvg} ${exitTs}</div>`
            }
          </div>
          <div style="color:${pnlColor};font-weight:700;text-align:right;font-size:${isPhoneWidth ? '15px' : '12px'};line-height:1.12;">${formatAmount(t.pnl)}</div>
        </div>`;
      })
      .join('');
    tradesView.innerHTML = `<div style="border:1px solid #2a3b58;border-radius:8px;overflow:hidden;background:#111a2d;">${headerRow}${rows}</div>`;
    const displayedTrades = r.trades
      .slice()
      .reverse();
    const table = tradesView.firstElementChild as HTMLDivElement | null;
    if (!table) return;
    const rowEls = Array.from(table.children) as HTMLDivElement[];
    if (!rowEls.length) return;

    rowEls[0].style.gridTemplateColumns = fullColumns;
    const moveHeader = document.createElement('div');
    moveHeader.style.textAlign = 'center';
    moveHeader.textContent = '보기';
    rowEls[0].appendChild(moveHeader);

    rowEls.slice(1).forEach((rowEl, idx) => {
      rowEl.style.gridTemplateColumns = fullColumns;
      rowEl.style.cursor = 'pointer';
      rowEl.addEventListener('click', () => {
        const trade = displayedTrades[idx];
        if (!trade) return;
        moveToTradeSignal(trade);
      });
      const moveBtn = document.createElement('button');
      moveBtn.type = 'button';
      moveBtn.textContent = '차트보기';
      moveBtn.style.cssText = isPhoneWidth
        ? 'height:20px;min-width:48px;padding:0 4px;background:#1b2a43;border:1px solid #39527f;color:#dce8ff;border-radius:5px;font-size:10px;cursor:pointer;'
        : 'height:24px;background:#1b2a43;border:1px solid #39527f;color:#dce8ff;border-radius:6px;font-size:11px;cursor:pointer;';
      if (tradeViewAlertActive) moveBtn.classList.add('strategy-trade-view-alert');
      moveBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const trade = displayedTrades[idx];
        if (!trade) return;
        moveToTradeSignal(trade);
      });
      rowEl.appendChild(moveBtn);
    });
  };

  const updateWidgetMenu = () => {
    widgetMenu.innerHTML = '';
    const items: Array<{ key: WidgetKey; label: string }> = [
      { key: 'equity', label: '자본차트' },
      { key: 'performance', label: '성과' },
      { key: 'tradeAnalysis', label: '거래분석' },
      { key: 'capitalEfficiency', label: '자본효율' },
      { key: 'runupDrawdown', label: '상승/하락폭' },
    ];
    items.forEach((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${activeWidget === item.key ? '✓ ' : ''}${item.label}`;
      b.style.cssText = 'width:100%;text-align:left;background:#131d31;border:1px solid #2b3b58;color:#d6dff0;border-radius:6px;padding:6px 8px;font-size:12px;cursor:pointer;margin-bottom:4px;';
      b.addEventListener('click', () => {
        activeWidget = item.key;
        closeMenus();
        if (activeWidget === 'equity') {
          activeTab = 'metrics';
        } else if (panelMode === 'expanded') {
          activeTab = 'metrics';
          sectionOpen[activeWidget as Exclude<WidgetKey, 'equity'>] = true;
        }
        renderAll();
      });
      widgetMenu.appendChild(b);
    });
  };

  const setChartLayoutByMode = () => {
    const expanded = panelMode === 'expanded';
    if (expanded) {
      canvasWrap.style.flex = '0 0 46%';
      canvasWrap.style.minHeight = '260px';
      expandedSections.style.display = 'block';
    } else {
      canvasWrap.style.flex = '0 0 40%';
      canvasWrap.style.minHeight = '190px';
      expandedSections.style.display = 'none';
    }
  };

  const applyMobileSummarySnapHeight = () => {
    if (panelMode !== 'normal') return;
    if (activeTab !== 'metrics') return;
    const width = Math.max(320, panel.clientWidth);
    if (width >= 760) return;

    const target = Math.ceil(
      header.getBoundingClientRect().height
      + tabRow.getBoundingClientRect().height
      + kpiRow.getBoundingClientRect().height
      + 10,
    );
    const minHeight = 170;
    const maxHeight = Math.max(minHeight, Math.floor(app.clientHeight * 0.62));
    const nextHeight = Math.max(minHeight, Math.min(maxHeight, target));
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    if (Math.abs(normalHeight - nextHeight) < 1) return;

    normalHeight = nextHeight;
    panel.style.height = `${normalHeight}px`;
    onHeightChange?.(normalHeight);
  };

  const renderAll = () => {
    const isMobileWidth = Math.max(320, panel.clientWidth) < 760;
    if (betaVariant) {
      headerTitleText.textContent = '전략 리포트';
      headerStrategyName.style.display = 'none';
    } else if (panelMode === 'expanded' && !isMobileWidth) {
      headerTitleText.textContent = `전략 리포트 | ${latestMeta.symbol} ${latestMeta.timeframe} | ${latestMeta.strategyName}`;
      headerStrategyName.style.display = 'none';
    } else {
      headerTitleText.textContent = '전략 리포트';
      const sName = latestMeta.strategyName && latestMeta.strategyName !== '전략 없음' ? latestMeta.strategyName : '';
      headerStrategyName.textContent = sName;
      headerStrategyName.style.display = sName ? '' : 'none';
    }

    // 모바일 normal/collapsed 모드에서 탭우측 일부 버튼 숨김
    const hideMobileTabBtns = isMobileWidth && panelMode !== 'expanded';
    exportCsvBtn.style.display = hideMobileTabBtns ? 'none' : '';
    widgetBtn.style.display    = hideMobileTabBtns ? 'none' : '';
    detailsBtn.style.display   = hideMobileTabBtns ? 'none' : '';

    applyResponsiveLayout();
    updatePeriodText();
    setChartLayoutByMode();
    updateTabStyles();
    renderKpi();
    applyMobileSummarySnapHeight();
    renderLegend();
    drawChart();
    renderTradesTable();

    if (panelMode === 'expanded') {
      renderExpandedSections();
    } else {
      expandedSections.innerHTML = '';
    }
  };

  const applyNormalHeight = (nextHeight: number) => {
    const minNormalHeight = getMinNormalHeight();
    const maxAllowed = Math.max(minNormalHeight, Math.floor(app.clientHeight * maxNormalHeightRatio));
    normalHeight = Math.max(minNormalHeight, Math.min(maxAllowed, Math.floor(nextHeight)));
    if (panelMode === 'normal') {
      const effectiveHeight = Math.max(minNormalHeight, Math.min(maxAllowed, Math.floor(normalHeight + autoExpandedHeight)));
      panel.style.height = `${effectiveHeight}px`;
      onHeightChange?.(effectiveHeight);
      renderAll();
    }
  };

  const applyPanelMode = (mode: 'normal' | 'expanded' | 'collapsed') => {
    const prevMode = panelMode;
    const wasCollapsed = panelMode === 'collapsed';
    panelMode = mode;

    if (mode === 'expanded') {
      panel.style.top = '0';
      panel.style.bottom = '0';
      panel.style.height = 'auto';
      panel.style.zIndex = '2400';
      resizeHandle.style.display = 'none';
      expandBtn.innerHTML = icon.restore;
      collapseBtn.innerHTML = icon.fold;
      collapseBtn.title = '접기';
      onHeightChange?.(app.clientHeight);
    } else {
      const minNormalHeight = getMinNormalHeight();
      const maxAllowed = Math.max(minNormalHeight, Math.floor(app.clientHeight * maxNormalHeightRatio));
      const effectiveNormalHeight = Math.max(minNormalHeight, Math.min(maxAllowed, Math.floor(normalHeight + autoExpandedHeight)));
      panel.style.top = '';
      panel.style.bottom = '0';
      panel.style.height = `${mode === 'collapsed' ? headerHeight : effectiveNormalHeight}px`;
      panel.style.zIndex = mode === 'collapsed' ? '1600' : '1010';
      resizeHandle.style.display = mode === 'normal' ? 'flex' : 'none';
      expandBtn.innerHTML = icon.maximize;
      collapseBtn.innerHTML = mode === 'collapsed' ? icon.unfold : icon.fold;
      collapseBtn.title = mode === 'collapsed' ? '펼치기' : '접기';
      onHeightChange?.(mode === 'collapsed' ? headerHeight : effectiveNormalHeight);
    }

    body.style.display = mode === 'collapsed' ? 'none' : 'flex';
    tabRow.style.display = mode === 'collapsed' ? 'none' : 'flex';
    if (wasCollapsed && mode !== 'collapsed') {
      refresh();
    } else {
      renderAll();
    }
    onModeChange?.(mode, prevMode);
  };

  let dragging = false;
  let startClientY = 0;
  let startHeight = normalHeight;
  let dragTouchId: number | null = null;
  const setResizeHandleVisual = (active: boolean) => {
    resizeGrip.style.background = active ? 'rgba(99,158,255,0.78)' : (isTouchDevice ? 'rgba(180,190,210,0.35)' : '#2a2e3e');
    resizeGrip.style.boxShadow = active
      ? '0 0 0 1px rgba(99,158,255,0.35), 0 0 10px rgba(99,158,255,0.45), 0 0 18px rgba(99,158,255,0.24)'
      : 'none';
    resizeGrip.style.transform = active ? 'scaleY(1.12)' : 'scaleY(1)';
  };

  const handleDragMove = (event: MouseEvent) => {
    if (!dragging || panelMode !== 'normal') return;
    const delta = startClientY - event.clientY;
    applyNormalHeight(startHeight + delta);
  };

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    setResizeHandleVisual(false);
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', stopDrag);
  };

  resizeHandle.addEventListener('mousedown', (event) => {
    if (panelMode !== 'normal') return;
    event.preventDefault();
    dragging = true;
    startClientY = event.clientY;
    startHeight = normalHeight;
    setResizeHandleVisual(true);
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', stopDrag);
  });

  const handleTouchDragMove = (event: TouchEvent) => {
    if (!dragging || panelMode !== 'normal') return;
    const touch = dragTouchId == null
      ? event.touches[0]
      : Array.from(event.touches).find((t) => t.identifier === dragTouchId);
    if (!touch) return;
    event.preventDefault();
    const delta = startClientY - touch.clientY;
    applyNormalHeight(startHeight + delta);
  };

  const stopTouchDrag = () => {
    if (!dragging) return;
    dragging = false;
    setResizeHandleVisual(false);
    dragTouchId = null;
    window.removeEventListener('touchmove', handleTouchDragMove);
    window.removeEventListener('touchend', stopTouchDrag);
    window.removeEventListener('touchcancel', stopTouchDrag);
  };

  resizeHandle.addEventListener('touchstart', (event) => {
    if (panelMode !== 'normal') return;
    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;
    dragging = true;
    dragTouchId = touch.identifier;
    startClientY = touch.clientY;
    startHeight = normalHeight;
    setResizeHandleVisual(true);
    window.addEventListener('touchmove', handleTouchDragMove, { passive: false });
    window.addEventListener('touchend', stopTouchDrag);
    window.addEventListener('touchcancel', stopTouchDrag);
  }, { passive: false });

  worker.addEventListener('message', (event: MessageEvent<{ requestId: number; result: ReportResult }>) => {
    const message = event.data;
    if (!message || message.requestId < lastAppliedRequestId) return;
    lastAppliedRequestId = message.requestId;
    latestResult = applyCapitalBasedRatios(message.result);
    renderAll();
  });

  const refresh = () => {
    if (!panelVisible || panelMode === 'collapsed') return;
    const chart = getActiveChart();
    latestMeta = {
      symbol: chart.config.symbol,
      timeframe: chart.config.timeframe,
      strategyName: chart.getActiveStrategyName() ?? '전략 없음',
    };

    const candles = chart.getCandles();
    const closes = candles.map((c) => Number(c.close));
    const times = candles.map((c) => Number(c.time ?? NaN));
    const signals = chart.getStrategySignalSeries().map((s) => Number(s || 0));

    // signals 배열이 candles보다 짧을 수 있음(워커 응답 지연) — 짧은 쪽 기준으로 통일
    const nAll = Math.min(closes.length, signals.length > 0 ? signals.length : closes.length);
    let start = 0;
    let end = nAll;

    // 커스텀 날짜 범위: 시간 기반 필터
    if (periodStartSec != null || periodEndSec != null) {
      while (start < nAll) {
        const ts = times[start];
        if (!Number.isFinite(ts) || (periodStartSec != null && ts < periodStartSec)) {
          start += 1;
          continue;
        }
        break;
      }
      while (end > start) {
        const ts = times[end - 1];
        if (!Number.isFinite(ts) || (periodEndSec != null && ts > periodEndSec)) {
          end -= 1;
          continue;
        }
        break;
      }
    }

    // 프리셋 기간: 바 수 기반 필터 (타임프레임 × 기간일수로 계산된 periodBars)
    if (periodBars > 0 && periodBars < end - start) start = end - periodBars;

    // 슬라이스를 한 번만 계산 — timelineTimes와 worker 모두 동일한 윈도우 사용
    const slicedCloses  = closes.slice(start, end);
    const slicedTimes   = times.slice(start, end);
    const slicedSignals = signals.slice(start, end);

    timelineTimes = slicedTimes.map((t) => (Number.isFinite(t) ? t : NaN));
    netProfitPctBase = Number.isFinite(initialCapital) && initialCapital > 0 ? initialCapital : null;

    const override = chart.buildStrategyReport?.({
      feeBps,
      slippageBps,
      periodBars: slicedCloses.length,
      rangeStartSec: null,
      rangeEndSec: null,
      sideFilter,
    });
    if (override) {
      nextRequestId += 1;
      lastAppliedRequestId = nextRequestId;
      latestResult = applyCapitalBasedRatios(override);
      renderAll();
      return;
    }

    // 이미 슬라이스된 배열을 전달 — worker 내부에서 재필터링 불필요
    nextRequestId += 1;
    worker.postMessage({
      requestId: nextRequestId,
      closes: slicedCloses,
      times: slicedTimes,
      signals: slicedSignals,
      feeBps,
      slippageBps,
      periodBars: 0,
      rangeStartSec: null,
      rangeEndSec: null,
      sideFilter,
    });

    renderAll();
  };

  periodMenu.querySelectorAll<HTMLButtonElement>('button[data-days]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.days ?? 0);
      if (days === 0) {
        // 전체 이력
        periodBars = 0;
        periodStartSec = null;
        periodEndSec = null;
      } else {
        // 타임프레임 × 기간일수 → 바 수로 변환 (시계열 갭에 영향받지 않는 기준)
        const tf = getActiveChart().config.timeframe as TimeframeKey;
        periodBars = getCandleCountForPeriod(days, tf);
        // periodStartSec/End는 표시용으로만 유지
        const nowSec = Math.floor(Date.now() / 1000);
        periodStartSec = nowSec - days * 86400;
        periodEndSec = nowSec;
      }
      closeMenus();
      refresh();
    });
  });

  const listPanel  = periodMenu.querySelector<HTMLDivElement>('[data-k="list-panel"]')!;
  const inputPanel = periodMenu.querySelector<HTMLDivElement>('[data-k="input-panel"]')!;
  const showListPanel  = () => { listPanel.style.display = '';      inputPanel.style.display = 'none'; };
  const showInputPanel = () => { listPanel.style.display = 'none';  inputPanel.style.display = '';     };

  const customToggleBtn = periodMenu.querySelector<HTMLButtonElement>('[data-k="custom-toggle"]')!;
  customToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); showInputPanel(); });

  const backBtn = periodMenu.querySelector<HTMLButtonElement>('[data-k="back"]')!;
  backBtn.addEventListener('click', (e) => { e.stopPropagation(); showListPanel(); });

  // Prevent internal taps from bubbling to document click → closeMenus
  [periodMenu, widgetMenu, settingsMenu].forEach((m) =>
    m.addEventListener('click', (e) => e.stopPropagation()),
  );

  periodApplyBtn.addEventListener('click', () => {
    const startSec = localInputToSec(periodStartInput.value);
    const endSec = localInputToSec(periodEndInput.value);
    if (startSec != null && endSec != null && startSec > endSec) {
      window.alert('시작일이 종료일보다 늦습니다.');
      return;
    }
    periodStartSec = startSec;
    periodEndSec = endSec;
    periodBars = 0;
    closeMenus();
    refresh();
  });

  periodResetBtn.addEventListener('click', () => {
    periodStartSec = null;
    periodEndSec = null;
    periodBars = 0;
    periodStartInput.value = '';
    periodEndInput.value = '';
    closeMenus();
    refresh();
  });

  updateWidgetMenu();

  tabMetrics.addEventListener('click', () => {
    activeTab = 'metrics';
    renderAll();
  });
  tabTrades.addEventListener('click', () => {
    activeTab = 'trades';
    renderAll();
  });
  detailsBtn.addEventListener('click', () => {
    activeTab = activeTab === 'metrics' ? 'trades' : 'metrics';
    renderAll();
  });
  exportCsvBtn.addEventListener('click', () => {
    downloadTradesCsv();
  });
  periodBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = periodMenu.style.display === 'block';
    closeMenus();
    if (!open) {
      showListPanel();
      if (periodStartSec != null) periodStartInput.value = secToLocalInput(periodStartSec);
      if (periodEndSec != null) periodEndInput.value = secToLocalInput(periodEndSec);
      openPeriodMenu();
    }
  });
  widgetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = widgetMenu.style.display === 'block';
    closeMenus();
    if (!open) {
      openWidgetMenu();
    }
  });
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = settingsMenu.style.display === 'block';
    closeMenus();
    if (!open) {
      openSettingsMenu();
    }
  });
  shotBtn.addEventListener('click', () => {
    const prevMode = panelMode;
    if (prevMode !== 'expanded') applyPanelMode('expanded');

    const a = document.createElement('a');
    a.download = `strategy_report_${latestMeta.symbol}_${latestMeta.timeframe}_${activeTab}.png`;

    if (activeTab === 'metrics') {
      drawChart();
      a.href = canvas.toDataURL('image/png');
      a.click();
    } else {
      const r = latestResult;
      const trades = (r?.trades ?? []).slice().reverse().slice(0, 320);
      const rowH = 30;
      const titleH = 40;
      const headerH = 32;
      const padX = 14;
      const canW = Math.max(720, panel.clientWidth || 720);
      const canH = titleH + headerH + trades.length * rowH + 16;
      const dpr = 2;
      const off = document.createElement('canvas');
      off.width = canW * dpr;
      off.height = canH * dpr;
      const offCtx = off.getContext('2d')!;
      offCtx.scale(dpr, dpr);

      offCtx.fillStyle = '#0f1524';
      offCtx.fillRect(0, 0, canW, canH);

      offCtx.fillStyle = '#d5deef';
      offCtx.font = 'bold 13px "Segoe UI",Arial,sans-serif';
      offCtx.textBaseline = 'middle';
      offCtx.textAlign = 'left';
      offCtx.fillText(`거래내역 | ${latestMeta.symbol} ${latestMeta.timeframe} | ${latestMeta.strategyName}`, padX, titleH / 2);

      const xIdx = 30;
      const xSide = 70;
      const xPrice = 120;
      const xTime = 320;
      const xPnl = canW - padX;

      let y = titleH;
      offCtx.fillStyle = '#17243a';
      offCtx.fillRect(0, y, canW, headerH);
      offCtx.fillStyle = '#9fb3d5';
      offCtx.font = 'bold 11px "Segoe UI",Arial,sans-serif';
      offCtx.textAlign = 'center';
      offCtx.fillText('#', xIdx, y + headerH / 2);
      offCtx.fillText('타입', xSide, y + headerH / 2);
      offCtx.textAlign = 'left';
      offCtx.fillText('가격 (진입 → 청산)', xPrice, y + headerH / 2);
      offCtx.fillText('일시 (진입 → 청산)', xTime, y + headerH / 2);
      offCtx.textAlign = 'right';
      offCtx.fillText('손익', xPnl, y + headerH / 2);
      y += headerH;

      trades.forEach((t, idx) => {
        offCtx.fillStyle = idx % 2 === 0 ? '#0f1a2d' : '#111d30';
        offCtx.fillRect(0, y, canW, rowH);
        const midY = y + rowH / 2;
        offCtx.font = '12px "Segoe UI",Arial,sans-serif';
        offCtx.textBaseline = 'middle';

        offCtx.fillStyle = '#8aa0c5';
        offCtx.textAlign = 'center';
        offCtx.fillText(String(idx + 1), xIdx, midY);

        offCtx.fillStyle = t.side === 'LONG' ? '#39d98a' : '#ff7f7f';
        offCtx.font = 'bold 12px "Segoe UI",Arial,sans-serif';
        offCtx.fillText(t.side, xSide, midY);

        offCtx.fillStyle = '#cdd8ee';
        offCtx.font = '12px "Segoe UI",Arial,sans-serif';
        offCtx.textAlign = 'left';
        offCtx.fillText(`${formatAmount(t.entry)} → ${formatAmount(t.exit)}`, xPrice, midY);
        offCtx.fillText(`${formatTradeTsCompact(t.entryTime)} → ${formatTradeTsCompact(t.exitTime)}`, xTime, midY);

        offCtx.fillStyle = t.pnl >= 0 ? '#39d98a' : '#ff7f7f';
        offCtx.font = 'bold 12px "Segoe UI",Arial,sans-serif';
        offCtx.textAlign = 'right';
        offCtx.fillText(formatAmount(t.pnl), xPnl, midY);

        y += rowH;
      });

      a.href = off.toDataURL('image/png');
      a.click();
    }

    if (prevMode !== 'expanded') applyPanelMode(prevMode);
  });
  expandBtn.addEventListener('click', () => {
    if (panelMode === 'collapsed') {
      applyPanelMode('expanded');
      return;
    }
    applyPanelMode(panelMode === 'expanded' ? 'normal' : 'expanded');
  });
  collapseBtn.addEventListener('click', () => {
    applyPanelMode(panelMode === 'collapsed' ? 'normal' : 'collapsed');
  });
  headerTitle.addEventListener('click', () => {
    if (panelMode === 'collapsed') applyPanelMode('normal');
  });
  sideSelect.addEventListener('change', () => {
    sideFilter = (sideSelect.value as SideFilter) ?? 'all';
    refresh();
  });
  feeInput.addEventListener('change', () => {
    feeBps = Math.max(0, Number(feeInput.value || 0));
    refresh();
  });
  slipInput.addEventListener('change', () => {
    slippageBps = Math.max(0, Number(slipInput.value || 0));
    refresh();
  });
  initialCapitalInput.addEventListener('change', () => {
    initialCapital = Math.max(1, Number(initialCapitalInput.value || 10_000));
    netProfitPctBase = initialCapital;
    refresh();
  });
  leverageInput.addEventListener('change', () => {
    leverage = Math.max(1, Math.min(1000, Math.floor(Number(leverageInput.value || 1))));
    leverageInput.value = String(leverage);
    refresh();
  });

  document.addEventListener('click', () => closeMenus());
  panel.addEventListener('click', (e) => e.stopPropagation());

  const setVisible = (visible: boolean) => {
    panelVisible = visible;
    panel.style.display = visible ? 'flex' : 'none';
    if (!visible) {
      onHeightChange?.(0);
      closeMenus();
      return;
    }
    if (panelMode === 'normal') {
      applyNormalHeight(normalHeight);
    }
    applyPanelMode(panelMode);
    refresh();
  };

  window.addEventListener('resize', () => {
    if (!panelVisible) return;
    if (panelMode === 'expanded') {
      applyPanelMode('expanded');
      return;
    }
    applyNormalHeight(normalHeight);
    renderAll();
  });

  refresh();
  onHeightChange?.(normalHeight);

  return {
    refresh,
    setVisible,
    isVisible: () => panelVisible,
    setLeftInset: (left: number) => {
      panel.style.left = `${Math.max(0, Math.round(left))}px`;
    },
    setAutoExpandedHeight: (extraHeight: number) => {
      autoExpandedHeight = Math.max(0, Math.floor(extraHeight));
      if (!panelVisible) return;
      if (panelMode === 'normal') {
        const minNormalHeight = getMinNormalHeight();
        const maxAllowed = Math.max(minNormalHeight, Math.floor(app.clientHeight * maxNormalHeightRatio));
        const effectiveHeight = Math.max(minNormalHeight, Math.min(maxAllowed, Math.floor(normalHeight + autoExpandedHeight)));
        panel.style.height = `${effectiveHeight}px`;
        onHeightChange?.(effectiveHeight);
      } else if (panelMode === 'collapsed') {
        onHeightChange?.(headerHeight);
      } else {
        onHeightChange?.(app.clientHeight);
      }
      renderAll();
    },
    openTradesTab: () => {
      activeTab = 'trades';
      renderAll();
    },
    openSettings: () => {
      openSettingsMenu();
    },
    collapse: () => applyPanelMode('collapsed'),
    setTradeViewAlertActive: (active: boolean) => {
      tradeViewAlertActive = Boolean(active);
      if (activeTab === 'trades') renderTradesTable();
    },
  };
}
