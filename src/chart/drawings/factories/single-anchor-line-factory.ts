import type { DrawingAnchor, DrawingShape, SingleAnchorLineDrawingToolId } from '../../../ui/workspace/drawing-types.ts';

export interface CreateSingleAnchorLineDrawingParams {
  kind: SingleAnchorLineDrawingToolId;
  anchor: DrawingAnchor | null;
  fallbackIndex: number;
  fallbackPrice: number;
  width: number;
  color?: string;
}

export function createSingleAnchorLineDrawing(params: CreateSingleAnchorLineDrawingParams): DrawingShape {
  const {
    kind,
    anchor,
    fallbackIndex,
    fallbackPrice,
    width,
    color = '#2962ff',
  } = params;

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    a: {
      index: anchor?.index ?? fallbackIndex,
      price: anchor?.price ?? fallbackPrice,
    },
    color,
    width,
    lineStyle: 'solid',
  };
}
