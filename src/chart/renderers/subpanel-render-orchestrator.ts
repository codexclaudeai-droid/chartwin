import { INDICATOR_CATALOG } from '../../catalog/indicators.ts';
import type { SubPanelId } from '../../indicator-panel-module.ts';
import type { DmiResult } from '../indicators/dmi.ts';
import type { MacdResult } from '../indicators/macd.ts';
import type { StochasticResult } from '../indicators/stochastic.ts';
import type { NullableSeries } from '../indicators/types.ts';
import type { ResolveIndicatorStyle } from './main-line-renderer.ts';
import type { SubPanelRenderContext } from './subpanel-render-context.ts';
import {
  renderCciPanel,
  renderAtrPanel,
  renderDmiPanel,
  renderMacdPanel,
  renderRsiPanel,
  renderStochasticPanel,
} from './subpanel-oscillator-renderer.ts';
import {
  renderCvdPanel,
  renderObvPanel,
  renderVolumePanel,
} from './subpanel-volume-renderer.ts';
import {
  createSubAlertLinesRenderer,
  createSubAxisValueRenderer,
  createSubGridRenderer,
  createSubPanelLabelRenderer,
  createSubPanelLegendRenderer,
  getSubAxisSnapUnit,
  type SubIndicatorAlertHitArea,
  type SubIndicatorAlertLike,
  type SubPanelPlotBounds,
} from './subpanel-render-utils.ts';
import type { VolumeCandleLike } from './subpanel-volume-renderer.ts';

type PanelIdLike = SubPanelId | string;
type NumberSeries = Array<number | null>;

interface PeriodSetting {
  period: number;
}

interface MacdSetting {
  fast: number;
  slow: number;
  signal: number;
}

interface StochasticSetting {
  kPeriod: number;
  dPeriod: number;
}

interface DmiSetting extends PeriodSetting {
  topThreshold?: number | string;
  bottomThreshold?: number | string;
  axisMode?: string;
}

interface CvdSetting {
  barMode?: boolean;
}

export interface SubPanelIndicatorSettings {
  rsi: PeriodSetting;
  dmi: DmiSetting;
  macd: MacdSetting;
  stochF: StochasticSetting;
  stochS: StochasticSetting;
  cci: PeriodSetting;
  atr: PeriodSetting;
  cvd?: CvdSetting;
}

export interface SubPanelHostChart {
  startIndex: number;
  endIndex: number;
  dmiScaleRange: { lo: number; hi: number } | null;
  subIndicatorAlerts: SubIndicatorAlertLike[];
  subIndicatorAlertHitAreas: SubIndicatorAlertHitArea[];
  config?: {
    candleStyle?: {
      upColor?: string;
      downColor?: string;
    };
  };
  getPanelRatio: (id: PanelIdLike) => number;
  getSubPanelScaledRange: (id: PanelIdLike, lo: number, hi: number) => { lo: number; hi: number };
}

export interface RenderSubPanelsParams {
  ctx: CanvasRenderingContext2D;
  ind: SubPanelIndicatorSettings;
  rsiD: NumberSeries;
  dmiD: DmiResult;
  macdD: MacdResult;
  stFD: StochasticResult | null | undefined;
  stSD: StochasticResult | null | undefined;
  cciD: NumberSeries;
  atrD: NumberSeries;
  obvD: number[];
  obvSignal9: NullableSeries;
  cvdD: number[];
  cvdSignal9: NullableSeries;
  showLine: (key: string) => boolean;
  resolveStyle: ResolveIndicatorStyle;
  chartLeft: number;
  chartRight: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  visData: VolumeCandleLike[];
  vScaleMax: number;
  panels: PanelIdLike[];
  panelTops: Record<string, number>;
  plotHeight: number;
  hiddenPanels: Set<PanelIdLike>;
  yAxisTransparent: boolean;
  width: number;
  subChartW: number;
  subChartRight: number;
  subAxisStart: number;
  geometry: { axisPad: number };
  subLine: SubPanelRenderContext['subLine'];
  subHorizontalLine: SubPanelRenderContext['subHorizontalLine'];
  getSubPlotBounds: (top: number, panelHeight: number) => SubPanelPlotBounds;
  formatKUnit: (value: number, digits: number) => string;
  formatWithComma: (value: number, digits?: number) => string;
  chartTextSecondary: string;
  fontStack: string;
}

