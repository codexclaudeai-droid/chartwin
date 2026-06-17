export const DEFAULT_SIGNAL_STRATEGY_ID = 'strategy_js_grid_martingale';

export const SIGNAL_SOURCES = ['chart_strategy', 'ea_strategy', 'actual_fill'] as const;
export type SignalSource = (typeof SIGNAL_SOURCES)[number];

export const SIGNAL_EXECUTION_MODES = [
  'simple_signal',
  'advanced_order_plan',
  'ea_signal',
  'actual_fill',
] as const;
export type SignalExecutionMode = (typeof SIGNAL_EXECUTION_MODES)[number];

export const SIGNAL_FILL_MODELS = [
  'ohlc_conservative',
  'ohlc_optimistic',
  'ohlc_candle_path',
  'next_open',
  'next_tick',
  'tick_replay',
  'actual_fill',
] as const;
export type SignalFillModel = (typeof SIGNAL_FILL_MODELS)[number];

export const ADVANCED_ENTRY_RULE_TYPES = [
  'market',
  'signal_close',
  'next_open',
  'limit',
  'stop',
  'previous_high',
  'previous_low',
  'swing_high',
  'swing_low',
  'indicator_value',
  'session_high',
  'session_low',
  'vwap_touch',
  'pullback',
] as const;
export type AdvancedEntryRuleType = (typeof ADVANCED_ENTRY_RULE_TYPES)[number];

export const ADVANCED_EXIT_RULE_TYPES = [
  'opposite_signal',
  'fixed_stop_loss',
  'fixed_take_profit',
  'risk_reward',
  'trailing_stop',
  'break_even',
  'previous_high',
  'previous_low',
  'swing_high',
  'swing_low',
  'indicator_value',
  'session_close',
  'time_stop',
] as const;
export type AdvancedExitRuleType = (typeof ADVANCED_EXIT_RULE_TYPES)[number];

export const ADVANCED_ORDER_CONSTRAINTS = [
  'spread',
  'slippage',
  'commission',
  'min_tick',
  'min_stop_distance',
  'session_hours',
  'rollover_blackout',
  'news_blackout',
] as const;
export type AdvancedOrderConstraint = (typeof ADVANCED_ORDER_CONSTRAINTS)[number];

export type SignalPolicyScope = 'global' | 'symbol';

export type SignalPolicy = {
  scope: SignalPolicyScope;
  symbolId: string | null;
  source: SignalSource;
  strategyId: string;
  profileId: string | null;
  executionMode: SignalExecutionMode;
  fillModel: SignalFillModel;
  enabled: boolean;
};

export type SignalPolicySettings = {
  globalPolicy: SignalPolicy;
  symbolPolicies: SignalPolicy[];
};

export const DEFAULT_GLOBAL_SIGNAL_POLICY: SignalPolicy = {
  scope: 'global',
  symbolId: null,
  source: 'chart_strategy',
  strategyId: DEFAULT_SIGNAL_STRATEGY_ID,
  profileId: null,
  executionMode: 'simple_signal',
  fillModel: 'ohlc_conservative',
  enabled: true,
};

export const DEFAULT_SIGNAL_POLICY_SETTINGS: SignalPolicySettings = {
  globalPolicy: DEFAULT_GLOBAL_SIGNAL_POLICY,
  symbolPolicies: [],
};

export function normalizeSignalPolicySettings(
  value: unknown,
  fallbackStrategyId = DEFAULT_SIGNAL_STRATEGY_ID,
): SignalPolicySettings {
  if (!isRecord(value)) {
    return cloneSignalPolicySettings(DEFAULT_SIGNAL_POLICY_SETTINGS);
  }

  const globalPolicy = normalizeSignalPolicy(
    value.globalPolicy,
    {
      ...DEFAULT_GLOBAL_SIGNAL_POLICY,
      strategyId: normalizeStrategyId(fallbackStrategyId, DEFAULT_SIGNAL_STRATEGY_ID),
    },
    'global',
  );
  const symbolPolicies = normalizeSymbolPolicies(value.symbolPolicies, globalPolicy);

  return {
    globalPolicy,
    symbolPolicies,
  };
}

export function normalizeSignalPolicy(
  value: unknown,
  fallback: SignalPolicy = DEFAULT_GLOBAL_SIGNAL_POLICY,
  scope: SignalPolicyScope = fallback.scope,
): SignalPolicy {
  const record = isRecord(value) ? value : {};
  const source = normalizeEnum(record.source, SIGNAL_SOURCES, fallback.source);
  const sourceDefaults = getSourceDefaults(source, fallback);
  const symbolId = scope === 'symbol'
    ? normalizeSymbolId(record.symbolId ?? fallback.symbolId)
    : null;

  return {
    scope,
    symbolId,
    source,
    strategyId: normalizeStrategyId(record.strategyId, sourceDefaults.strategyId),
    profileId: normalizeNullableString(record.profileId ?? sourceDefaults.profileId),
    executionMode: normalizeEnum(record.executionMode, SIGNAL_EXECUTION_MODES, sourceDefaults.executionMode),
    fillModel: normalizeEnum(record.fillModel, SIGNAL_FILL_MODELS, sourceDefaults.fillModel),
    enabled: typeof record.enabled === 'boolean' ? record.enabled : fallback.enabled,
  };
}

export function resolveSignalPolicyForSymbol(settings: SignalPolicySettings, symbolId: string): SignalPolicy {
  const normalizedSymbol = normalizeSymbolId(symbolId);
  const symbolPolicy = normalizedSymbol
    ? settings.symbolPolicies.find((policy) => policy.symbolId === normalizedSymbol)
    : null;
  return symbolPolicy ?? settings.globalPolicy;
}

export function cloneSignalPolicySettings(settings: SignalPolicySettings): SignalPolicySettings {
  return {
    globalPolicy: { ...settings.globalPolicy },
    symbolPolicies: settings.symbolPolicies.map((policy) => ({ ...policy })),
  };
}

function normalizeSymbolPolicies(value: unknown, globalPolicy: SignalPolicy): SignalPolicy[] {
  if (!Array.isArray(value)) return [];

  const bySymbolId = new Map<string, SignalPolicy>();
  for (const item of value) {
    const policy = normalizeSignalPolicy(item, { ...globalPolicy, scope: 'symbol' }, 'symbol');
    if (!policy.symbolId) continue;
    bySymbolId.set(policy.symbolId, policy);
  }
  return Array.from(bySymbolId.values());
}

function getSourceDefaults(source: SignalSource, fallback: SignalPolicy): SignalPolicy {
  if (source === 'actual_fill') {
    return {
      ...fallback,
      source,
      executionMode: 'actual_fill',
      fillModel: 'actual_fill',
    };
  }
  if (source === 'ea_strategy') {
    return {
      ...fallback,
      source,
      executionMode: 'ea_signal',
      fillModel: 'actual_fill',
    };
  }
  return {
    ...fallback,
    source,
  };
}

function normalizeStrategyId(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function normalizeSymbolId(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  const normalized = text.replace(/\s+/g, '');
  if (
    normalized === 'NAS100'
    || normalized === 'NQ'
    || normalized === 'NAS100FT'
    || normalized === 'NAS100.FT'
    || normalized === 'NAS100FUTURES'
  ) {
    return 'NQ1!';
  }
  return text || null;
}

function normalizeNullableString(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function normalizeEnum<const T extends readonly string[]>(
  value: unknown,
  choices: T,
  fallback: T[number],
): T[number] {
  return choices.includes(value as T[number]) ? value as T[number] : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
