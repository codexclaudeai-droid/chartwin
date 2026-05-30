export type JsonRecord = Record<string, unknown>;

export type StoredChartConfig = {
  version: 1;
  layout?: JsonRecord;
  candleStyle?: JsonRecord;
  timezone?: string;
  indicators?: JsonRecord;
  panelState?: JsonRecord;
  indicatorsVisible?: boolean;
};

const isJsonRecord = (value: unknown): value is JsonRecord => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
);

const cloneJsonValue = (value: unknown): unknown => {
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return undefined;
  }
};

export const cloneJsonRecord = (value: unknown): JsonRecord | null => {
  if (!isJsonRecord(value)) return null;
  const cloned = cloneJsonValue(value);
  return isJsonRecord(cloned) ? cloned : null;
};

export const normalizeStoredChartConfig = (value: unknown): StoredChartConfig => {
  if (!isJsonRecord(value)) return { version: 1 };
  return {
    version: 1,
    layout: cloneJsonRecord(value.layout) ?? undefined,
    candleStyle: cloneJsonRecord(value.candleStyle) ?? undefined,
    timezone: typeof value.timezone === 'string' ? value.timezone : undefined,
    indicators: cloneJsonRecord(value.indicators) ?? undefined,
    panelState: cloneJsonRecord(value.panelState) ?? undefined,
    indicatorsVisible: typeof value.indicatorsVisible === 'boolean' ? value.indicatorsVisible : undefined,
  };
};

export const mergeJsonRecords = (base: JsonRecord = {}, patch: JsonRecord = {}): JsonRecord => {
  const result = cloneJsonRecord(base) ?? {};
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) return;
    const current = result[key];
    if (isJsonRecord(current) && isJsonRecord(value)) {
      result[key] = mergeJsonRecords(current, value);
      return;
    }
    result[key] = cloneJsonValue(value);
  });
  return result;
};

export const mergeStoredChartConfig = (
  base: StoredChartConfig,
  patch: StoredChartConfig,
): StoredChartConfig => {
  const normalizedBase = normalizeStoredChartConfig(base);
  const normalizedPatch = normalizeStoredChartConfig(patch);
  const merged: StoredChartConfig = { version: 1 };

  if (normalizedBase.layout || normalizedPatch.layout) {
    merged.layout = mergeJsonRecords(normalizedBase.layout ?? {}, normalizedPatch.layout ?? {});
  }
  if (normalizedBase.candleStyle || normalizedPatch.candleStyle) {
    merged.candleStyle = mergeJsonRecords(normalizedBase.candleStyle ?? {}, normalizedPatch.candleStyle ?? {});
  }
  if (normalizedPatch.timezone ?? normalizedBase.timezone) {
    merged.timezone = normalizedPatch.timezone ?? normalizedBase.timezone;
  }
  if (normalizedBase.indicators || normalizedPatch.indicators) {
    merged.indicators = mergeJsonRecords(normalizedBase.indicators ?? {}, normalizedPatch.indicators ?? {});
  }
  if (normalizedBase.panelState || normalizedPatch.panelState) {
    merged.panelState = mergeJsonRecords(normalizedBase.panelState ?? {}, normalizedPatch.panelState ?? {});
  }
  if (typeof normalizedPatch.indicatorsVisible === 'boolean') {
    merged.indicatorsVisible = normalizedPatch.indicatorsVisible;
  } else if (typeof normalizedBase.indicatorsVisible === 'boolean') {
    merged.indicatorsVisible = normalizedBase.indicatorsVisible;
  }

  return merged;
};
