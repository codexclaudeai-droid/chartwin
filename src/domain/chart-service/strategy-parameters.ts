export type StrategyParameterValue = string | number | boolean;

export type StrategyParameterProfile = {
  id: string;
  strategyId: string;
  symbolId: string | null;
  name: string;
  params: Record<string, StrategyParameterValue>;
  enabled: boolean;
};

export type StrategyParameterSettings = {
  profiles: StrategyParameterProfile[];
};

export const DEFAULT_STRATEGY_PARAMETER_SETTINGS: StrategyParameterSettings = {
  profiles: [],
};

export function normalizeStrategyParameterSettings(value: unknown): StrategyParameterSettings {
  if (!isRecord(value)) return cloneStrategyParameterSettings(DEFAULT_STRATEGY_PARAMETER_SETTINGS);

  const profiles = Array.isArray(value.profiles)
    ? value.profiles
      .map(normalizeStrategyParameterProfile)
      .filter((profile): profile is StrategyParameterProfile => profile != null)
    : [];
  const byId = new Map<string, StrategyParameterProfile>();
  for (const profile of profiles) {
    byId.set(profile.id, profile);
  }

  return {
    profiles: Array.from(byId.values()),
  };
}

export function resolveStrategyParamsForSymbol(
  settings: StrategyParameterSettings,
  strategyId: string,
  symbolId: string | null,
  defaults: Record<string, StrategyParameterValue> = {},
): Record<string, StrategyParameterValue> {
  const normalizedStrategyId = normalizeId(strategyId);
  if (!normalizedStrategyId) return { ...defaults };

  const normalizedSymbolId = normalizeSymbolId(symbolId);
  const globalProfile = settings.profiles.find((profile) => (
    profile.enabled && profile.strategyId === normalizedStrategyId && profile.symbolId == null
  ));
  const symbolProfile = normalizedSymbolId
    ? settings.profiles.find((profile) => (
      profile.enabled && profile.strategyId === normalizedStrategyId && profile.symbolId === normalizedSymbolId
    ))
    : null;

  return {
    ...defaults,
    ...(globalProfile?.params ?? {}),
    ...(symbolProfile?.params ?? {}),
  };
}

export function cloneStrategyParameterSettings(settings: StrategyParameterSettings): StrategyParameterSettings {
  return {
    profiles: settings.profiles.map((profile) => ({
      ...profile,
      params: { ...profile.params },
    })),
  };
}

function normalizeStrategyParameterProfile(value: unknown): StrategyParameterProfile | null {
  if (!isRecord(value)) return null;

  const strategyId = normalizeId(value.strategyId);
  if (!strategyId) return null;

  const symbolId = normalizeSymbolId(value.symbolId);
  const id = `${strategyId}:${symbolId ?? 'global'}`;
  const fallbackName = symbolId ? `${strategyId} ${symbolId}` : `${strategyId} global`;
  const name = normalizeText(value.name) || fallbackName;

  return {
    id,
    strategyId,
    symbolId,
    name,
    params: normalizeParams(value.params),
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
  };
}

function normalizeParams(value: unknown): Record<string, StrategyParameterValue> {
  if (!isRecord(value)) return {};

  const params: Record<string, StrategyParameterValue> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = normalizeId(key);
    if (!normalizedKey) continue;
    if (
      typeof rawValue === 'string' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean'
    ) {
      params[normalizedKey] = rawValue;
    }
  }
  return params;
}

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
