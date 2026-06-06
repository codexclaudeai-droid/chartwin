import type { DrawingAnchor, DrawingShape, PatternDrawingToolId } from '../../../ui/workspace/drawing-types.ts';
import { getPatternPointCount } from '../../../ui/workspace/drawing-utils.ts';

function getPatternDefaultColor(kind: PatternDrawingToolId): string {
  if (kind === 'head-shoulders-pattern') return '#00a68f';
  if (kind === 'abcd-pattern') return '#00a68f';
  if (kind === 'triangle-pattern') return '#7c4dff';
  if (kind === 'three-drives-pattern') return '#7c4dff';
  return '#2f6cff';
}

export function createPatternDrawing(params: {
  kind: PatternDrawingToolId;
  points: DrawingAnchor[];
}): DrawingShape | null {
  const count = getPatternPointCount(params.kind);
  if (params.points.length < count) return null;
  const points = params.points.slice(0, count).map((point) => ({ ...point }));
  return {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: params.kind,
    a: points[0],
    b: points[points.length - 1],
    points,
    color: getPatternDefaultColor(params.kind),
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
