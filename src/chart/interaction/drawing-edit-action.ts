import type { DrawingHitPart, DrawingShape } from '../../ui/workspace/drawing-types.ts';

export interface DrawingHitTarget {
  shape: DrawingShape;
  part: DrawingHitPart;
}

export type DrawingDoubleClickAction =
  | { type: 'edit-trendline-text'; shape: DrawingShape; part: DrawingHitPart }
  | { type: 'edit-text-note'; shape: DrawingShape; part: 'body' }
  | { type: 'none' };

export function resolveDrawingDoubleClickAction(
  hitDrawing: DrawingHitTarget | null,
  isTextEditableDrawing: (shape: DrawingShape) => boolean,
): DrawingDoubleClickAction {
  if (!hitDrawing) return { type: 'none' };
  if (isTextEditableDrawing(hitDrawing.shape)) {
    return {
      type: 'edit-trendline-text',
      shape: hitDrawing.shape,
      part: hitDrawing.part === 'start' || hitDrawing.part === 'end' ? 'body' : hitDrawing.part,
    };
  }
  if (hitDrawing.shape.kind === 'text-note') {
    return {
      type: 'edit-text-note',
      shape: hitDrawing.shape,
      part: 'body',
    };
  }
  return { type: 'none' };
}

export type DrawingMouseDownEditAction =
  | { type: 'edit-anchored-vwap'; shape: DrawingShape; part: 'start' }
  | { type: 'edit-position-settings'; shape: DrawingShape; part: DrawingHitPart }
  | { type: 'edit-trendline-text'; shape: DrawingShape; part: 'trendline-text-guide' }
  | { type: 'none' };

export interface ResolveDrawingMouseDownEditActionParams {
  hitDrawing: DrawingHitTarget | null;
  clickDetail: number;
  drawingToolActive: boolean;
  hoveredGuideShape: DrawingShape | null;
  isTextEditableDrawing: (shape: DrawingShape) => boolean;
}

export function resolveDrawingMouseDownEditAction(
  params: ResolveDrawingMouseDownEditActionParams,
): DrawingMouseDownEditAction {
  const {
    hitDrawing,
    clickDetail,
    drawingToolActive,
    hoveredGuideShape,
    isTextEditableDrawing,
  } = params;

  if (
    hitDrawing
    && hitDrawing.shape.kind === 'anchored-vwap'
    && hitDrawing.part === 'start'
    && clickDetail >= 2
  ) {
    return { type: 'edit-anchored-vwap', shape: hitDrawing.shape, part: 'start' };
  }

  if (
    hitDrawing
    && (hitDrawing.shape.kind === 'long-position' || hitDrawing.shape.kind === 'short-position')
    && hitDrawing.part === 'position-entry-info'
    && clickDetail >= 2
  ) {
    return { type: 'edit-position-settings', shape: hitDrawing.shape, part: hitDrawing.part };
  }

  if (
    hoveredGuideShape
    && (!hitDrawing || (isTextEditableDrawing(hitDrawing.shape) && hitDrawing.shape.id === hoveredGuideShape.id))
  ) {
    return { type: 'edit-trendline-text', shape: hoveredGuideShape, part: 'trendline-text-guide' };
  }

  if (
    !drawingToolActive
    && hitDrawing
    && isTextEditableDrawing(hitDrawing.shape)
    && hitDrawing.part === 'trendline-text-guide'
  ) {
    return { type: 'edit-trendline-text', shape: hitDrawing.shape, part: 'trendline-text-guide' };
  }

  return { type: 'none' };
}
