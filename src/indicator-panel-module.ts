export type SubPanelId = 'volume' | 'rsi' | 'dmi' | 'macd' | 'stochF' | 'stochS' | 'cci' | 'obv' | 'cvd';

export interface LineStyle {
  color: string;
  width: number;
  dash: number[];
}

export interface IndicatorPanelState {
  panelOrder: SubPanelId[];
  panelRatios: Record<string, number>;
  lineStyles: Record<string, LineStyle>;
  lineVisibility: Record<string, boolean>;
}

export const SUB_PANEL_IDS: SubPanelId[] = ['volume', 'rsi', 'dmi', 'macd', 'stochF', 'stochS', 'cci', 'obv', 'cvd'];

const MIN_PANEL_RATIO = 0.035;
const MIN_COLLAPSED_PANEL_RATIO = 0.008;
const MAX_SUB_RATIO_TOTAL = 0.75;

const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  ma1: { color: '#f7931a', width: 1.5, dash: [] },
  ma2: { color: '#2962ff', width: 1.5, dash: [] },
  ma3: { color: '#4caf50', width: 1.5, dash: [] },
  ma4: { color: '#9c27b0', width: 1.5, dash: [] },
  ema1: { color: '#ff9800', width: 1.5, dash: [] },
  ema2: { color: '#00b0ff', width: 1.5, dash: [] },
  ema3: { color: '#7cb342', width: 1.5, dash: [] },
  ema4: { color: '#ab47bc', width: 1.5, dash: [] },
  maShort: { color: '#f7931a', width: 1.5, dash: [] },
  maLong: { color: '#2962ff', width: 1.5, dash: [] },
  ma60: { color: '#4caf50', width: 1.5, dash: [] },
  ma120: { color: '#9c27b0', width: 1.5, dash: [] },
  ma200: { color: '#ff5722', width: 1.5, dash: [] },
  bb1Upper: { color: 'rgba(100,149,237,0.8)', width: 1, dash: [] },
  bb1Middle: { color: 'rgba(100,149,237,0.5)', width: 1, dash: [4, 4] },
  bb1Lower: { color: 'rgba(100,149,237,0.8)', width: 1, dash: [] },
  bbUpper: { color: 'rgba(100,149,237,0.8)', width: 1, dash: [] },
  bbMiddle: { color: 'rgba(100,149,237,0.5)', width: 1, dash: [4, 4] },
  bbLower: { color: 'rgba(100,149,237,0.8)', width: 1, dash: [] },
  vwap: { color: '#ff9800', width: 1.5, dash: [] },
  volumeBars: { color: 'rgba(34,171,148,0.35)', width: 1, dash: [] },
  ichimokuTenkan: { color: '#f23645', width: 1, dash: [] },
  ichimokuKijun: { color: '#2962ff', width: 1, dash: [] },
  ichimokuSenkouA: { color: 'rgba(34,171,148,0.6)', width: 1, dash: [4, 4] },
  ichimokuSenkouB: { color: 'rgba(242,54,69,0.6)', width: 1, dash: [4, 4] },
  volumeProfileUp: { color: 'rgba(38,166,154,0.45)', width: 1, dash: [] },
  volumeProfileDown: { color: 'rgba(239,83,80,0.45)', width: 1, dash: [] },
  volumeProfilePoc: { color: 'rgba(255,193,7,0.95)', width: 1.2, dash: [4, 3] },
  envelopeUpper: { color: 'rgba(255,200,50,0.8)', width: 1, dash: [] },
  envelopeMiddle: { color: 'rgba(255,200,50,0.4)', width: 1, dash: [4, 4] },
  envelopeLower: { color: 'rgba(255,200,50,0.8)', width: 1, dash: [] },
  supertrendUp: { color: '#26a69a', width: 1.7, dash: [] },
  supertrendDown: { color: '#ef5350', width: 1.7, dash: [] },
  statisticalTrailingStopBull: { color: '#26a69a', width: 1.7, dash: [] },
  statisticalTrailingStopBear: { color: '#ef5350', width: 1.7, dash: [] },
  zeroLagMaTrendLevelsZlma: { color: '#30d453', width: 1, dash: [] },
  zeroLagMaTrendLevelsEma: { color: '#4043f1', width: 1, dash: [] },
  zeroLagMaTrendLevelsSignal: { color: '#30d453', width: 1, dash: [] },
  zeroLagMaTrendLevelsLevel: { color: '#30d453', width: 1, dash: [] },
  rsi: { color: '#ffeb3b', width: 1.5, dash: [] },
  rsiBaseline: { color: '#999999', width: 1, dash: [4, 4] },
  dmiPlus: { color: '#26a69a', width: 1.5, dash: [] },
  dmiMinus: { color: '#ef5350', width: 1.5, dash: [] },
  dmiAdx: { color: '#ffffff', width: 2, dash: [] },
  macdLine: { color: '#2962ff', width: 1.5, dash: [] },
  macdSignal: { color: '#ef5350', width: 1.5, dash: [] },
  macdBaseline: { color: '#999999', width: 1, dash: [4, 4] },
  stochFastK: { color: '#26a69a', width: 1.5, dash: [] },
  stochFastD: { color: '#ef5350', width: 1.5, dash: [] },
  stochFastBaseline: { color: '#999999', width: 1, dash: [4, 4] },
  stochSlowK: { color: '#26a69a', width: 1.5, dash: [] },
  stochSlowD: { color: '#ef5350', width: 1.5, dash: [] },
  stochSlowBaseline: { color: '#999999', width: 1, dash: [4, 4] },
  cci: { color: '#26a69a', width: 1.5, dash: [] },
  cciBaseline: { color: '#999999', width: 1, dash: [4, 4] },
  obv: { color: '#26a69a', width: 1.5, dash: [] },
  obvSignal9: { color: '#ffc107', width: 1.5, dash: [4, 2] },
  obvBaseline: { color: '#999999', width: 1, dash: [4, 4] },
  cvd: { color: '#7b68ee', width: 1.5, dash: [] },
  cvdSignal9: { color: '#ffa726', width: 1.5, dash: [4, 2] },
  cvdBaseline: { color: '#999999', width: 1, dash: [4, 4] },
};

