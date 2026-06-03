export interface ResolveCrosshairGuideVisibilityParams {
  isTouchDevice: boolean;
  noDrawingInteraction: boolean;
  selectedDrawingActive: boolean;
  drawingToolActive: boolean;
  drawingMoveActive: boolean;
  isCrosshairMode: boolean;
  onYAxis: boolean;
  onXAxis: boolean;
}

export function shouldShowCrosshairGuides(params: ResolveCrosshairGuideVisibilityParams): boolean {
  const {
    isTouchDevice,
    noDrawingInteraction,
    selectedDrawingActive,
    drawingToolActive,
    drawingMoveActive,
    isCrosshairMode,
    onYAxis,
    onXAxis,
  } = params;

  if (onYAxis || onXAxis) return false;
  if (isTouchDevice) {
    return isCrosshairMode && noDrawingInteraction;
  }
  return noDrawingInteraction || selectedDrawingActive || drawingToolActive || drawingMoveActive;
}
