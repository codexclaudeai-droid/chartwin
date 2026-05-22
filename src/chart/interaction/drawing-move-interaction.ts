import type { DrawingHitPart, DrawingShape } from '../../ui/workspace/drawing-types.ts';

export interface DrawingMoveStateLike {
  startX: number;
  startY: number;
  baseShape: DrawingShape;
}

export interface ApplyDrawingMoveParams {
  pointerX: number;
  pointerY: number;
  moveState: DrawingMoveStateLike;
  selectedPart: DrawingHitPart;
  currentMoveDistance: number;
  moveShapeByDelta: (baseShape: DrawingShape, dx: number, dy: number, part: DrawingHitPart) => DrawingShape;
}

export interface ApplyDrawingMoveResult {
  movedShape: DrawingShape;
  moveDistance: number;
  dx: number;
  dy: number;
}

export function applyDrawingMove(params: ApplyDrawingMoveParams): ApplyDrawingMoveResult {
  const {
    pointerX,
    pointerY,
    moveState,
    selectedPart,
    currentMoveDistance,
    moveShapeByDelta,
  } = params;
  const dx = pointerX - moveState.startX;
  const dy = pointerY - moveState.startY;
  return {
    dx,
    dy,
    moveDistance: Math.max(currentMoveDistance, Math.hypot(dx, dy)),
    movedShape: moveShapeByDelta(moveState.baseShape, dx, dy, selectedPart),
  };
}

export interface ResolveDrawingMoveEndParams {
  moveState: DrawingMoveStateLike;
  moveDistance: number;
  textNoteTapThreshold: number;
  pendingChannelId: string | null;
  selectedDrawingId: string | null;
  selectedPart: DrawingHitPart;
}

export interface DrawingMoveEndResolution {
  baseShape: DrawingShape;
  wasClickOnly: boolean;
  shouldDisarmPendingChannel: boolean;
}

export function resolveDrawingMoveEnd(params: ResolveDrawingMoveEndParams): DrawingMoveEndResolution {
  const {
    moveState,
    moveDistance,
    textNoteTapThreshold,
    pendingChannelId,
    selectedDrawingId,
    selectedPart,
  } = params;
  const baseShape = moveState.baseShape;
  return {
    baseShape,
    wasClickOnly: baseShape.kind === 'text-note'
      ? moveDistance < textNoteTapThreshold
      : moveDistance < 4,
    shouldDisarmPendingChannel: Boolean(
      pendingChannelId
      && selectedDrawingId === pendingChannelId
      && selectedPart === 'channel-offset',
    ),
  };
}
