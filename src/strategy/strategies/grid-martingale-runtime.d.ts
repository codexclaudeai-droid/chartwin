export function simulateGridMartingale(
  close: number[],
  symbol?: string,
  rawParams?: Record<string, unknown>,
): {
  signals: number[];
  trades: Array<{
    side: 'LONG' | 'SHORT';
    entry: number;
    exit: number;
    entryIndex: number;
    exitIndex: number;
    pnl: number;
    reason: string;
  }>;
  openLongEntries: Array<{ entry: number; entryIndex: number }>;
  openShortEntries: Array<{ entry: number; entryIndex: number }>;
  config: {
    gridStep: number;
    takeProfitSteps: number;
    maxLevel: number;
    equityStopPct: number;
  };
};