export const INDICATOR_STYLE_TARGETS: Record<string, { key: string; label: string }[]> = {
  ma: [],
  ema: [],
  maShort: [{ key: 'maShort', label: 'Line' }],
  maLong: [{ key: 'maLong', label: 'Line' }],
  ma60: [{ key: 'ma60', label: 'Line' }],
  ma120: [{ key: 'ma120', label: 'Line' }],
  ma200: [{ key: 'ma200', label: 'Line' }],
  bb: [
    { key: 'bbUpper', label: 'Upper' },
    { key: 'bbMiddle', label: 'Middle' },
    { key: 'bbLower', label: 'Lower' },
  ],
  vwap: [{ key: 'vwap', label: 'Line' }],
  volume: [{ key: 'volumeBars', label: 'Bars' }],
  volumeProfile: [
    { key: 'volumeProfileUp', label: 'Bull Volume' },
    { key: 'volumeProfileDown', label: 'Bear Volume' },
    { key: 'volumeProfilePoc', label: 'POC' },
  ],
  vpvr: [
    { key: 'volumeProfileUp', label: 'Bull Volume' },
    { key: 'volumeProfileDown', label: 'Bear Volume' },
    { key: 'volumeProfilePoc', label: 'POC' },
  ],
  ichimoku: [
    { key: 'ichimokuTenkan', label: 'Tenkan' },
    { key: 'ichimokuKijun', label: 'Kijun' },
    { key: 'ichimokuSenkouA', label: 'Senkou A' },
    { key: 'ichimokuSenkouB', label: 'Senkou B' },
  ],
  envelope: [
    { key: 'envelopeUpper', label: 'Upper' },
    { key: 'envelopeMiddle', label: 'Middle' },
    { key: 'envelopeLower', label: 'Lower' },
  ],
  supertrend: [
    { key: 'supertrendUp', label: 'Up' },
    { key: 'supertrendDown', label: 'Down' },
  ],
  statisticalTrailingStop: [
    { key: 'statisticalTrailingStopBull', label: 'Bull' },
    { key: 'statisticalTrailingStopBear', label: 'Bear' },
  ],
  zeroLagMaTrendLevels: [
    { key: 'zeroLagMaTrendLevelsZlma', label: 'ZLMA' },
    { key: 'zeroLagMaTrendLevelsEma', label: 'EMA' },
    { key: 'zeroLagMaTrendLevelsSignal', label: 'Signals' },
    { key: 'zeroLagMaTrendLevelsLevel', label: 'Levels' },
  ],
  rsi: [{ key: 'rsi', label: 'Line' }, { key: 'rsiBaseline', label: 'Baseline' }],
  dmi: [
    { key: 'dmiPlus', label: '+DI' },
    { key: 'dmiMinus', label: '-DI' },
    { key: 'dmiAdx', label: 'ADX' },
  ],
  macd: [
    { key: 'macdLine', label: 'MACD' },
    { key: 'macdSignal', label: 'Signal' },
    { key: 'macdBaseline', label: 'Baseline' },
  ],
  stochF: [
    { key: 'stochFastK', label: '%K' },
    { key: 'stochFastD', label: '%D' },
    { key: 'stochFastBaseline', label: 'Baseline' },
  ],
  stochS: [
    { key: 'stochSlowK', label: '%K' },
    { key: 'stochSlowD', label: '%D' },
    { key: 'stochSlowBaseline', label: 'Baseline' },
  ],
  cci: [{ key: 'cci', label: 'Line' }, { key: 'cciBaseline', label: 'Baseline' }],
  obv: [
    { key: 'obv', label: 'Line' },
    { key: 'obvSignal9', label: 'Signal 9' },
    { key: 'obvBaseline', label: 'Baseline' },
  ],
  cvd: [
    { key: 'cvd', label: 'Line' },
    { key: 'cvdSignal9', label: 'Signal 9' },
    { key: 'cvdBaseline', label: 'Baseline' },
  ],
};

