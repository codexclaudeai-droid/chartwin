import { isPointInCircle, type CircularHitArea } from './pointer-hit-test.ts';

export interface SubIndicatorAlertHitArea {
  id: string;
  panelTop: number;
  panelHeight: number;
}

export interface SubIndicatorAddButtonHitArea extends CircularHitArea {
  panelId: string;
  value: number;
  color: string;
}

export type SubIndicatorAlertMouseDownAction =
  | { type: 'edit-alert'; hit: SubIndicatorAlertHitArea }
  | { type: 'add-alert'; button: SubIndicatorAddButtonHitArea }
  | { type: 'none' };

export interface ResolveSubIndicatorAlertMouseDownParams {
  mouseX: number;
  mouseY: number;
  hitAlert: SubIndicatorAlertHitArea | null;
  addButton: SubIndicatorAddButtonHitArea | null;
}

export function resolveSubIndicatorAlertMouseDown(
  params: ResolveSubIndicatorAlertMouseDownParams,
): SubIndicatorAlertMouseDownAction {
  const {
    mouseX,
    mouseY,
    hitAlert,
    addButton,
  } = params;

  if (hitAlert) return { type: 'edit-alert', hit: hitAlert };
  if (addButton && isPointInCircle(addButton, mouseX, mouseY, 4)) {
    return { type: 'add-alert', button: addButton };
  }
  return { type: 'none' };
}
