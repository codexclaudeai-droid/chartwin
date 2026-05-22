import { cloneDrawingShape } from '../../ui/workspace/drawing-utils.ts';
import type { DrawingShape } from '../../ui/workspace/drawing-types.ts';

export function cloneDrawingsSnapshot(drawings: DrawingShape[]): DrawingShape[] {
  return drawings.map((shape) => cloneDrawingShape(shape));
}

export function setDrawingsLocked(
  drawings: DrawingShape[],
  locked: boolean,
): { drawings: DrawingShape[]; changed: number } {
  let changed = 0;
  const nextDrawings = drawings.map((shape) => {
    if (Boolean(shape.locked) === locked) return shape;
    changed += 1;
    return {
      ...shape,
      locked,
    };
  });
  return { drawings: nextDrawings, changed };
}

export function clearDrawings(
  drawings: DrawingShape[],
  includeLocked: boolean,
): { drawings: DrawingShape[]; removed: number } {
  const before = drawings.length;
  const nextDrawings = includeLocked ? [] : drawings.filter((shape) => shape.locked);
  return {
    drawings: nextDrawings,
    removed: before - nextDrawings.length,
  };
}

export function findDrawingById(drawings: DrawingShape[], id: string | null): DrawingShape | null {
  if (!id) return null;
  return drawings.find((shape) => shape.id === id) ?? null;
}

export function deleteDrawingById(drawings: DrawingShape[], id: string | null): DrawingShape[] {
  if (!id) return drawings;
  return drawings.filter((shape) => shape.id !== id);
}

export function deleteDrawingsByKind(drawings: DrawingShape[], kind: DrawingShape['kind']): DrawingShape[] {
  return drawings.filter((shape) => shape.kind !== kind);
}

export function upsertDrawingShape(drawings: DrawingShape[], next: DrawingShape): DrawingShape[] {
  const index = drawings.findIndex((shape) => shape.id === next.id);
  if (index < 0) return [...drawings, next];
  const nextDrawings = drawings.slice();
  nextDrawings[index] = next;
  return nextDrawings;
}

export function hasDrawing(drawings: DrawingShape[], id: string | null): boolean {
  return Boolean(id && drawings.some((shape) => shape.id === id));
}
