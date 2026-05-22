import type { RenderIndicatorBlocksParams } from './indicator-layer-orchestrator.ts';

export type IndicatorRenderInput = {
  main: Omit<RenderIndicatorBlocksParams['main'], 'startIndex' | 'pixelRatio' | 'resolveStyle'>;
  volumeOverlay: Omit<RenderIndicatorBlocksParams['volumeOverlay'], 'getSubPanelScaledRange' | 'candleStyle'>;
  subPanels: Omit<RenderIndicatorBlocksParams['subPanels'], 'resolveStyle'>;
};

type IndicatorRenderSharedInput = Pick<
  IndicatorRenderInput['main'],
  'ctx' | 'ind' | 'showLine' | 'chartLeft' | 'effectiveChartLeft' | 'chartRight' | 'totalSp' | 'candleW' | 'visData' | 'fontStack'
>;

type IndicatorRenderVolumeSharedKeys =
  | 'ctx'
  | 'ind'
  | 'showLine'
  | 'chartLeft'
  | 'effectiveChartLeft'
  | 'totalSp'
  | 'candleW'
  | 'visData';

export type IndicatorRenderGroupedInput = {
  shared: IndicatorRenderSharedInput;
  main: Omit<IndicatorRenderInput['main'], keyof IndicatorRenderSharedInput>;
  volumeOverlay: Omit<IndicatorRenderInput['volumeOverlay'], IndicatorRenderVolumeSharedKeys>;
  subPanels: Omit<IndicatorRenderInput['subPanels'], keyof IndicatorRenderSharedInput>;
};

export interface IndicatorRenderContext {
  subPanelHost: RenderIndicatorBlocksParams['subPanelHost'];
  startIndex: RenderIndicatorBlocksParams['main']['startIndex'];
  pixelRatio: RenderIndicatorBlocksParams['main']['pixelRatio'];
  resolveStyle: RenderIndicatorBlocksParams['main']['resolveStyle'];
  getSubPanelScaledRange: RenderIndicatorBlocksParams['volumeOverlay']['getSubPanelScaledRange'];
  candleStyle: RenderIndicatorBlocksParams['volumeOverlay']['candleStyle'];
}

export function buildIndicatorRenderInput(input: IndicatorRenderGroupedInput): IndicatorRenderInput {
  const {
    ctx,
    ind,
    showLine,
    chartLeft,
    effectiveChartLeft,
    chartRight,
    totalSp,
    candleW,
    visData,
    fontStack,
  } = input.shared;

  return {
    main: {
      ...input.main,
      ctx,
      ind,
      showLine,
      chartLeft,
      effectiveChartLeft,
      chartRight,
      totalSp,
      candleW,
      visData,
      fontStack,
    },
    volumeOverlay: {
      ...input.volumeOverlay,
      ctx,
      ind,
      showLine,
      chartLeft,
      effectiveChartLeft,
      totalSp,
      candleW,
      visData,
    },
    subPanels: {
      ...input.subPanels,
      ctx,
      ind,
      showLine,
      chartLeft,
      effectiveChartLeft,
      chartRight,
      totalSp,
      candleW,
      visData,
      fontStack,
    },
  };
}

export function buildIndicatorRenderParams(
  input: IndicatorRenderInput,
  context: IndicatorRenderContext,
): RenderIndicatorBlocksParams {
  return {
    subPanelHost: context.subPanelHost,
    main: {
      ...input.main,
      startIndex: context.startIndex,
      pixelRatio: context.pixelRatio,
      resolveStyle: context.resolveStyle,
    },
    volumeOverlay: {
      ...input.volumeOverlay,
      getSubPanelScaledRange: context.getSubPanelScaledRange,
      candleStyle: context.candleStyle,
    },
    subPanels: {
      ...input.subPanels,
      resolveStyle: context.resolveStyle,
    },
  };
}
