export const GRID_MARTINGALE_PRESETS = {
  DEFAULT: {
    gridStep: 120,
    takeProfitSteps: 2.2,
    maxLevel: 8,
    equityStopPct: 14,
  },
  NASDAQ: {
    gridStep: 40,
    takeProfitSteps: 1.8,
    maxLevel: 7,
    equityStopPct: 12,
  },
  GOLD: {
    gridStep: 25,
    takeProfitSteps: 1.6,
    maxLevel: 6,
    equityStopPct: 10,
  },
};

export function inferGridMartingalePreset(symbol) {
  const upper = String(symbol || '').trim().toUpperCase();
  if (upper.includes('XAU') || upper.includes('GOLD')) return 'GOLD';
  if (upper.includes('NQ') || upper.includes('NAS') || upper.includes('IXIC')) return 'NASDAQ';
  return 'DEFAULT';
}

export function resolveGridMartingaleConfig(symbol, rawParams = {}) {
  const preset = GRID_MARTINGALE_PRESETS[inferGridMartingalePreset(symbol)] || GRID_MARTINGALE_PRESETS.DEFAULT;
  const gridStep = Number(rawParams.gridStep);
  const takeProfitSteps = Number(rawParams.takeProfitSteps);
  const maxLevel = Number(rawParams.maxLevel);
  const equityStopPct = Number(rawParams.equityStopPct);
  return {
    gridStep: Number.isFinite(gridStep) ? gridStep : preset.gridStep,
    takeProfitSteps: Number.isFinite(takeProfitSteps) ? takeProfitSteps : preset.takeProfitSteps,
    maxLevel: Number.isFinite(maxLevel) ? maxLevel : preset.maxLevel,
    equityStopPct: Number.isFinite(equityStopPct) ? equityStopPct : preset.equityStopPct,
  };
}
