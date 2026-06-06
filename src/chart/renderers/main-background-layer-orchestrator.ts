import { toRgba } from '../color-utils.ts';
import { drawZeroLagAreaUnderCandles, type ZeroLagTrendStates } from '../indicator-render-engine.ts';
import type {
  EnvelopeResult,
  IchimokuResult,
  IndicatorCandle,
} from '../indicators/index.ts';
import type { VwapBands } from '../indicators/volume.ts';
import { renderBollingerBandFills, type BollingerBandRenderSeries } from './bollinger-renderer.ts';
import { renderEnvelopeFill } from './envelope-renderer.ts';
import { renderIchimoku } from './ichimoku-renderer.ts';
import type { IndicatorLineStyle } from './main-line-renderer.ts';
import { renderVolumeProfileBackground } from './volume-profile-renderer.ts';
import { renderVpvrBackground } from './vpvr-renderer.ts';

type DrawMainLine = (
  data: Array<number | null>,
  color: string,
  width?: number,
  dash?: number[],
  offsetBars?: number,
) => void;

export interface RenderMainBackgroundLayersParams {
  ctx: CanvasRenderingContext2D;
  indicatorLayerOn: boolean;
  indicators: any;
  candles: IndicatorCandle[];
  startIndex: number;
  bbSeries: BollingerBandRenderSeries[];
  vwapBands: VwapBands;
  ichimokuData: IchimokuResult | null;
  envelopeData: EnvelopeResult | null;
  zeroLagMaTrendLevelsData: Parameters<typeof drawZeroLagAreaUnderCandles>[0]['data'];
  zeroLagStates: ZeroLagTrendStates;
  volumeProfile: {
    enabled: boolean;
    rows: number;
    widthRatio: number;
    upOpacity: number;
    downOpacity: number;
    pocOpacity: number;
  };
  minPrice: number;
  maxPrice: number;
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  plotTop: number;
  plotBottom: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  symbolPriceDigits: number;
  fontStack: string;
  showLine: (styleKey: string) => boolean;
  resolveStyle: (styleKey: string, fallbackColor: string, fallbackWidth?: number, fallbackDash?: number[]) => IndicatorLineStyle;
  drawLine: DrawMainLine;
  getY: (price: number) => number;
  formatPrice: (value: number, digits: number) => string;
  formatVolume: (value: number, digits: number) => string;
}

