import type { DrawingAnchor, DrawingShape } from '../../../ui/workspace/drawing-types.ts';

export interface CreateTextNoteDrawingParams {
  anchor: DrawingAnchor;
  text?: string;
  color?: string;
}

export function createTextNoteDrawing(params: CreateTextNoteDrawingParams): DrawingShape {
  const {
    anchor,
    text = '',
    color = '#2f6cff',
  } = params;

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'text-note',
    a: anchor,
    text,
    color,
    width: 2,
    lineStyle: 'solid',
  };
}
