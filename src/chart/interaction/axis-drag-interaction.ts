export interface ResolveXAxisDragRangeParams {
  clientX: number;
  dragStartX: number;
  dragStartVisible: number;
  dragStartIndex: number;
  dataLength: number;
}

export interface ChartRange {
  startIndex: number;
  endIndex: number;
}

export function resolveXAxisDragRange(params: ResolveXAxisDragRangeParams): ChartRange {
  const {
    clientX,
    dragStartX,
    dragStartVisible,
    dragStartIndex,
    dataLength,
  } = params;
  const dx = clientX - dragStartX;
  const minVisible = 5;
  const maxVisible = dataLength || 1;
  const newVisible = Math.max(
    minVisible,
    Math.min(maxVisible, Math.round(dragStartVisible * Math.exp(-dx * 0.008))),
  );
  const mid = dragStartIndex + dragStartVisible / 2;
  const newStart = Math.round(mid - newVisible / 2);
  const clampedStart = Math.max(0, Math.min(maxVisible - newVisible, newStart));
  return {
    startIndex: clampedStart,
    endIndex: clampedStart + newVisible,
  };
}

export function resolveMainYAxisDragScale(clientY: number, dragStartY: number, dragStartFactor: number): number {
  const dy = clientY - dragStartY;
  return Math.max(0.1, Math.min(20, dragStartFactor * Math.exp(dy * 0.005)));
}

export function resolveSubYAxisDragScale(clientY: number, dragStartY: number, dragStartFactor: number): number {
  const dy = clientY - dragStartY;
  return Math.max(0.05, Math.min(20, dragStartFactor * Math.exp(dy * 0.005)));
}
