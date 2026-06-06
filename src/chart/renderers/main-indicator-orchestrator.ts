import {
  drawZeroLagOverlays,
  type ZeroLagMaTrendLevelsData,
  type ZeroLagTrendStates,
} from '../indicator-render-engine.ts';
import type { EnvelopeResult } from '../indicators/envelope.ts';
import type { NullableSeries } from '../indicators/types.ts';
import {
  type DrawSeriesLine,
  type IndicatorSeriesLine,
  renderBollingerBandLines,
  renderLegacyMainMaLines,
  renderMainMovingAverageLines,
  type ResolveIndicatorStyle,
  renderSingleMainLine,
} from './main-line-renderer.ts';
import { renderEnvelopeLines } from './envelope-renderer.ts';
import type { SmartMoneyConceptsResult } from '../indicators/smart-money-concepts.ts';
import { renderSmartMoneyConcepts } from './smart-money-concepts-renderer.ts';
import { renderParabolicSar } from './parabolic-sar-renderer.ts';
import type { VwapBands } from '../indicators/volume.ts';
import {
  getStatisticalTrailingStopMarkerGeometry,
  renderStatisticalTrailingStopBase,
  renderStatisticalTrailingStopMarkers,
  type StatisticalTrailingStopRenderData,
} from './statistical-trailing-stop-renderer.ts';
import { renderSupertrend, type SupertrendRenderData } from './supertrend-renderer.ts';
import { renderWilliamsFractals, type WilliamsFractalRenderData } from './williams-fractal-renderer.ts';
import type { SubPanelIndicatorSettings } from './subpanel-render-orchestrator.ts';
import { INDICATOR_STYLE_TARGETS } from '../../indicator-panel-module.ts';

export interface MainIndicatorSettings extends SubPanelIndicatorSettings {
  volume: { show: boolean };
  vwap: {
    show: boolean;
    anchorPeriod?: string;
    source?: string;
    offset?: number;
    hideOnDailyOrAbove?: boolean;
    sessionTimezone?: string;
    bandMode?: string;
    showFill?: boolean;
    fillColor?: string;
    fillOpacity?: number;
    showUpperBand1?: boolean;
    showLowerBand1?: boolean;
    bandMultiplier1?: number;
    showUpperBand2?: boolean;
    showLowerBand2?: boolean;
    bandMultiplier2?: number;
    showUpperBand3?: boolean;
    showLowerBand3?: boolean;
    bandMultiplier3?: number;
  };
  williamsFractal?: { show: boolean };
  parabolicSar?: { show: boolean };
  smartMoneyConcepts?: {
    show: boolean;
    swingLength?: number;
    internalLength?: number;
    equalLength?: number;
    equalThreshold?: number;
    internalBullishStructure?: 'All' | 'BOS' | 'CHoCH';
    internalBearishStructure?: 'All' | 'BOS' | 'CHoCH';
    swingBullishStructure?: 'All' | 'BOS' | 'CHoCH';
    swingBearishStructure?: 'All' | 'BOS' | 'CHoCH';
    showInternal?: boolean;
    showStructure?: boolean;
    showEqualLevels?: boolean;
    showHighLowSwings?: boolean;
    showInternalOrderBlocks?: boolean;
    showSwingOrderBlocks?: boolean;
    showFairValueGaps?: boolean;
    showZones?: boolean;
    internalBullColor?: string;
    internalBearColor?: string;
    swingBullColor?: string;
    swingBearColor?: string;
    internalBullishOrderBlockColor?: string;
    internalBearishOrderBlockColor?: string;
    swingBullishOrderBlockColor?: string;
    swingBearishOrderBlockColor?: string;
    fairValueGapsBullColor?: string;
    fairValueGapsBearColor?: string;
    fairValueGapsExtend?: number;
    premiumZoneColor?: string;
    equilibriumZoneColor?: string;
    discountZoneColor?: string;
  };
  zeroLagMaTrendLevels: {
    show: boolean;
    showLevels: boolean;
    upColor?: string;
    downColor?: string;
  };
  supertrend: {
    show: boolean;
    upBgEnabled?: boolean;
    downBgEnabled?: boolean;
    upBgColor?: string;
    downBgColor?: string;
  };
  statisticalTrailingStop: {
    show: boolean;
    bullishColor?: string;
    bearishColor?: string;
    trailMarkEnabled?: boolean;
    trailMarkStyle?: string;
    trailMarkLocation?: string;
    showPanelLabel?: boolean;
  };
  envelope: { show: boolean };
  maShort?: { show: boolean };
  maLong?: { show: boolean };
  ma60?: { show: boolean };
  ma120?: { show: boolean };
  ma200?: { show: boolean };
  [key: string]: unknown;
}

