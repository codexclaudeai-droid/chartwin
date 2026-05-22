import type { DrawingAnchor, DrawingDraft, DrawingShape } from '../../../ui/workspace/drawing-types.ts';
import { hasMeaningfulDraftMove } from './drawing-draft-factory.ts';

export interface CreateMeasureDrawingParams {
  a: DrawingAnchor;
  b: DrawingAnchor;
  color?: string;
  width?: number;
}

export function createMeasureDrawing(params: CreateMeasureDrawingParams): DrawingShape {
  const {
    a,
    b,
    color = '#2f6cff',
    width = 1.5,
  } = params;

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'measure',
    a,
    b,
    color,
    width,
    lineStyle: 'solid',
  };
}

export type MeasureDraftClickResult =
  | { type: 'start'; draft: DrawingDraft }
  | { type: 'created'; shape: DrawingShape }
  | { type: 'not-moved' };

export function resolveMeasureDraftClick(
  currentDraft: DrawingDraft | null,
  anchor: DrawingAnchor,
  maxPrice: number,
): MeasureDraftClickResult {
  const snappedAnchor: DrawingAnchor = { index: Math.round(anchor.index), price: anchor.price };
  if (!currentDraft || currentDraft.kind !== 'measure') {
    return {
      type: 'start',
      draft: {
        kind: 'measure',
        a: snappedAnchor,
        b: snappedAnchor,
      },
    };
  }

  const nextDraft = {
    ...currentDraft,
    b: snappedAnchor,
  };
  if (!hasMeaningfulDraftMove({ a: nextDraft.a, b: nextDraft.b, maxPrice })) {
    return { type: 'not-moved' };
  }
  return {
    type: 'created',
    shape: createMeasureDrawing({ a: nextDraft.a, b: nextDraft.b }),
  };
}
