import type { DrawingHitPart, DrawingShape, DrawingToolId } from '../../ui/workspace/drawing-types.ts';
import { isPointInCircle, type CircularHitArea } from './pointer-hit-test.ts';

export type ChartPointerMode = 'auto' | 'cross' | 'dot' | 'arrow' | 'demo';
export type ActiveDrawingToolId = DrawingToolId | 'eraser';

export interface DrawingHitTarget {
  shape: Pick<DrawingShape, 'kind'>;
  part: DrawingHitPart;
}

export interface ChartCursorTokens {
  eraser: string;
  nsResize: string;
  ewResize: string;
  xAxis: string;
}

export interface ResolveChartCursorParams {
  isMouseOver: boolean;
  mouseX: number;
  mouseY: number;
  crosshairPlusHit: CircularHitArea | null;
  drawingTool: ActiveDrawingToolId | null;
  yAxisDragging: boolean;
  subYAxisDragging: boolean;
  xAxisDragging: boolean;
  isDragging: boolean;
  drawingMoveActive: boolean;
  selectedDrawingPart: DrawingHitPart;
  movingShapeKind: DrawingShape['kind'] | null;
  hitSubAlert: boolean;
  hitDrawing: DrawingHitTarget | null;
  hoveringCandle: boolean;
  onMainYAxis: boolean;
  onXAxis: boolean;
  hoveredSubIndicatorAddButton: CircularHitArea | null;
  subYAxisPanel: string | null;
  pointerMode: ChartPointerMode;
  cursors: ChartCursorTokens;
}

const anchorParts: DrawingHitPart[] = ['start', 'channel-a', 'channel-b', 'channel-offset', 'fib-offset'];

function isPositionShapeKind(kind: DrawingShape['kind'] | null): boolean {
  return kind === 'long-position' || kind === 'short-position';
}

function resolvePositionCursor(part: DrawingHitPart, cursors: ChartCursorTokens): string | null {
  if (part === 'position-target' || part === 'end' || part === 'position-stop') {
    return cursors.nsResize;
  }
  if (part === 'position-right') {
    return cursors.ewResize;
  }
  return null;
}

export function resolveChartCursor(params: ResolveChartCursorParams): string {
  const {
    isMouseOver,
    mouseX,
    mouseY,
    crosshairPlusHit,
    drawingTool,
    yAxisDragging,
    subYAxisDragging,
    xAxisDragging,
    isDragging,
    drawingMoveActive,
    selectedDrawingPart,
    movingShapeKind,
    hitSubAlert,
    hitDrawing,
    hoveringCandle,
    onMainYAxis,
    onXAxis,
    hoveredSubIndicatorAddButton,
    subYAxisPanel,
    pointerMode,
    cursors,
  } = params;

  if (!isMouseOver) return 'default';
  if (crosshairPlusHit && isPointInCircle(crosshairPlusHit, mouseX, mouseY)) return 'pointer';
  if (drawingTool) return drawingTool === 'eraser' ? cursors.eraser : 'crosshair';
  if (yAxisDragging || subYAxisDragging) return cursors.nsResize;
  if (xAxisDragging) return cursors.xAxis;
  if (isDragging) return 'grabbing';

  if (drawingMoveActive) {
    if (isPositionShapeKind(movingShapeKind)) {
      const positionCursor = resolvePositionCursor(selectedDrawingPart, cursors);
      if (positionCursor) return positionCursor;
    }
    return 'default';
  }

  if (hitSubAlert) return 'pointer';

  if (hitDrawing) {
    if (isPositionShapeKind(hitDrawing.shape.kind)) {
      const positionCursor = resolvePositionCursor(hitDrawing.part, cursors);
      if (positionCursor) return positionCursor;
    }
    if (anchorParts.includes(hitDrawing.part)) return 'default';
    return 'pointer';
  }

  if (hoveringCandle) return 'pointer';
  if (!drawingTool && !drawingMoveActive && onMainYAxis) return cursors.nsResize;
  if (!drawingTool && !drawingMoveActive && onXAxis) return cursors.xAxis;
  if (hoveredSubIndicatorAddButton && isPointInCircle(hoveredSubIndicatorAddButton, mouseX, mouseY, 4)) return 'pointer';
  if (!drawingTool && !drawingMoveActive && subYAxisPanel) return cursors.nsResize;
  if (pointerMode === 'arrow') return 'default';
  if (pointerMode === 'cross') return 'crosshair';
  if (pointerMode === 'dot') return 'none';
  if (pointerMode === 'demo') return 'default';
  return 'none';
}
