const STRATEGY_MIN_HISTORY: Record<string, number> = {
  strategy_pine_bbands_directed: 200,
  strategy_js_double_break: 120,
  strategy_js_grid_atr_bnf_srouter_v1: 60,
  strategy_js_mtf_1m_scalper: 260,
};

export function getStrategyMinimumHistory(strategyId: string | null | undefined): number {
  if (!strategyId) return 0;
  return STRATEGY_MIN_HISTORY[String(strategyId)] ?? 0;
}

export function getStrategyHistoryDiagnostic(strategyId: string | null | undefined, candleCount: number): {
  ready: boolean;
  required: number;
  actual: number;
  missing: number;
  message: string | null;
} {
  const required = getStrategyMinimumHistory(strategyId);
  const actual = Math.max(0, Math.floor(Number(candleCount) || 0));
  const missing = Math.max(0, required - actual);
  if (required <= 0 || missing <= 0) {
    return {
      ready: true,
      required,
      actual,
      missing: 0,
      message: null,
    };
  }
  return {
    ready: false,
    required,
    actual,
    missing,
    message: `전략 계산용 히스토리가 ${actual}/${required}봉만 확보되어 시그널이 드물 수 있습니다.`,
  };
}
