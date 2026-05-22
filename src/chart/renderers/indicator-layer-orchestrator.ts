import {
  renderMainIndicators,
  type RenderMainIndicatorsParams,
} from './main-indicator-orchestrator.ts';
import { renderSubPanels, type RenderSubPanelsParams, type SubPanelHostChart } from './subpanel-render-orchestrator.ts';
import { renderVolumeBarsOverlay } from './subpanel-volume-renderer.ts';

export interface RenderIndicatorLayersParams {
  subPanelHost: SubPanelHostChart;
  main: RenderMainIndicatorsParams;
  subPanels: RenderSubPanelsParams;
  volumeOverlay: {
    ctx: CanvasRenderingContext2D;
    enabled: boolean;
    visData: RenderMainIndicatorsParams['visData'];
    visRawData: Array<{ volume?: number } | undefined>;
    chartLeft: number;
    chartWidth: number;
    effectiveChartLeft: number;
    top: number;
    height: number;
    totalSp: number;
    candleW: number;
    lo: number;
    hi: number;
    upColor: string;
    downColor: string;
  };
}

type IndicatorBlockSubPanelParams = RenderIndicatorLayersParams['subPanels'];
type IndicatorBlockVolumeOverlayParams = RenderIndicatorLayersParams['volumeOverlay'];

export interface RenderIndicatorVolumeOverlayInput
  extends Omit<IndicatorBlockVolumeOverlayParams, 'enabled' | 'lo' | 'hi' | 'upColor' | 'downColor'> {
  ind: RenderIndicatorLayersParams['main']['ind'];
  showLine: IndicatorBlockSubPanelParams['showLine'];
  vScaleMax: IndicatorBlockSubPanelParams['vScaleMax'];
  getSubPanelScaledRange: (panelId: string, lo: number, hi: number) => { lo: number; hi: number };
  candleStyle?: {
    upColor?: string;
    downColor?: string;
  };
}

export interface RenderIndicatorBlocksParams {
  subPanelHost: SubPanelHostChart;
  main: RenderIndicatorLayersParams['main'];
  volumeOverlay: RenderIndicatorVolumeOverlayInput;
  subPanels: RenderIndicatorLayersParams['subPanels'];
}

export function renderIndicatorLayers(params: RenderIndicatorLayersParams): void {
  const { subPanelHost, main, volumeOverlay, subPanels } = params;
  renderMainIndicators(main);
  main.ctx.restore();
  renderVolumeBarsOverlay(volumeOverlay);
  renderSubPanels(subPanelHost, subPanels);
}

function buildVolumeOverlayParams(
  params: RenderIndicatorVolumeOverlayInput,
): RenderIndicatorLayersParams['volumeOverlay'] {
  const {
    ctx,
    ind,
    showLine,
    chartLeft,
    effectiveChartLeft = chartLeft,
    totalSp,
    candleW,
    visData,
    vScaleMax,
    height,
    top,
    chartWidth,
    visRawData,
    getSubPanelScaledRange,
    candleStyle,
  } = params;
  const { lo: volumeLo, hi: volumeHi } = getSubPanelScaledRange('volume', 0, vScaleMax);

  return {
    ctx,
    enabled: ind.volume.show && showLine('volumeBars'),
    visData,
    visRawData,
    chartLeft,
    chartWidth,
    effectiveChartLeft,
    top,
    height,
    totalSp,
    candleW,
    lo: volumeLo,
    hi: volumeHi,
    upColor: candleStyle?.upColor ?? '#22ab94',
    downColor: candleStyle?.downColor ?? '#f23645',
  };
}

export function renderIndicatorBlocks(params: RenderIndicatorBlocksParams): void {
  renderIndicatorLayers({
    subPanelHost: params.subPanelHost,
    main: params.main,
    volumeOverlay: buildVolumeOverlayParams(params.volumeOverlay),
    subPanels: params.subPanels,
  });
}