export interface MainIndicatorCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface RenderMainIndicatorsParams {
  ctx: CanvasRenderingContext2D;
  ind: MainIndicatorSettings;
  indicatorLayerOn: boolean;
  maSeries: IndicatorSeriesLine[];
  emaSeries: IndicatorSeriesLine[];
  maS: NullableSeries;
  maL: NullableSeries;
  ma60: NullableSeries;
  ma120: NullableSeries;
  ma200: NullableSeries;
  hmaD: NullableSeries;
  bbSeries: Array<{
    id: string;
    data: {
      upper: NullableSeries;
      middle: NullableSeries;
      lower: NullableSeries;
    };
  }>;
  vwapD: NullableSeries;
  vwapBandsD: VwapBands;
  williamsFractalD: WilliamsFractalRenderData;
  parabolicSarD: NullableSeries;
  smartMoneyConceptsD: SmartMoneyConceptsResult;
  zeroLagMaTrendLevelsD: ZeroLagMaTrendLevelsData;
  zeroLagStates: ZeroLagTrendStates;
  supertrendD: SupertrendRenderData;
  statisticalTrailingStopD: Required<Pick<StatisticalTrailingStopRenderData, 'level' | 'anchor' | 'bias' | 'extreme'>> & {
    newTrail: boolean[];
  };
  envD: EnvelopeResult | null;
  line: DrawSeriesLine;
  showLine: (key: string) => boolean;
  resolveStyle: ResolveIndicatorStyle;
  startIndex: number;
  pixelRatio: number;
  isMobileViewport?: boolean;
  chartLeft: number;
  chartRight: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
  visData: MainIndicatorCandle[];
  displayData: MainIndicatorCandle[];
  R: { top: number };
  mainH: number;
  fontStack: string;
}

function isIndicatorStyleTargetVisible(indicatorKey: string, showLine: (key: string) => boolean): boolean {
  const targets = INDICATOR_STYLE_TARGETS[indicatorKey] ?? [];
  return targets.length === 0 || targets.some((target) => showLine(target.key));
}

