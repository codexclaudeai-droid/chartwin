import type { DrawingDraft, DrawingShape, DrawingToolId } from '../../ui/workspace/drawing-types.ts';

export interface RenderDrawingTouchCrosshairParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  plotHeight: number;
  xAxisHeight: number;
  isCoarsePointer: boolean;
  isMouseOver: boolean;
  mouseX: number;
  mouseY: number;
  touchCrosshairX: number;
  touchCrosshairY: number;
  drawingTool: DrawingToolId | 'eraser' | null;
  drawingDraft: DrawingDraft | null;
  drawingMoveActive: boolean;
  selectedShape: DrawingShape | null;
  textNoteEditorActive: boolean;
  touchDrawingTapCount: number;
  fontStack: string;
  textNoteAnchorPoint: { x: number; y: number } | null;
}

function getFibTrendStage(draft: DrawingDraft | null): number {
  return draft ? ((draft as DrawingDraft & { stage?: number }).stage ?? 1) : 0;
}

export function renderDrawingTouchCrosshair(params: RenderDrawingTouchCrosshairParams): void {
  const {
    ctx,
    width,
    height,
    plotHeight,
    xAxisHeight,
    isCoarsePointer,
    isMouseOver,
    mouseX,
    mouseY,
    touchCrosshairX,
    touchCrosshairY,
    drawingTool,
    drawingDraft,
    drawingMoveActive,
    selectedShape,
    textNoteEditorActive,
    touchDrawingTapCount,
    fontStack,
    textNoteAnchorPoint,
  } = params;

  const hasTouchCrosshair = touchCrosshairX > 0 || touchCrosshairY > 0;
  const isSelectedPositionShape = Boolean(
    selectedShape && (selectedShape.kind === 'long-position' || selectedShape.kind === 'short-position'),
  );
  const isTextNoteTouchInteraction = Boolean(
    selectedShape?.kind === 'text-note'
    || textNoteEditorActive,
  );
  const shouldShowDrawingCrosshair = Boolean(
    (isTextNoteTouchInteraction && !textNoteEditorActive)
    || (!isTextNoteTouchInteraction && (drawingTool || drawingMoveActive || isSelectedPositionShape)),
  );
  if (!isCoarsePointer || !shouldShowDrawingCrosshair || (!isMouseOver && !hasTouchCrosshair)) return;

  const x = textNoteAnchorPoint?.x ?? (isMouseOver ? mouseX : touchCrosshairX);
  const y = textNoteAnchorPoint?.y ?? (isMouseOver ? mouseY : touchCrosshairY);

  ctx.save();
  ctx.strokeStyle = 'rgba(64, 180, 255, 0.5)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(64, 180, 255, 0.8)';
  ctx.lineWidth = 1;
  const dotSize = 8;
  ctx.beginPath();
  ctx.moveTo(x - dotSize, y);
  ctx.lineTo(x + dotSize, y);
  ctx.moveTo(x, y - dotSize);
  ctx.lineTo(x, y + dotSize);
  ctx.stroke();

  ctx.fillStyle = 'rgba(64, 180, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();

  const isPositionTool = drawingTool === 'long-position' || drawingTool === 'short-position';
  const guideY = plotHeight + 4;
  ctx.font = `600 12px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (isPositionTool) {
    ctx.fillStyle = 'rgba(12,18,32,0.80)';
    ctx.fillRect(0, guideY, width, xAxisHeight);
    ctx.fillStyle = 'rgba(64,180,255,0.9)';
    ctx.fillText('이동 후 손을 떼면 포지션이 생성됩니다', width / 2, guideY + 4);
  } else if (drawingTool === 'fib-trend') {
    const stage = getFibTrendStage(drawingDraft);
    const guideTexts: Record<number, string> = {
      0: '① 첫 번째 기준점: 이동 후 손을 떼세요',
      1: '② 두 번째 기준점: 이동 후 손을 떼세요',
      2: '③ 세 번째 기준점: 이동 후 손을 떼세요',
    };
    ctx.fillStyle = 'rgba(12,18,32,0.80)';
    ctx.fillRect(0, guideY, width, xAxisHeight);
    ctx.fillStyle = 'rgba(64,180,255,0.9)';
    ctx.fillText(guideTexts[stage] ?? '', width / 2, guideY + 4);
  } else if (drawingDraft && touchDrawingTapCount >= 1) {
    const stage = touchDrawingTapCount === 1 ? '두번째 포인트 선택' : '완료 또는 다른 곳 터치';
    ctx.fillStyle = 'rgba(64, 180, 255, 0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(`첫 포인트 고정 · ${stage}`, 12, 30);
  } else {
    ctx.fillStyle = 'rgba(64, 180, 255, 0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('첫 포인트 선택', 12, 30);
  }

  ctx.restore();
}
