import type { DrawingAnchor, DrawingDraft, DrawingShape } from '../../../ui/workspace/drawing-types.ts';

export interface HasMeaningfulDraftMoveParams {
  a: DrawingAnchor;
  b?: DrawingAnchor;
  maxPrice: number;
  minIndexDelta?: number;
}

export function hasMeaningfulDraftMove(params: HasMeaningfulDraftMoveParams): boolean {
  const {
    a,
    b,
    maxPrice,
    minIndexDelta = 0.2,
  } = params;
  return Math.abs(a.index - (b?.index ?? a.index)) > minIndexDelta
    || Math.abs(a.price - (b?.price ?? a.price)) > Math.max(1e-6, maxPrice * 0.0005);
}

function getDraftColor(kind: DrawingDraft['kind']): string {
  if (kind === 'draw-pencil') return '#6ea8ff';
  if (kind === 'draw-highlighter') return 'rgba(255,234,86,0.4)';
  if (kind === 'draw-box') return 'rgba(126,166,255,0.20)';
  return '#2f6cff';
}

function getDraftWidth(kind: DrawingDraft['kind']): number {
  return kind === 'draw-highlighter' ? 8 : 2;
}

export function createDrawingFromDraft(draft: DrawingDraft): DrawingShape {
  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: draft.kind,
    a: draft.a,
    b: draft.b,
    points: draft.points ? draft.points.map((point) => ({ ...point })) : undefined,
    color: getDraftColor(draft.kind),
    width: getDraftWidth(draft.kind),
    lineStyle: 'solid',
    channelOffset: draft.kind === 'fib-trend' ? draft.channelOffset : undefined,
    alert: {
      enabled: false,
      mode: 'up',
      target: 'trendline',
      appPush: false,
      onsite: true,
      sound: false,
    },
  };
}

export type FinishDrawingDraftResult =
  | { status: 'skip-measure' }
  | { status: 'not-moved' }
  | { status: 'created'; shape: DrawingShape };

export function finishDrawingDraft(draft: DrawingDraft, maxPrice: number): FinishDrawingDraftResult {
  if (draft.kind === 'measure') return { status: 'skip-measure' };
  const moved = hasMeaningfulDraftMove({
    a: draft.a,
    b: draft.b,
    maxPrice,
  });
  if (!moved) return { status: 'not-moved' };
  return {
    status: 'created',
    shape: createDrawingFromDraft(draft),
  };
}
