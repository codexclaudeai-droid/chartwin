import type { CandleData } from '../../types.ts';
import type { NullableSeries } from '../indicators/types.ts';

export interface DmiCrosshairData {
  plusDI: NullableSeries;
  minusDI: NullableSeries;
  adx: NullableSeries;
}

export interface MacdCrosshairData {
  hist: NullableSeries;
  macdLine: NullableSeries;
  sigLine: NullableSeries;
}

export interface SubPanelCrosshairIndicatorConfig {
  dmi?: {
    period?: number;
    topThreshold?: number;
    bottomThreshold?: number;
    axisMode?: string;
  };
  macd?: {
    fast?: number;
    slow?: number;
    signal?: number;
  };
  cci?: {
    period?: number;
  };
  atr?: {
    period?: number;
  };
}

export interface SubPanelCrosshairValueParams {
  panelId: string;
  data: CandleData[];
  indicators: SubPanelCrosshairIndicatorConfig;
  visStart: number;
  visEnd: number;
  mouseY: number;
  plotTop: number;
  plotH: number;
  dmiScaleRange: { lo: number; hi: number } | null;
  getSubPanelScaledRange: (panelId: string, lo: number, hi: number) => { lo: number; hi: number };
  resolveColor: (styleKey: string, fallbackColor: string) => string;
  calcDMI: (period: number) => DmiCrosshairData;
  calcMACD: (fast: number, slow: number, signal: number) => MacdCrosshairData;
  calcCCI: (period: number) => NullableSeries;
  calcATR: (period: number) => NullableSeries;
  calcOBV: () => number[];
  calcCVD: () => number[];
  sma: (source: NullableSeries, period: number) => NullableSeries;
  formatKUnit: (value: number, digits?: number) => string;
}

export interface SubPanelCrosshairValue {
  value: number;
  labelText: string;
  accentColor: string;
  clampedY: number;
}

function finiteNumbers(values: NullableSeries): number[] {
  return values.filter((value): value is number => value != null && Number.isFinite(value));
}

