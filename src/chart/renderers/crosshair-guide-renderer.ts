export type PointerMode = 'auto' | 'cross' | 'dot' | 'arrow' | 'demo';

export interface RenderCrosshairGuideParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  x: number;
  y: number;
  pointerMode: PointerMode;
  useBlueEditGuide: boolean;
}

export function renderCrosshairGuide(params: RenderCrosshairGuideParams): void {
  const {
    ctx,
    width,
    height,
    x,
    y,
    pointerMode,
    useBlueEditGuide,
  } = params;
  const guideLineColor = useBlueEditGuide ? 'rgba(47,108,255,0.90)' : 'rgba(214,219,233,0.65)';
  const guideCenterColor = useBlueEditGuide ? 'rgba(47,108,255,0.98)' : 'rgba(255,255,255,0.92)';

  ctx.save();
  ctx.strokeStyle = guideLineColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = guideCenterColor;
  ctx.lineWidth = 1.4;
  const centerLength = 10;
  if (pointerMode === 'dot') {
    ctx.fillStyle = guideCenterColor;
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (pointerMode === 'demo') {
    ctx.fillStyle = 'rgba(47,108,255,0.28)';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
  } else if (pointerMode === 'arrow' || pointerMode === 'cross') {
    // Arrow and cross modes keep dashed guides only.
  } else {
    ctx.beginPath();
    ctx.moveTo(x - centerLength, y);
    ctx.lineTo(x + centerLength, y);
    ctx.moveTo(x, y - centerLength);
    ctx.lineTo(x, y + centerLength);
    ctx.stroke();
    if (useBlueEditGuide) {
      ctx.fillStyle = '#2f6cff';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