function getPanelTitle(id: PanelIdLike, ind: SubPanelIndicatorSettings): string {
  if (id === 'volume') return 'Volume';
  if (id === 'rsi') return `RSI(${ind.rsi.period})`;
  if (id === 'dmi') return `DMI(${ind.dmi.period})`;
  if (id === 'macd') return `MACD(${ind.macd.fast},${ind.macd.slow},${ind.macd.signal})`;
  if (id === 'stochF') return `Stoch Fast(${ind.stochF.kPeriod},${ind.stochF.dPeriod})`;
  if (id === 'stochS') return `Stoch Slow(${ind.stochS.kPeriod},${ind.stochS.dPeriod})`;
  if (id === 'cci') return `CCI(${ind.cci.period})`;
  if (id === 'atr') return `ATR(${ind.atr.period})`;
  if (id === 'obv') return 'OBV';
  return INDICATOR_CATALOG.find(item => item.id === id)?.label ?? id.toUpperCase();
}

export function renderSubPanels(chart: SubPanelHostChart, params: RenderSubPanelsParams): void {
  const {
    ctx,
    ind,
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
    showLine,
    resolveStyle,
    chartLeft,
    chartRight,
    effectiveChartLeft,
    totalSp,
    candleW,
    visData,
    vScaleMax,
    panels,
    panelTops,
    plotHeight,
    hiddenPanels,
    yAxisTransparent,
    width,
    subChartW,
    subChartRight,
    subAxisStart,
    geometry,
    subLine,
    subHorizontalLine,
    getSubPlotBounds,
    formatKUnit,
    formatWithComma,
    chartTextSecondary,
    fontStack,
  } = params;

  const showCanvasPanelTitles = false;
  const subLabel = createSubPanelLabelRenderer({ ctx, visible: showCanvasPanelTitles, fontStack, defaultColor: chartTextSecondary });
  const drawPanelLegend = createSubPanelLegendRenderer({ ctx, visible: showCanvasPanelTitles, fontStack, textColor: chartTextSecondary });
  const subGrid = createSubGridRenderer({
    ctx,
    chartLeft,
    subChartRight,
    subAxisStart,
    fontStack,
    textColor: chartTextSecondary,
    getSubPlotBounds,
    formatDefault: (value) => formatWithComma(value, 0),
  });
  const drawSubAxisValue = createSubAxisValueRenderer({
    ctx,
    width,
    axisPad: geometry.axisPad,
    fontStack,
    getSubPlotBounds,
  });
  const drawSubAlertLines = createSubAlertLinesRenderer({
    ctx,
    alerts: chart.subIndicatorAlerts,
    hitAreas: chart.subIndicatorAlertHitAreas,
    chartLeft,
    subChartRight,
    width,
    axisPad: geometry.axisPad,
    fontStack,
    getSubPlotBounds,
    formatVolume: (value) => formatKUnit(value, 2),
  });

  for (const id of panels) {
    const top = panelTops[id];
    const pH = plotHeight * chart.getPanelRatio(id);
    const scaleRange = (lo: number, hi: number) => chart.getSubPanelScaledRange(id, lo, hi);
    if (hiddenPanels.has(id)) {
      subLabel(getPanelTitle(id, ind), top);
      ctx.save();
      ctx.strokeStyle = '#2a2e3e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, top);
      ctx.lineTo(chartRight, top);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(-1, top - 1, width + 2, pH + 2);
    ctx.clip();

    if (!yAxisTransparent) {
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(subAxisStart, top, geometry.axisPad, pH);
      ctx.strokeStyle = '#2a3142';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(subAxisStart - 0.5, top);
      ctx.lineTo(subAxisStart - 0.5, top + pH);
      ctx.stroke();
      ctx.restore();
    }

    const subPanelContext: SubPanelRenderContext = {
      ctx,
      top,
      panelHeight: pH,
      chartLeft,
      subChartWidth: subChartW,
      effectiveChartLeft,
      totalSp,
      candleW,
      startIndex: chart.startIndex,
      endIndex: chart.endIndex,
      visLength: visData.length,
      drawPanelLegend,
      subGrid,
      subLine,
      subHorizontalLine,
      drawSubAlertLines,
      drawSubAxisValue,
      getSubPlotBounds,
      scaleRange,
      showLine,
      resolveStyle,
    };

    if (id === 'volume') {
      renderVolumePanel({
        ...subPanelContext,
        scaleMax: vScaleMax,
        label: subLabel,
        formatVolume: (value) => formatKUnit(value, 2),
      });
    }
    if (id === 'rsi') {
      renderRsiPanel({ ...subPanelContext, period: ind.rsi.period, data: rsiD });
    }
    if (id === 'dmi') {
      const dmiTopThresholdRaw = Number(ind.dmi.topThreshold);
      const dmiBottomThresholdRaw = Number(ind.dmi.bottomThreshold);
      const dmiTopThreshold = Number.isFinite(dmiTopThresholdRaw) ? dmiTopThresholdRaw : 30;
      const dmiBottomThreshold = Number.isFinite(dmiBottomThresholdRaw) ? dmiBottomThresholdRaw : 20;
      const dmiAxisMode = ind.dmi.axisMode === 'fixed' ? 'fixed' : 'auto';
      chart.dmiScaleRange = renderDmiPanel({
        ...subPanelContext,
        period: ind.dmi.period,
        data: dmiD,
        topThreshold: dmiTopThreshold,
        bottomThreshold: dmiBottomThreshold,
        axisMode: dmiAxisMode,
        currentScaleRange: chart.dmiScaleRange,
        getSubAxisSnapUnit,
      });
    }
    if (id === 'macd') {
      renderMacdPanel({
        ...subPanelContext,
        fast: ind.macd.fast,
        slow: ind.macd.slow,
        signal: ind.macd.signal,
        data: macdD,
      });
    }
    if (id === 'stochF' && stFD) {
      renderStochasticPanel({
        ...subPanelContext,
        panelId: 'stochF',
        title: `Stoch Fast(${ind.stochF.kPeriod},${ind.stochF.dPeriod})`,
        kStyleKey: 'stochFastK',
        dStyleKey: 'stochFastD',
        baselineStyleKey: 'stochFastBaseline',
        data: stFD,
      });
    }
    if (id === 'stochS' && stSD) {
      renderStochasticPanel({
        ...subPanelContext,
        panelId: 'stochS',
        title: `Stoch Slow(${ind.stochS.kPeriod},${ind.stochS.dPeriod})`,
        kStyleKey: 'stochSlowK',
        dStyleKey: 'stochSlowD',
        baselineStyleKey: 'stochSlowBaseline',
        data: stSD,
      });
    }
    if (id === 'cci') {
      renderCciPanel({ ...subPanelContext, period: ind.cci.period, data: cciD });
    }
    if (id === 'atr') {
      renderAtrPanel({ ...subPanelContext, period: ind.atr.period, data: atrD });
    }
    if (id === 'obv') {
      renderObvPanel({ ...subPanelContext, data: obvD, signal9: obvSignal9 });
    }
    if (id === 'cvd') {
      renderCvdPanel({
        ...subPanelContext,
        data: cvdD,
        signal9: cvdSignal9,
        barMode: Boolean(ind.cvd?.barMode),
        upColor: chart.config?.candleStyle?.upColor ?? '#22ab94',
        downColor: chart.config?.candleStyle?.downColor ?? '#f23645',
      });
    }

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#2a2e3e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartLeft, top);
    ctx.lineTo(chartRight, top);
    ctx.stroke();
    ctx.restore();
  }
}