export function createDefaultPanelState(): IndicatorPanelState {
  const lineStyles = { ...DEFAULT_LINE_STYLES };
  const lineVisibility: Record<string, boolean> = {};
  Object.keys(lineStyles).forEach((key) => {
    lineVisibility[key] = true;
  });
  lineVisibility['cvdSignal9'] = false;
  return {
    panelOrder: [...SUB_PANEL_IDS],
    panelRatios: {
      volume: 0.12,
      rsi: 0.12,
      dmi: 0.1,
      macd: 0.11,
      stochF: 0.12,
      stochS: 0.12,
      cci: 0.12,
      obv: 0.12,
      cvd: 0.12,
    },
    lineStyles,
    lineVisibility,
  };
}

export function getActivePanels(indicators: Record<string, { show?: boolean }>, state: IndicatorPanelState): SubPanelId[] {
  const order = ensurePanelOrder(state);
  return order.filter((id) => Boolean(indicators[id]?.show));
}

export function getPanelRatio(state: IndicatorPanelState, panelId: string): number {
  return state.panelRatios[panelId] ?? 0.12;
}

export function movePanel(state: IndicatorPanelState, panelId: SubPanelId, direction: -1 | 1, activePanels?: string[]): void {
  const order = ensurePanelOrder(state);
  const active = activePanels ?? order;
  // Find the neighbour in the active list and swap positions in full order
  const activeFrom = active.indexOf(panelId);
  if (activeFrom < 0) return;
  const activeTo = activeFrom + direction;
  if (activeTo < 0 || activeTo >= active.length) return;
  const neighbourId = active[activeTo] as SubPanelId;
  const fullFrom = order.indexOf(panelId);
  const fullTo = order.indexOf(neighbourId);
  if (fullFrom < 0 || fullTo < 0) return;
  order[fullFrom] = neighbourId;
  order[fullTo] = panelId;
  state.panelOrder = order;
}

export function ensurePanelRatios(state: IndicatorPanelState, activePanels: string[]): void {
  activePanels.forEach((id) => {
    if (!state.panelRatios[id] || Number.isNaN(state.panelRatios[id])) {
      state.panelRatios[id] = 0.12;
    }
  });
  clampTotalSubRatio(state, activePanels);
}

export function resizePanelBoundary(
  state: IndicatorPanelState,
  activePanels: string[],
  boundaryIndex: number,
  deltaRatio: number,
): void {
  if (!activePanels.length) return;

  // Topmost divider: scale all sub-panels proportionally so their relative sizes are preserved.
  if (boundaryIndex === 0) {
    const currentTotal = activePanels.reduce((sum, id) => sum + (state.panelRatios[id] ?? 0.12), 0);
    const minTotal = activePanels.reduce((sum, id) => sum + getMinPanelRatio(state, id), 0);
    const newTotal = Math.max(minTotal, Math.min(MAX_SUB_RATIO_TOTAL, currentTotal - deltaRatio));
    const scale = currentTotal > 1e-9 ? newTotal / currentTotal : 1;
    activePanels.forEach((id) => {
      state.panelRatios[id] = Math.max(getMinPanelRatio(state, id), (state.panelRatios[id] ?? 0.12) * scale);
    });
    clampTotalSubRatio(state, activePanels);
    return;
  }

  const idx = Math.max(0, Math.min(boundaryIndex, activePanels.length - 1));
  const targetId = activePanels[idx];
  if (!targetId) return;

  // Keep upper sub-panels fixed. Resize only the panel below the dragged boundary.
  // The remaining delta is absorbed by main chart area through total sub-ratio change.
  const next = (state.panelRatios[targetId] ?? 0.12) - deltaRatio;
  state.panelRatios[targetId] = Math.max(getMinPanelRatio(state, targetId), next);
  clampTotalSubRatio(state, activePanels);
}

