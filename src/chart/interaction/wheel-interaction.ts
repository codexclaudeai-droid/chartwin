export interface MainViewportWheelMetrics {
  chartLeft: number;
  chartRight: number;
}

export interface ResolveWheelInteractionParams {
  deltaX: number;
  deltaY: number;
  mouseX: number;
  onMainYAxis: boolean;
  yScaleFactor: number;
  startIndex: number;
  endIndex: number;
  dataLength: number;
  mainViewportMetrics: MainViewportWheelMetrics | null;
  normalizeHorizontalVirtualStart: (virtualStart: number, baseVirtualStart: number) => number;
  clampPanStartIndex: (startIndex: number, visibleCount: number) => number;
}

export type WheelInteractionResult =
  | {
      type: 'y-scale';
      yScaleFactor: number;
    }
  | {
      type: 'range';
      startIndex: number;
      endIndex: number;
    };

export function resolveWheelInteraction(params: ResolveWheelInteractionParams): WheelInteractionResult {
  const {
    deltaX,
    deltaY,
    mouseX,
    onMainYAxis,
    yScaleFactor,
    startIndex,
    endIndex,
    dataLength,
    mainViewportMetrics,
    normalizeHorizontalVirtualStart,
    clampPanStartIndex,
  } = params;

  if (Math.abs(deltaY) >= Math.abs(deltaX) && onMainYAxis) {
    const factor = deltaY > 0 ? 1.1 : (1 / 1.1);
    return {
      type: 'y-scale',
      yScaleFactor: Math.max(0.1, Math.min(20, yScaleFactor * factor)),
    };
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    const shift = Math.floor(deltaX / 5);
    const visibleCount = Math.max(1, endIndex - startIndex);
    const nextStart = normalizeHorizontalVirtualStart(startIndex + shift, startIndex);
    const clampedStart = clampPanStartIndex(nextStart, visibleCount);
    return {
      type: 'range',
      startIndex: clampedStart,
      endIndex: clampedStart + visibleCount,
    };
  }

  const minVisible = 5;
  const maxVisible = dataLength;
  const currentVisible = Math.max(minVisible, endIndex - startIndex);
  const zoomStep = Math.max(8, Math.min(64, Math.round(currentVisible * 0.06)));
  const zoomOut = deltaY > 0;
  const nextVisible = zoomOut
    ? Math.min(maxVisible, currentVisible + zoomStep)
    : Math.max(minVisible, currentVisible - zoomStep);

  if (mainViewportMetrics && nextVisible !== currentVisible) {
    const chartWidth = Math.max(1, mainViewportMetrics.chartRight - mainViewportMetrics.chartLeft);
    const ratio = Math.max(0, Math.min(1, (mouseX - mainViewportMetrics.chartLeft) / chartWidth));
    const newStart = Math.round(startIndex + ratio * (currentVisible - nextVisible));
    const clampedStart = Math.max(0, Math.min(dataLength - nextVisible, newStart));
    return {
      type: 'range',
      startIndex: clampedStart,
      endIndex: clampedStart + nextVisible,
    };
  }

  const fallbackEnd = dataLength;
  return {
    type: 'range',
    startIndex: Math.max(0, fallbackEnd - nextVisible),
    endIndex: fallbackEnd,
  };
}
