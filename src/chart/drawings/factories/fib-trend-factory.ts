import type { DrawingAnchor, DrawingShape } from '../../../ui/workspace/drawing-types.ts';

export interface CreateFibTrendDrawingParams {
  a: DrawingAnchor;
  b: DrawingAnchor;
  offsetAnchor: DrawingAnchor;
  color?: string;
}

export function createFibTrendDrawing(params: CreateFibTrendDrawingParams): DrawingShape {
  const {
    a,
    b,
    offsetAnchor,
    color = '#2f6cff',
  } = params;

  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'fib-trend',
    a,
    b,
    channelOffset: {
      index: offsetAnchor.index - a.index,
      price: offsetAnchor.price - a.price,
    },
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
