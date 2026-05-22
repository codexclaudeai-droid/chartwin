import type { DrawingAnchor } from '../../ui/workspace/drawing-types.ts';
import { isPointInCircle, type CircularHitArea } from './pointer-hit-test.ts';

export interface CrosshairHlineHitArea extends CircularHitArea {
  price: number;
}

export interface ResolveCrosshairHlineActionParams {
  mouseX: number;
  mouseY: number;
  hitArea: CrosshairHlineHitArea | null;
  getAnchor: () => DrawingAnchor | null;
  fallbackIndex: number;
}

export type CrosshairHlineAction =
  | {
      type: 'create-hline';
      anchor: DrawingAnchor | null;
      fallbackIndex: number;
      price: number;
    }
  | { type: 'none' };

export function resolveCrosshairHlineAction(params: ResolveCrosshairHlineActionParams): CrosshairHlineAction {
  const {
    mouseX,
    mouseY,
    hitArea,
    getAnchor,
    fallbackIndex,
  } = params;

  if (!hitArea || !isPointInCircle(hitArea, mouseX, mouseY)) return { type: 'none' };
  return {
    type: 'create-hline',
    anchor: getAnchor(),
    fallbackIndex,
    price: hitArea.price,
  };
}
