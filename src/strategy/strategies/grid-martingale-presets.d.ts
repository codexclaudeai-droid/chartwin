export const GRID_MARTINGALE_PRESETS: {
  DEFAULT: { gridStep: number; takeProfitSteps: number; maxLevel: number; equityStopPct: number };
  NASDAQ: { gridStep: number; takeProfitSteps: number; maxLevel: number; equityStopPct: number };
  GOLD: { gridStep: number; takeProfitSteps: number; maxLevel: number; equityStopPct: number };
};

export function inferGridMartingalePreset(symbol: string): 'DEFAULT' | 'NASDAQ' | 'GOLD';
export function resolveGridMartingaleConfig(
  symbol: string,
  rawParams?: Record<string, unknown>,
): {
  gridStep: number;
  takeProfitSteps: number;
  maxLevel: number;
  equityStopPct: number;
};
