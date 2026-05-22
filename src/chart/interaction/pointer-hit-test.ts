export interface CircularHitArea {
  x: number;
  y: number;
  r: number;
}

export function isPointInCircle(area: CircularHitArea, x: number, y: number, extraRadius = 0): boolean {
  const dx = x - area.x;
  const dy = y - area.y;
  const radius = area.r + extraRadius;
  return dx * dx + dy * dy <= radius * radius;
}
