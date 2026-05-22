import type { SubPanelRenderContext } from './subpanel-render-context.ts';

function lastFinite(series: Array<number | null>): number {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const value = series[index];
    if (value != null && Number.isFinite(value)) return value;
  }
  return 0;
}

export function renderRsiPanel(params: SubPanelRenderContext & {
  period: number;
  data: Array<number | null>;
}): void {
  const { ctx, top, panelHeight: pH, chartLeft, subChartWidth, period, data } = params;
  const lastRsi = lastFinite(data);
  const style = params.resolveStyle('rsi', '#ffeb3b');
  params.drawPanelLegend(`RSI(${period})`, top, [{ text: `RSI ${lastRsi.toFixed(1)}`, color: style.color, enabled: params.showLine('rsi') }]);
  const { lo: rsiLo, hi: rsiHi } = params.scaleRange(0, 100);
  params.subGrid([70, 50, 30], top, pH, rsiLo, rsiHi);
  const { plotTop, plotH } = params.getSubPlotBounds(top, pH);
  const rsiRng = rsiHi - rsiLo || 1;
  const rsiSy = (value: number) => plotTop + (rsiHi - value) / rsiRng * plotH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, top, subChartWidth, pH);
  ctx.clip();
  ctx.fillStyle = 'rgba(242,54,69,0.06)';
  ctx.fillRect(chartLeft, rsiSy(rsiHi), subChartWidth, Math.max(0, rsiSy(70) - rsiSy(rsiHi)));
  ctx.fillStyle = 'rgba(34,171,148,0.06)';
  ctx.fillRect(chartLeft, rsiSy(30), subChartWidth, Math.max(0, rsiSy(rsiLo) - rsiSy(30)));
  ctx.restore();
  if (params.showLine('rsi')) params.subLine(data, style.color, style.width, top, pH, rsiLo, rsiHi, style.dash);
  if (params.showLine('rsiBaseline')) {
    const baseline = params.resolveStyle('rsiBaseline', '#999999', 1, [4, 4]);
    params.subHorizontalLine(50, baseline.color, baseline.width, top, pH, rsiLo, rsiHi, baseline.dash);
  }
  params.drawSubAlertLines('rsi', top, pH, rsiLo, rsiHi);
  if (params.showLine('rsi')) params.drawSubAxisValue(lastRsi, top, pH, rsiLo, rsiHi, style.color, lastRsi.toFixed(2));
}

export function renderMacdPanel(params: SubPanelRenderContext & {
  fast: number;
  slow: number;
  signal: number;
  data: { hist: Array<number | null>; macdLine: Array<number | null>; sigLine: Array<number | null> };
}): void {
  const { ctx, top, panelHeight: pH, chartLeft, subChartWidth, effectiveChartLeft, totalSp, candleW, startIndex, endIndex, visLength, data } = params;
  const values = [
    ...data.hist.slice(startIndex, endIndex).filter((value): value is number => value != null),
    ...data.macdLine.slice(startIndex, endIndex).filter((value): value is number => value != null),
    ...data.sigLine.slice(startIndex, endIndex).filter((value): value is number => value != null),
  ];
  const mMaxBase = Math.max(...values.map(Math.abs), 0.001);
  const { lo: macdLo, hi: macdHi } = params.scaleRange(-mMaxBase * 1.4, mMaxBase * 1.4);
  const mMax = (macdHi - macdLo) / 2;
  const macdLineStyle = params.resolveStyle('macdLine', '#2962ff');
  const sigLineStyle = params.resolveStyle('macdSignal', '#f23645');
  params.drawPanelLegend(`MACD(${params.fast},${params.slow},${params.signal})`, top, [
    { text: 'MACD', color: macdLineStyle.color, enabled: params.showLine('macdLine') },
    { text: 'Signal', color: sigLineStyle.color, enabled: params.showLine('macdSignal') },
  ]);
  const sy = (value: number) => top + (mMax - value) / (2 * mMax) * (pH - 20) + 20;
  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, top, subChartWidth, pH);
  ctx.clip();
  for (let i = 0; i < visLength; i += 1) {
    const value = data.hist[startIndex + i];
    if (value == null) continue;
    const zeroY = sy(0);
    const barY = sy(value);
    ctx.fillStyle = value >= 0 ? 'rgba(34,171,148,0.6)' : 'rgba(242,54,69,0.6)';
    ctx.fillRect(effectiveChartLeft + i * totalSp, Math.min(barY, zeroY), candleW, Math.max(Math.abs(barY - zeroY), 1));
  }
  ctx.restore();
  if (params.showLine('macdLine')) params.subLine(data.macdLine, macdLineStyle.color, macdLineStyle.width, top, pH, -mMax, mMax, macdLineStyle.dash);
  if (params.showLine('macdBaseline')) {
    const baseline = params.resolveStyle('macdBaseline', '#999999', 1, [4, 4]);
    params.subHorizontalLine(0, baseline.color, baseline.width, top, pH, -mMax, mMax, baseline.dash);
  }
  if (params.showLine('macdSignal')) params.subLine(data.sigLine, sigLineStyle.color, sigLineStyle.width, top, pH, -mMax, mMax, sigLineStyle.dash);
  params.drawSubAlertLines('macd', top, pH, -mMax, mMax);
  const lastMacd = lastFinite(data.macdLine);
  if (params.showLine('macdLine')) params.drawSubAxisValue(lastMacd, top, pH, -mMax, mMax, macdLineStyle.color, lastMacd.toFixed(2));
}