function resolveDmiRange(params: SubPanelCrosshairValueParams): { lo: number; hi: number } {
  const { indicators, visStart, visEnd, dmiScaleRange, calcDMI } = params;
  const dmiConfig = indicators.dmi ?? {};
  const dmiData = calcDMI(dmiConfig.period ?? 14);
  const topThreshold = Number.isFinite(Number(dmiConfig.topThreshold)) ? Number(dmiConfig.topThreshold) : 30;
  const bottomThreshold = Number.isFinite(Number(dmiConfig.bottomThreshold)) ? Number(dmiConfig.bottomThreshold) : 20;
  const axisMode = dmiConfig.axisMode === 'fixed' ? 'fixed' : 'auto';
  let dmiLo = 0;
  let dmiHi = 60;

  if (axisMode === 'auto') {
    const values = [
      ...finiteNumbers(dmiData.plusDI.slice(visStart, visEnd)),
      ...finiteNumbers(dmiData.minusDI.slice(visStart, visEnd)),
      ...finiteNumbers(dmiData.adx.slice(visStart, visEnd)),
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
    if (dmiScaleRange) {
      dmiLo = dmiScaleRange.lo;
      dmiHi = dmiScaleRange.hi;
    } else {
      dmiLo = loTarget;
      dmiHi = hiTarget;
    }
  }

  const snapUnit = Math.abs(dmiHi - dmiLo) >= 80 ? 10 : 5;
  dmiLo = Math.max(0, Math.floor(dmiLo / snapUnit) * snapUnit);
  dmiHi = Math.min(100, Math.ceil(dmiHi / snapUnit) * snapUnit);
  if (dmiHi - dmiLo < snapUnit * 2) dmiHi = Math.min(100, dmiLo + snapUnit * 2);

  return {
    lo: Math.min(dmiLo, bottomThreshold),
    hi: Math.max(dmiHi, topThreshold),
  };
}

function resolveValueRange(params: SubPanelCrosshairValueParams): {
  lo: number;
  hi: number;
  accentColor: string;
} {
  const {
    panelId,
    data,
    indicators,
    visStart,
    visEnd,
    getSubPanelScaledRange,
    resolveColor,
    calcMACD,
    calcCCI,
    calcATR,
    calcOBV,
    calcCVD,
    sma,
  } = params;

  if (panelId === 'volume') {
    const visibleCandles = data.slice(visStart, visEnd);
    const volumeMax = Math.max(...visibleCandles.map((candle) => candle.volume), 1);
    const range = getSubPanelScaledRange('volume', 0, Math.max(1, volumeMax * 1.14));
    return { ...range, accentColor: '#22ab94' };
  }

  if (panelId === 'rsi') {
    return { lo: 0, hi: 100, accentColor: resolveColor('rsi', '#ffeb3b') };
  }

  if (panelId === 'dmi') {
    return { ...resolveDmiRange(params), accentColor: resolveColor('dmiAdx', '#ffffff') };
  }

  if (panelId === 'macd') {
    const macdConfig = indicators.macd ?? {};
    const macdData = calcMACD(macdConfig.fast ?? 12, macdConfig.slow ?? 26, macdConfig.signal ?? 9);
    const values = [
      ...finiteNumbers(macdData.hist.slice(visStart, visEnd)),
      ...finiteNumbers(macdData.macdLine.slice(visStart, visEnd)),
      ...finiteNumbers(macdData.sigLine.slice(visStart, visEnd)),
    ];
    const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 0.001) * 1.4;
    return { lo: -maxAbs, hi: maxAbs, accentColor: resolveColor('macdLine', '#2962ff') };
  }

  if (panelId === 'stochF' || panelId === 'stochS') {
    const styleKey = panelId === 'stochF' ? 'stochFastK' : 'stochSlowK';
    return { lo: 0, hi: 100, accentColor: resolveColor(styleKey, '#22ab94') };
  }

  if (panelId === 'cci') {
    const cciConfig = indicators.cci ?? {};
    const visibleValues = finiteNumbers(calcCCI(cciConfig.period ?? 20).slice(visStart, visEnd));
    const maxAbs = Math.max(...visibleValues.map((value) => Math.abs(value)), 100);
    return { lo: -maxAbs, hi: maxAbs, accentColor: resolveColor('cci', '#22ab94') };
  }

  if (panelId === 'atr') {
    const atrConfig = indicators.atr ?? {};
    const visibleValues = finiteNumbers(calcATR(atrConfig.period ?? 14).slice(visStart, visEnd));
    let lo = visibleValues.length ? Math.min(...visibleValues) : 0;
    let hi = visibleValues.length ? Math.max(...visibleValues) : 1;
    if (lo === hi) hi = lo + 1;
    const pad = Math.max((hi - lo) * 0.18, hi * 0.04, 1e-9);
    return { lo: Math.max(0, lo - pad), hi: hi + pad, accentColor: resolveColor('atr', '#00bcd4') };
  }

  if (panelId === 'obv') {
    const obvData = calcOBV();
    const obvSignal9 = sma(obvData.map((value) => value), 9);
    const rangeValues = [
      ...finiteNumbers(obvData.slice(visStart, visEnd)),
      ...finiteNumbers(obvSignal9.slice(visStart, visEnd)),
    ];
    let lo = rangeValues.length ? Math.min(...rangeValues) : 0;
    let hi = rangeValues.length ? Math.max(...rangeValues) : 1;
    if (lo === hi) hi = lo + 1;
    const pad = Math.max((hi - lo) * 0.18, 1);
    return { lo: lo - pad, hi: hi + pad, accentColor: resolveColor('obv', '#22ab94') };
  }

  if (panelId === 'cvd') {
    const cvdData = calcCVD();
    const cvdSignal9 = sma(cvdData.map((value) => value), 9);
    const rangeValues = [
      ...finiteNumbers(cvdData.slice(visStart, visEnd)),
      ...finiteNumbers(cvdSignal9.slice(visStart, visEnd)),
    ];
    let lo = Math.min(...rangeValues, 0);
    let hi = Math.max(...rangeValues, 1);
    if (lo === hi) hi = lo + 1;
    const pad = Math.max((hi - lo) * 0.18, 1);
    return { lo: lo - pad, hi: hi + pad, accentColor: resolveColor('cvd', '#7b68ee') };
  }

  return { lo: 0, hi: 100, accentColor: '#7aa2ff' };
}

export function resolveSubPanelCrosshairValue(params: SubPanelCrosshairValueParams): SubPanelCrosshairValue {
  const { panelId, mouseY, plotTop, plotH, formatKUnit } = params;
  const range = resolveValueRange(params);
  const clampedY = Math.max(plotTop, Math.min(plotTop + plotH, mouseY));
  const value = range.hi - ((clampedY - plotTop) / (plotH || 1)) * (range.hi - range.lo);
  const isSignedPanel = panelId === 'macd' || panelId === 'cci' || panelId === 'obv' || panelId === 'cvd';

  return {
    value,
    clampedY,
    labelText: panelId === 'volume' ? formatKUnit(value, 1) : value.toFixed(2),
    accentColor: isSignedPanel ? (value >= 0 ? '#22ab94' : '#f23645') : range.accentColor,
  };
}
