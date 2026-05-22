import type { AnchoredVwapSettings, DrawingAnchor, DrawingShape } from '../../../ui/workspace/drawing-types.ts';

export interface CreateAnchoredVwapDrawingParams {
  anchor: DrawingAnchor;
  settings: AnchoredVwapSettings;
  color?: string;
}

export function createAnchoredVwapDrawing(params: CreateAnchoredVwapDrawingParams): DrawingShape {
  const {
    anchor,
    settings,
    color = '#2f6cff',
  } = params;

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'anchored-vwap',
    a: { index: Math.round(anchor.index), price: anchor.price },
    color,
    width: 1,
    lineStyle: 'solid',
    avwap: settings,
  };
}