export function renderDmiPanel(params: SubPanelRenderContext & {
  period: number;
  data: { plusDI: Array<number | null>; minusDI: Array<number | null>; adx: Array<number | null> };
  topThreshold: number;
  bottomThreshold: number;
  axisMode: 'auto' | 'fixed';
  currentScaleRange: { lo: number; hi: number } | null;
  getSubAxisSnapUnit: (lo: number, hi: number) => 5 | 10;
}): { lo: number; hi: number } | null {
  const { ctx, top, panelHeight: pH, chartLeft, subChartWidth, startIndex, endIndex, data } = params;
  const plus = params.resolveStyle('dmiPlus', '#22ab94');
  const minus = params.resolveStyle('dmiMinus', '#f23645');
  const adx = params.resolveStyle('dmiAdx', '#ffffff', 2);
  let dmiLo = 0;
  let dmiHi = 60;
  let nextScaleRange: { lo: number; hi: number } | null = null;
  if (params.axisMode === 'auto') {
    const visibleValues = [
      ...data.plusDI.slice(startIndex, endIndex).filter((value): value is number => value != null && Number.isFinite(value)),
      ...data.minusDI.slice(startIndex, endIndex).filter((value): value is number => value != null && Number.isFinite(value)),
      ...data.adx.slice(startIndex, endIndex).filter((value): value is number => value != null && Number.isFinite(value)),
    ];
    let loTarget = visibleValues.length ? Math.min(...visibleValues) : 0;
    let hiTarget = visibleValues.length ? Math.max(...visibleValues) : 60;
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
    if (!params.currentScaleRange) {
      dmiLo = loTarget;
      dmiHi = hiTarget;
    } else {
      const smoothing = 0.22;
      dmiLo = params.currentScaleRange.lo + (loTarget - params.currentScaleRange.lo) * smoothing;
      dmiHi = params.currentScaleRange.hi + (hiTarget - params.currentScaleRange.hi) * smoothing;
    }
    if (dmiHi - dmiLo < 8) {
      const center = (dmiHi + dmiLo) / 2;
      dmiLo = Math.max(0, center - 4);
      dmiHi = Math.min(100, center + 4);
    }
    nextScaleRange = { lo: dmiLo, hi: dmiHi };
  }

  const snapUnit = params.getSubAxisSnapUnit(dmiLo, dmiHi);
  dmiLo = Math.max(0, Math.floor(dmiLo / snapUnit) * snapUnit);
  dmiHi = Math.min(100, Math.ceil(dmiHi / snapUnit) * snapUnit);
  if (dmiHi - dmiLo < snapUnit * 2) dmiHi = Math.min(100, dmiLo + snapUnit * 2);
  ({ lo: dmiLo, hi: dmiHi } = params.scaleRange(dmiLo, dmiHi));
  const dmiMid = (dmiLo + dmiHi) / 2;
  const topLine = Math.max(dmiLo, Math.min(dmiHi, params.topThreshold));
  const bottomLine = Math.max(dmiLo, Math.min(dmiHi, params.bottomThreshold));
  params.drawPanelLegend(`DMI(${params.period})`, top, [
    { text: '+DI', color: plus.color, enabled: params.showLine('dmiPlus') },
    { text: '-DI', color: minus.color, enabled: params.showLine('dmiMinus') },
    { text: 'ADX', color: adx.color, enabled: params.showLine('dmiAdx') },
  ]);
  params.subGrid([dmiHi, dmiMid, dmiLo, topLine, bottomLine], top, pH, dmiLo, dmiHi);
  const { plotTop, plotH } = params.getSubPlotBounds(top, pH);
  const dmiRange = dmiHi - dmiLo || 1;
  const yTop = plotTop + (dmiHi - topLine) / dmiRange * plotH;
  const yBottom = plotTop + (dmiHi - bottomLine) / dmiRange * plotH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, top, subChartWidth, pH);
  ctx.clip();
  ctx.fillStyle = 'rgba(83, 109, 254, 0.12)';
  ctx.fillRect(chartLeft, Math.min(yTop, yBottom), subChartWidth, Math.max(1, Math.abs(yBottom - yTop)));
  ctx.restore();
  params.subHorizontalLine(topLine, '#5f6778', 1, top, pH, dmiLo, dmiHi, [4, 4]);
  params.subHorizontalLine(bottomLine, '#5f6778', 1, top, pH, dmiLo, dmiHi, [4, 4]);
  if (params.showLine('dmiPlus')) params.subLine(data.plusDI, plus.color, plus.width, top, pH, dmiLo, dmiHi, plus.dash);
  if (params.showLine('dmiMinus')) params.subLine(data.minusDI, minus.color, minus.width, top, pH, dmiLo, dmiHi, minus.dash);
  if (params.showLine('dmiAdx')) params.subLine(data.adx, adx.color, adx.width, top, pH, dmiLo, dmiHi, adx.dash);
  params.drawSubAlertLines('dmi', top, pH, dmiLo, dmiHi);
  const lastAdx = lastFinite(data.adx);
  if (params.showLine('dmiAdx')) params.drawSubAxisValue(lastAdx, top, pH, dmiLo, dmiHi, adx.color, lastAdx.toFixed(2));
  return nextScaleRange;
}

