export type MouseDownAxisInteraction =
  | { type: 'main-y-axis' }
  | { type: 'x-axis' }
  | { type: 'sub-y-axis'; panelId: string }
  | { type: 'none' };

export interface ResolveMouseDownAxisInteractionParams {
  onMainYAxis: boolean;
  onXAxis: boolean;
  subYAxisPanel: string | null;
}

export function resolveMouseDownAxisInteraction(
  params: ResolveMouseDownAxisInteractionParams,
): MouseDownAxisInteraction {
  if (params.onMainYAxis) return { type: 'main-y-axis' };
  if (params.onXAxis) return { type: 'x-axis' };
  if (params.subYAxisPanel) return { type: 'sub-y-axis', panelId: params.subYAxisPanel };
  return { type: 'none' };
}