export function getLineStyle(state: IndicatorPanelState, styleKey: string, fallback: LineStyle): LineStyle {
  const own = state.lineStyles[styleKey];
  if (!own) return fallback;
  return {
    color: own.color,
    width: own.width,
    dash: [...own.dash],
  };
}

export function updateLineStyle(state: IndicatorPanelState, styleKey: string, patch: Partial<LineStyle>): void {
  const base = getLineStyle(state, styleKey, { color: '#ffffff', width: 1.5, dash: [] });
  state.lineStyles[styleKey] = {
    color: patch.color ?? base.color,
    width: patch.width ?? base.width,
    dash: patch.dash ?? base.dash,
  };
}

export function getLineVisible(state: IndicatorPanelState, styleKey: string): boolean {
  return state.lineVisibility[styleKey] ?? true;
}

export function setLineVisible(state: IndicatorPanelState, styleKey: string, visible: boolean): void {
  state.lineVisibility[styleKey] = visible;
}

function ensurePanelOrder(state: IndicatorPanelState): SubPanelId[] {
  const seen = new Set<SubPanelId>();
  const normalized: SubPanelId[] = [];

  for (const id of state.panelOrder) {
    if (!SUB_PANEL_IDS.includes(id) || seen.has(id)) continue;
    normalized.push(id);
    seen.add(id);
  }

  for (const id of SUB_PANEL_IDS) {
    if (seen.has(id)) continue;
    normalized.push(id);
  }

  state.panelOrder = normalized;
  return normalized;
}

function clampTotalSubRatio(state: IndicatorPanelState, activePanels: string[]): void {
  if (!activePanels.length) return;

  const minRatioById = new Map<string, number>();
  activePanels.forEach((id) => {
    minRatioById.set(id, getMinPanelRatio(state, id));
  });

  activePanels.forEach((id) => {
    const minRatio = minRatioById.get(id) ?? MIN_PANEL_RATIO;
    state.panelRatios[id] = Math.max(minRatio, state.panelRatios[id] ?? 0.12);
  });

  let total = activePanels.reduce((sum, id) => sum + (state.panelRatios[id] ?? 0), 0);
  if (total <= MAX_SUB_RATIO_TOTAL) return;

  const minTotal = activePanels.reduce((sum, id) => sum + (minRatioById.get(id) ?? MIN_PANEL_RATIO), 0);
  const spare = MAX_SUB_RATIO_TOTAL - minTotal;
  if (spare <= 0) {
    activePanels.forEach((id) => {
      state.panelRatios[id] = minRatioById.get(id) ?? MIN_PANEL_RATIO;
    });
    return;
  }

  const currentSpare = activePanels.reduce((sum, id) => {
    const minRatio = minRatioById.get(id) ?? MIN_PANEL_RATIO;
    return sum + ((state.panelRatios[id] ?? 0) - minRatio);
  }, 0);
  const scale = currentSpare > 0 ? spare / currentSpare : 1;

  activePanels.forEach((id) => {
    const minRatio = minRatioById.get(id) ?? MIN_PANEL_RATIO;
    const extra = Math.max((state.panelRatios[id] ?? 0) - minRatio, 0);
    state.panelRatios[id] = minRatio + extra * scale;
  });

  total = activePanels.reduce((sum, id) => sum + (state.panelRatios[id] ?? 0), 0);
  if (total > MAX_SUB_RATIO_TOTAL) {
    const reduceEach = (total - MAX_SUB_RATIO_TOTAL) / activePanels.length;
    activePanels.forEach((id) => {
      const minRatio = minRatioById.get(id) ?? MIN_PANEL_RATIO;
      state.panelRatios[id] = Math.max(minRatio, (state.panelRatios[id] ?? 0) - reduceEach);
    });
  }
}

function getMinPanelRatio(state: IndicatorPanelState, panelId: string): number {
  const hiddenPanels = new Set<string>(((state as any).hiddenPanels ?? []) as string[]);
  return hiddenPanels.has(panelId) ? MIN_COLLAPSED_PANEL_RATIO : MIN_PANEL_RATIO;
}