export function renderStochasticPanel(params: SubPanelRenderContext & {
  panelId: 'stochF' | 'stochS';
  title: string;
  kStyleKey: string;
  dStyleKey: string;
  baselineStyleKey: string;
  data: { k: Array<number | null>; d: Array<number | null> };
}): void {
  const { top, panelHeight: pH, data } = params;
  const k = params.resolveStyle(params.kStyleKey, '#22ab94');
  const d = params.resolveStyle(params.dStyleKey, '#f23645');
  params.drawPanelLegend(params.title, top, [
    { text: '%K', color: k.color, enabled: params.showLine(params.kStyleKey) },
    { text: '%D', color: d.color, enabled: params.showLine(params.dStyleKey) },
  ]);
  const { lo, hi } = params.scaleRange(0, 100);
  params.subGrid([80, 50, 20], top, pH, lo, hi);
  if (params.showLine(params.kStyleKey)) params.subLine(data.k, k.color, k.width, top, pH, lo, hi, k.dash);
  if (params.showLine(params.baselineStyleKey)) {
    const baseline = params.resolveStyle(params.baselineStyleKey, '#999999', 1, [4, 4]);
    params.subHorizontalLine(50, baseline.color, baseline.width, top, pH, lo, hi, baseline.dash);
  }
  if (params.showLine(params.dStyleKey)) params.subLine(data.d, d.color, d.width, top, pH, lo, hi, d.dash);
  params.drawSubAlertLines(params.panelId, top, pH, lo, hi);
  const lastK = lastFinite(data.k);
  if (params.showLine(params.kStyleKey)) params.drawSubAxisValue(lastK, top, pH, lo, hi, k.color, lastK.toFixed(2));
}

export function renderCciPanel(params: SubPanelRenderContext & {
  period: number;
  data: Array<number | null>;
}): void {
  const { top, panelHeight: pH, startIndex, endIndex, data } = params;
  const visible = data.slice(startIndex, endIndex).filter((value): value is number => value != null);
  const cMax = Math.max(...visible.map(Math.abs), 100);
  const { lo, hi } = params.scaleRange(-cMax, cMax);
  const style = params.resolveStyle('cci', '#22ab94');
  params.drawPanelLegend(`CCI(${params.period})`, top, [{ text: 'CCI', color: style.color, enabled: params.showLine('cci') }]);
  params.subGrid([100, 0, -100], top, pH, lo, hi);
  if (params.showLine('cci')) params.subLine(data, style.color, style.width, top, pH, lo, hi, style.dash);
  if (params.showLine('cciBaseline')) {
    const baseline = params.resolveStyle('cciBaseline', '#999999', 1, [4, 4]);
    params.subHorizontalLine(0, baseline.color, baseline.width, top, pH, lo, hi, baseline.dash);
  }
  params.drawSubAlertLines('cci', top, pH, lo, hi);
  const lastCci = lastFinite(data);
  if (params.showLine('cci')) params.drawSubAxisValue(lastCci, top, pH, lo, hi, style.color, lastCci.toFixed(2));
}

export function renderAtrPanel(params: SubPanelRenderContext & {
  period: number;
  data: Array<number | null>;
}): void {
  const { top, panelHeight: pH, startIndex, endIndex, data } = params;
  const visible = data.slice(startIndex, endIndex).filter((value): value is number => value != null && Number.isFinite(value));
  let lo = visible.length ? Math.min(...visible) : 0;
  let hi = visible.length ? Math.max(...visible) : 1;
  if (lo === hi) hi = lo + 1;
  const pad = Math.max((hi - lo) * 0.18, hi * 0.04, 1e-9);
  ({ lo, hi } = params.scaleRange(Math.max(0, lo - pad), hi + pad));
  const style = params.resolveStyle('atr', '#00bcd4');
  params.drawPanelLegend(`ATR(${params.period})`, top, [{ text: 'ATR', color: style.color, enabled: params.showLine('atr') }]);
  params.subGrid([lo, (lo + hi) / 2, hi], top, pH, lo, hi);
  if (params.showLine('atr')) params.subLine(data, style.color, style.width, top, pH, lo, hi, style.dash);
  params.drawSubAlertLines('atr', top, pH, lo, hi);
  const lastAtr = lastFinite(data);
  if (params.showLine('atr')) params.drawSubAxisValue(lastAtr, top, pH, lo, hi, style.color, lastAtr.toFixed(2));
}
