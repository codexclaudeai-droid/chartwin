import type { DrawingAnchor, DrawingDraft } from '../../ui/workspace/drawing-types.ts';

export function updateDrawingDraftAnchor(draft: DrawingDraft, anchor: DrawingAnchor): void {
  if (draft.kind === 'draw-pencil' || draft.kind === 'draw-highlighter') {
    if (!draft.points) draft.points = [draft.a];
    draft.points.push(anchor);
    draft.b = anchor;
    return;
  }

  if (draft.kind === 'measure') {
    draft.b = { index: Math.round(anchor.index), price: anchor.price };
    return;
  }

  draft.b = anchor;
}
