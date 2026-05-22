import type { DrawingAnchor, DrawingShape } from '../../../ui/workspace/drawing-types.ts';

export interface CreateHlineDrawingParams {
  anchor: DrawingAnchor | null;
  fallbackIndex: number;
  price: number;
  width: number;
  color?: string;
}

export function createHlineDrawing(params: CreateHlineDrawingParams): DrawingShape {
  const {
    anchor,
    fallbackIndex,
    price,
    width,
    color = '#2962ff',
  } = params;

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'hline',
    a: { index: anchor?.index ?? fallbackIndex, price },
    color,
    width,
    lineStyle: 'solid',
  };
}
