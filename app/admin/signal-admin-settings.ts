import { NextResponse } from 'next/server.js';
import { assertSuperAdminActor } from '../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAsyncChartServicePersistence,
  type AsyncChartServiceRepository,
  type SignalAdminSettingsRecord,
} from '../../src/server/chart-service/index.ts';

const SETTINGS_ID = 'default';
const DEFAULT_SELECTED_STRATEGY_ID = 'strategy_js_grid_martingale';

export type SignalAdminSettingsPayload = {
  hidden: string[];
  disabled: string[];
  hiddenStrategies: string[];
  mgmtVisible: boolean;
  selectedStrategyId: string;
};

export async function readSignalAdminSettings(): Promise<SignalAdminSettingsRecord> {
  const persistence = getAsyncChartServicePersistence();
  return persistence.runRead(async (repository) => getStoredOrDefault(repository));
}

export async function updateSignalAdminSettings(
  patch: Partial<SignalAdminSettingsPayload>,
): Promise<SignalAdminSettingsRecord> {
  const persistence = getAsyncChartServicePersistence();
  return persistence.runMutation(async (repository) => {
    const current = await getStoredOrDefault(repository);
    const next: SignalAdminSettingsRecord = {
      ...current,
      hiddenSymbols: patch.hidden ? normalizeUpperList(patch.hidden) : current.hiddenSymbols,
      disabledSymbols: patch.disabled ? normalizeUpperList(patch.disabled) : current.disabledSymbols,
      hiddenStrategyIds: patch.hiddenStrategies ? normalizeStringList(patch.hiddenStrategies) : current.hiddenStrategyIds,
      strategyMgmtVisible: typeof patch.mgmtVisible === 'boolean' ? patch.mgmtVisible : current.strategyMgmtVisible,
      selectedStrategyId: patch.selectedStrategyId?.trim() || current.selectedStrategyId,
      updatedAt: new Date().toISOString(),
    };
    await repository.saveSignalAdminSettings(next);
    return next;
  });
}

export async function requireSignalSuperAdmin(request: Request): Promise<void> {
  const persistence = getAsyncChartServicePersistence();
  await persistence.runRead(async (repository) => {
    const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
    assertSuperAdminActor(actor);
  });
}

export function signalAdminJson(payload: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

export function toSymbolsResponse(settings: SignalAdminSettingsRecord) {
  return {
    ok: true,
    hidden: settings.hiddenSymbols,
    disabled: settings.disabledSymbols,
  };
}

export function toStrategiesResponse(settings: SignalAdminSettingsRecord) {
  return {
    ok: true,
    hidden: settings.hiddenStrategyIds,
    mgmtVisible: settings.strategyMgmtVisible,
    selectedStrategyId: settings.selectedStrategyId,
  };
}

async function getStoredOrDefault(repository: AsyncChartServiceRepository): Promise<SignalAdminSettingsRecord> {
  return (await repository.getSignalAdminSettings(SETTINGS_ID)) ?? {
    id: SETTINGS_ID,
    hiddenSymbols: [],
    disabledSymbols: [],
    hiddenStrategyIds: [],
    strategyMgmtVisible: false,
    selectedStrategyId: DEFAULT_SELECTED_STRATEGY_ID,
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizeUpperList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
    : [];
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}