export function renderMainIndicators(params: RenderMainIndicatorsParams): void {
  const {
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
    envD,
    line,
    showLine,
    resolveStyle,
    startIndex,
    pixelRatio,
    isMobileViewport = false,
    chartLeft,
    chartRight,
    effectiveChartLeft,
    totalSp,
    candleW,
    getY,
    visData,
    displayData,
    R,
    mainH,
    fontStack,
  } = params;

  renderMainMovingAverageLines({ maSeries, emaSeries, showLine, resolveStyle, drawLine: line });
  renderLegacyMainMaLines({
    indicatorLayerOn,
    indicators: ind,
    lines: [
      { indicatorKey: 'maShort', styleKey: 'maShort', fallbackColor: '#f7931a', data: maS },
      { indicatorKey: 'maLong', styleKey: 'maLong', fallbackColor: '#2962ff', data: maL },
      { indicatorKey: 'ma60', styleKey: 'ma60', fallbackColor: '#4caf50', data: ma60 },
      { indicatorKey: 'ma120', styleKey: 'ma120', fallbackColor: '#9c27b0', data: ma120 },
      { indicatorKey: 'ma200', styleKey: 'ma200', fallbackColor: '#ff5722', data: ma200 },
    ],
    showLine,
    resolveStyle,
    drawLine: line,
  });
  renderBollingerBandLines({ bbSeries, showLine, resolveStyle, drawLine: line });
  renderSingleMainLine({
    enabled: indicatorLayerOn && Boolean((ind as Record<string, any>).hma?.show),
    styleKey: 'hma',
    fallbackColor: '#00bcd4',
    data: hmaD,
    showLine,
    resolveStyle,
    drawLine: line,
  });
  renderSingleMainLine({
    enabled: indicatorLayerOn && ind.vwap.show,
    styleKey: 'vwap',
    fallbackColor: '#ff9800',
    data: vwapD,
    showLine,
    resolveStyle,
    drawLine: line,
  });
  [0, 1, 2].forEach((bandIndex) => {
    const bandNumber = bandIndex + 1;
    renderSingleMainLine({
      enabled: indicatorLayerOn && ind.vwap.show && (ind.vwap as Record<string, any>)[`showUpperBand${bandNumber}`] === true,
      styleKey: `vwapUpper${bandNumber}`,
      fallbackColor: bandIndex === 0 ? 'rgba(255,152,0,0.62)' : bandIndex === 1 ? 'rgba(255,193,7,0.52)' : 'rgba(255,214,10,0.45)',
      data: vwapBandsD.upper[bandIndex],
      showLine,
      resolveStyle,
      drawLine: line,
    });
    renderSingleMainLine({
      enabled: indicatorLayerOn && ind.vwap.show && (ind.vwap as Record<string, any>)[`showLowerBand${bandNumber}`] === true,
      styleKey: `vwapLower${bandNumber}`,
      fallbackColor: bandIndex === 0 ? 'rgba(255,152,0,0.62)' : bandIndex === 1 ? 'rgba(255,193,7,0.52)' : 'rgba(255,214,10,0.45)',
      data: vwapBandsD.lower[bandIndex],
      showLine,
      resolveStyle,
      drawLine: line,
    });
  });

  if (indicatorLayerOn && ind.williamsFractal?.show) {
    const highStyle = resolveStyle('williamsFractalHigh', '#ef5350', 1.5);
    const lowStyle = resolveStyle('williamsFractalLow', '#26a69a', 1.5);
    renderWilliamsFractals({
      ctx,
      data: williamsFractalD,
      startIndex,
      visLength: visData.length,
      chartLeft,
      chartRight,
      effectiveChartLeft,
      totalSp,
      candleW,
      top: R.top,
      bottom: mainH,
      highStyle,
      lowStyle,
      showHigh: showLine('williamsFractalHigh'),
      showLow: showLine('williamsFractalLow'),
      getY,
    });
  }

  if (indicatorLayerOn && ind.parabolicSar?.show && showLine('parabolicSar')) {
    const style = resolveStyle('parabolicSar', '#2962ff', 1.5);
    renderParabolicSar({
      ctx,
      data: parabolicSarD,
      startIndex,
      visLength: visData.length,
      chartLeft,
      chartRight,
      effectiveChartLeft,
      totalSp,
      candleW,
      top: R.top,
      bottom: mainH,
      style,
      getY,
    });
  }

  const smartMoneyConceptsVisible = isIndicatorStyleTargetVisible('smartMoneyConcepts', showLine);
  if (indicatorLayerOn && ind.smartMoneyConcepts?.show && smartMoneyConceptsVisible) {
    const bullishStyle = resolveStyle('smartMoneyConceptsBullish', ind.smartMoneyConcepts.swingBullColor || '#089981', 1);
    const bearishStyle = resolveStyle('smartMoneyConceptsBearish', ind.smartMoneyConcepts.swingBearColor || '#f23645', 1);
    const internalBullishStyle = resolveStyle('smartMoneyConceptsInternalBullish', ind.smartMoneyConcepts.internalBullColor || '#089981', 1, [5, 4]);
    const internalBearishStyle = resolveStyle('smartMoneyConceptsInternalBearish', ind.smartMoneyConcepts.internalBearColor || '#f23645', 1, [5, 4]);
    const equalStyle = resolveStyle('smartMoneyConceptsEqual', '#878b94', 1, [2, 3]);
    renderSmartMoneyConcepts({
      ctx,
      data: smartMoneyConceptsD,
      candles: displayData,
      startIndex,
      visLength: visData.length,
      lastDataIndex: Math.max(0, displayData.length - 1),
      chartLeft,
      chartRight,
      effectiveChartLeft,
      totalSp,
      candleW,
      top: R.top,
      bottom: mainH,
      fontStack,
      getY,
      bullishStyle,
      bearishStyle,
      internalBullishStyle,
      internalBearishStyle,
      equalStyle,
      internalOrderBlockBullColor: ind.smartMoneyConcepts.internalBullishOrderBlockColor || 'rgba(49,121,245,0.20)',
      internalOrderBlockBearColor: ind.smartMoneyConcepts.internalBearishOrderBlockColor || 'rgba(247,124,128,0.20)',
      swingOrderBlockBullColor: ind.smartMoneyConcepts.swingBullishOrderBlockColor || 'rgba(24,72,204,0.20)',
      swingOrderBlockBearColor: ind.smartMoneyConcepts.swingBearishOrderBlockColor || 'rgba(178,40,51,0.20)',
      fairValueGapBullColor: ind.smartMoneyConcepts.fairValueGapsBullColor || 'rgba(0,255,104,0.25)',
      fairValueGapBearColor: ind.smartMoneyConcepts.fairValueGapsBearColor || 'rgba(255,0,8,0.25)',
      premiumZoneColor: ind.smartMoneyConcepts.premiumZoneColor || 'rgba(242,54,69,0.12)',
      equilibriumZoneColor: ind.smartMoneyConcepts.equilibriumZoneColor || 'rgba(135,139,148,0.12)',
      discountZoneColor: ind.smartMoneyConcepts.discountZoneColor || 'rgba(8,153,129,0.12)',
      internalBullishFilter: ind.smartMoneyConcepts.internalBullishStructure || 'All',
      internalBearishFilter: ind.smartMoneyConcepts.internalBearishStructure || 'All',
      swingBullishFilter: ind.smartMoneyConcepts.swingBullishStructure || 'All',
      swingBearishFilter: ind.smartMoneyConcepts.swingBearishStructure || 'All',
      showStructure: ind.smartMoneyConcepts.showStructure !== false,
      showInternal: ind.smartMoneyConcepts.showInternal !== false,
      showEqualLevels: ind.smartMoneyConcepts.showEqualLevels !== false,
      showOrderBlocks: ind.smartMoneyConcepts.showInternalOrderBlocks !== false || ind.smartMoneyConcepts.showSwingOrderBlocks === true,
      showFairValueGaps: ind.smartMoneyConcepts.showFairValueGaps !== false,
      fairValueGapsExtend: Number(ind.smartMoneyConcepts.fairValueGapsExtend ?? 1),
      showHighLowSwings: ind.smartMoneyConcepts.showHighLowSwings !== false,
      showZones: ind.smartMoneyConcepts.showZones === true,
    });
  }

  if (indicatorLayerOn && ind.zeroLagMaTrendLevels.show) {
    const upColor = String(ind.zeroLagMaTrendLevels.upColor || '#30d453');
    const downColor = String(ind.zeroLagMaTrendLevels.downColor || '#4043f1');
    const zlmaStyle = resolveStyle('zeroLagMaTrendLevelsZlma', upColor, 1);
    const emaStyle = resolveStyle('zeroLagMaTrendLevelsEma', downColor, 1);
    const levelStyle = resolveStyle('zeroLagMaTrendLevelsLevel', upColor, 1);
    drawZeroLagOverlays({
      ctx,
      data: zeroLagMaTrendLevelsD,
      states: zeroLagStates,
      startIndex,
      visLength: visData.length,
      chartLeft,
      chartRight,
      totalSp,
      candleW,
      getY,
      upColor,
      downColor,
      fontStack,
      showZlma: showLine('zeroLagMaTrendLevelsZlma'),
      showEma: showLine('zeroLagMaTrendLevelsEma'),
      showLevels: showLine('zeroLagMaTrendLevelsLevel') && ind.zeroLagMaTrendLevels.showLevels,
      showSignals: showLine('zeroLagMaTrendLevelsSignal'),
      zlmaStyle: { width: zlmaStyle.width, dash: zlmaStyle.dash },
      emaStyle: { width: emaStyle.width, dash: emaStyle.dash },
      levelStyle: { width: levelStyle.width, dash: levelStyle.dash },
      signalColor: upColor,
    });
  }

  if (indicatorLayerOn && ind.supertrend.show) {
    const upStyle = resolveStyle('supertrendUp', '#22ab94', 1.7);
    const downStyle = resolveStyle('supertrendDown', '#f23645', 1.7);
    renderSupertrend({
      ctx,
      data: supertrendD,
      displayData,
      startIndex,
      visLength: visData.length,
      effectiveChartLeft,
      totalSp,
      upBgEnabled: ind.supertrend.upBgEnabled !== false,
      downBgEnabled: ind.supertrend.downBgEnabled !== false,
      upBgColor: ind.supertrend.upBgColor || 'rgba(34,171,148,0.18)',
      downBgColor: ind.supertrend.downBgColor || 'rgba(242,54,69,0.18)',
      upStyle,
      downStyle,
      showUpLine: showLine('supertrendUp'),
      showDownLine: showLine('supertrendDown'),
      drawLine: line,
      getY,
    });
  }

  const statisticalTrailingStopVisible = showLine('statisticalTrailingStopBull') || showLine('statisticalTrailingStopBear');
  if (indicatorLayerOn && ind.statisticalTrailingStop.show && statisticalTrailingStopVisible) {
    const bullStyle = resolveStyle('statisticalTrailingStopBull', '#22ab94', 1.7);
    const bearStyle = resolveStyle('statisticalTrailingStopBear', '#f23645', 1.7);
    renderStatisticalTrailingStopBase({
      ctx,
      data: statisticalTrailingStopD,
      startIndex,
      visLength: visData.length,
      totalLength: statisticalTrailingStopD.level.length,
      effectiveChartLeft,
      totalSp,
      bullishFillColor: String(ind.statisticalTrailingStop.bullishColor || 'rgba(8,153,129,0.5)'),
      bearishFillColor: String(ind.statisticalTrailingStop.bearishColor || 'rgba(242,54,69,0.5)'),
      bullStyle,
      bearStyle,
      showBullLine: showLine('statisticalTrailingStopBull'),
      showBearLine: showLine('statisticalTrailingStopBear'),
      drawLine: line,
      getY,
    });
    if (ind.statisticalTrailingStop.trailMarkEnabled !== false) {
      const markerStyle = String(ind.statisticalTrailingStop.trailMarkStyle || 'circle').toLowerCase();
      const markerLocation = String(ind.statisticalTrailingStop.trailMarkLocation || 'absolute').toLowerCase();
      const markerGeometry = getStatisticalTrailingStopMarkerGeometry(pixelRatio, isMobileViewport);
      renderStatisticalTrailingStopMarkers({
        ctx,
        data: statisticalTrailingStopD,
        displayData,
        startIndex,
        visLength: visData.length,
        effectiveChartLeft,
        totalSp,
        candleW,
        markerStyle,
        markerLocation,
        showPanelLabel: ind.statisticalTrailingStop.showPanelLabel === true,
        markerSize: markerGeometry.markerSize,
        markerOffset: markerGeometry.markerOffset,
        topY: R.top + markerGeometry.markerOffset,
        bottomY: Math.max(R.top + markerGeometry.markerOffset, mainH - markerGeometry.markerOffset),
        plotTop: R.top,
        plotBottom: mainH,
        bullColor: bullStyle.color,
        bearColor: bearStyle.color,
        fontStack,
        getY,
      });
    }
  }

  if (envD && ind.envelope.show) {
    renderEnvelopeLines({
      data: envD,
      showLine,
      upperStyle: resolveStyle('envelopeUpper', 'rgba(255,200,50,0.8)', 1),
      middleStyle: resolveStyle('envelopeMiddle', 'rgba(255,200,50,0.4)', 1, [4, 4]),
      lowerStyle: resolveStyle('envelopeLower', 'rgba(255,200,50,0.8)', 1),
      drawLine: line,
    });
  }
}