function renderVwapBandFills(params: {
  ctx: CanvasRenderingContext2D;
  enabled: boolean;
  fillColor: string;
  vwap: Record<string, unknown> | undefined;
  vwapBands: { upper: Array<Array<number | null>>; lower: Array<Array<number | null>> };
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  showLine: (styleKey: string) => boolean;
  getY: (price: number) => number;
}): void {
  const {
    ctx,
    enabled,
    fillColor,
    vwap,
    vwapBands,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    showLine,
    getY,
  } = params;
  if (!enabled || !vwap) return;
  const fillOpacity = Math.max(0, Math.min(100, Number(vwap.fillOpacity ?? 8) || 0)) / 100;

  for (let bandIndex = 0; bandIndex < 3; bandIndex += 1) {
    const bandNumber = bandIndex + 1;
    const upperKey = `vwapUpper${bandNumber}`;
    const lowerKey = `vwapLower${bandNumber}`;
    if (vwap[`showUpperBand${bandNumber}`] !== true || vwap[`showLowerBand${bandNumber}`] !== true) continue;
    if (!showLine(upperKey) || !showLine(lowerKey)) continue;

    ctx.save();
    ctx.fillStyle = toRgba(fillColor, fillOpacity, 'rgba(255,152,0,0.05)');
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < visLength; i += 1) {
      const value = vwapBands.upper[bandIndex]?.[startIndex + i];
      if (value == null) continue;
      const x = effectiveChartLeft + i * totalSp + candleW / 2;
      if (first) {
        ctx.moveTo(x, getY(value));
        first = false;
      } else {
        ctx.lineTo(x, getY(value));
      }
    }
    if (!first) {
      for (let i = visLength - 1; i >= 0; i -= 1) {
        const value = vwapBands.lower[bandIndex]?.[startIndex + i];
        if (value == null) continue;
        ctx.lineTo(effectiveChartLeft + i * totalSp + candleW / 2, getY(value));
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export function renderMainBackgroundLayers(params: RenderMainBackgroundLayersParams): void {
  const {
    ctx,
    indicatorLayerOn,
    indicators,
    candles,
    startIndex,
    bbSeries,
    vwapBands,
    ichimokuData,
    envelopeData,
    zeroLagMaTrendLevelsData,
    zeroLagStates,
    volumeProfile,
    minPrice,
    maxPrice,
    chartLeft,
    chartRight,
    chartWidth,
    plotTop,
    plotBottom,
    effectiveChartLeft,
    totalSp,
    candleW,
    symbolPriceDigits,
    fontStack,
    showLine,
    resolveStyle,
    drawLine,
    getY,
    formatPrice,
    formatVolume,
  } = params;
  const visLength = candles.length;

  renderIchimoku({
    ctx,
    data: ichimokuData,
    enabled: indicatorLayerOn && indicators.ichimoku.show,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    tenkanStyle: resolveStyle('ichimokuTenkan', '#f23645', 1),
    kijunStyle: resolveStyle('ichimokuKijun', '#2962ff', 1),
    senkouAStyle: resolveStyle('ichimokuSenkouA', 'rgba(34,171,148,0.6)', 1, [4, 4]),
    senkouBStyle: resolveStyle('ichimokuSenkouB', 'rgba(242,54,69,0.6)', 1, [4, 4]),
    chikouStyle: resolveStyle('ichimokuChikou', '#43a047', 1),
    showLine,
    drawLine,
    getY,
    kijunOffset: indicators.ichimoku.kijun,
  });

  renderBollingerBandFills({
    ctx,
    bbSeries,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    showLine,
    getY,
  });

  renderVwapBandFills({
    ctx,
    enabled: indicatorLayerOn && indicators.vwap?.show && indicators.vwap?.showFill !== false,
    fillColor: typeof indicators.vwap?.fillColor === 'string' && indicators.vwap.fillColor
      ? indicators.vwap.fillColor
      : '#ff9800',
    vwap: indicators.vwap as Record<string, unknown> | undefined,
    vwapBands,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    showLine,
    getY,
  });

  renderEnvelopeFill({
    ctx,
    data: envelopeData,
    enabled: indicatorLayerOn && indicators.envelope.show,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    getY,
  });

  const volumeProfileUpStyle = resolveStyle('volumeProfileUp', 'rgba(38,166,154,0.45)', 1);
  const volumeProfileDownStyle = resolveStyle('volumeProfileDown', 'rgba(239,83,80,0.45)', 1);
  const volumeProfilePocStyle = resolveStyle('volumeProfilePoc', 'rgba(255,193,7,0.95)', 1.2, [4, 3]);
  renderVolumeProfileBackground({
    ctx,
    enabled: indicatorLayerOn && volumeProfile.enabled && volumeProfile.rows > 0,
    candles,
    rows: volumeProfile.rows,
    minPrice,
    maxPrice,
    chartLeft,
    chartRight,
    chartWidth,
    plotTop,
    plotBottom,
    widthRatio: volumeProfile.widthRatio,
    upFillColor: toRgba(volumeProfileUpStyle.color, volumeProfile.upOpacity),
    downFillColor: toRgba(volumeProfileDownStyle.color, volumeProfile.downOpacity),
    pocStrokeColor: toRgba(volumeProfilePocStyle.color, volumeProfile.pocOpacity),
    pocStyle: volumeProfilePocStyle,
    showUp: showLine('volumeProfileUp'),
    showDown: showLine('volumeProfileDown'),
    showPoc: showLine('volumeProfilePoc'),
    getY,
  });

  renderVpvrBackground({
    ctx,
    enabled: indicatorLayerOn && indicators.vpvr.show && showLine('vpvr'),
    vp: indicators.vpvr,
    candles,
    minPrice,
    maxPrice,
    chartLeft,
    chartRight,
    chartWidth,
    plotTop,
    plotBottom,
    symbolPriceDigits,
    fontStack,
    formatPrice,
    formatVolume,
    getY,
  });

  drawZeroLagAreaUnderCandles({
    enabled:
      indicatorLayerOn
      && indicators.zeroLagMaTrendLevels.show
      && showLine('zeroLagMaTrendLevelsZlma')
      && showLine('zeroLagMaTrendLevelsEma'),
    ctx,
    data: zeroLagMaTrendLevelsData,
    states: zeroLagStates,
    startIndex,
    visLength,
    chartLeft,
    chartRight,
    totalSp,
    candleW,
    getY,
    upColor: String(indicators.zeroLagMaTrendLevels.upColor || '#30d453'),
    downColor: String(indicators.zeroLagMaTrendLevels.downColor || '#4043f1'),
    fontStack,
    alpha: 0.22,
  });
}
