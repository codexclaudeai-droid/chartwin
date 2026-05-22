import type { DrawingAnchor, DrawingShape } from '../../../ui/workspace/drawing-types.ts';

export type PositionDrawingKind = 'long-position' | 'short-position';

export interface CreatePositionDrawingParams {
  kind: PositionDrawingKind;
  anchor: DrawingAnchor;
  defaultRisk: number;
  defaultBars: number;
  color?: string;
}

export function createPositionDrawing(params: CreatePositionDrawingParams): DrawingShape {
  const {
    kind,
    anchor,
    defaultRisk,
    defaultBars,
    color = '#2f6cff',
  } = params;
  const isLong = kind === 'long-position';
  const stopPrice = isLong ? (anchor.price - defaultRisk) : (anchor.price + defaultRisk);
  const targetPrice = isLong ? (anchor.price + defaultRisk) : (anchor.price - defaultRisk);

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    a: { index: anchor.index, price: anchor.price },
    b: { index: anchor.index, price: stopPrice },
    channelOffset: { index: defaultBars, price: targetPrice - anchor.price },
    color,
    width: 2,
    lineStyle: 'solid',
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
