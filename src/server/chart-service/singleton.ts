import {
  createAsyncChartServicePersistenceFromConfig,
  createChartServiceRepositoryFromConfig,
  getChartServiceRepositoryConfigFromEnv,
  getChartServiceRepositoryConfigSignature,
  resolveChartServiceRepositoryAdapter,
  type ChartServiceRepositoryRuntimeEnv,
} from './repository-adapter.ts';
import {
  createAsyncChartServicePersistence,
  type AsyncChartServicePersistence,
} from './async-repository.ts';
import type {
  ChartServiceRepository,
  PaymentTransferSettingsRecord,
  SalesTeamRecord,
} from './repository.ts';

const globalForChartService = globalThis as typeof globalThis & {
  __chartServiceRepository?: ChartServiceRepository;
  __chartServiceRepositorySignature?: string;
  __asyncChartServicePersistence?: AsyncChartServicePersistence;
  __asyncChartServicePersistenceSignature?: string;
};

export function getChartServiceRepository(env?: ChartServiceRepositoryRuntimeEnv) {
  const config = getChartServiceRepositoryConfigFromEnv(env);
  const signature = getChartServiceRepositoryConfigSignature(config);
  if (
    !globalForChartService.__chartServiceRepository ||
    globalForChartService.__chartServiceRepositorySignature !== signature
  ) {
    globalForChartService.__chartServiceRepository = createChartServiceRepositoryFromConfig(config);
    globalForChartService.__chartServiceRepositorySignature = signature;
  }

  ensureMemoryRepositoryCapabilities(globalForChartService.__chartServiceRepository);
  return globalForChartService.__chartServiceRepository;
}

export function getAsyncChartServicePersistence(env?: ChartServiceRepositoryRuntimeEnv) {
  const config = getChartServiceRepositoryConfigFromEnv(env);
  const signature = `async:${getChartServiceRepositoryConfigSignature(config)}`;
  if (
    !globalForChartService.__asyncChartServicePersistence ||
    globalForChartService.__asyncChartServicePersistenceSignature !== signature ||
    !hasAsyncRepositoryCapabilities(globalForChartService.__asyncChartServicePersistence)
  ) {
    const adapter = resolveChartServiceRepositoryAdapter(config);
    globalForChartService.__asyncChartServicePersistence = adapter.kind === 'memory'
      ? createAsyncChartServicePersistence(getChartServiceRepository(env))
      : createAsyncChartServicePersistenceFromConfig(config);
    globalForChartService.__asyncChartServicePersistenceSignature = signature;
  }

  return globalForChartService.__asyncChartServicePersistence;
}

function hasAsyncRepositoryCapabilities(persistence: AsyncChartServicePersistence): boolean {
  return typeof persistence.repository.listSalesTeams === 'function' &&
    typeof persistence.repository.saveSalesTeam === 'function' &&
    typeof persistence.repository.getPaymentTransferSettings === 'function' &&
    typeof persistence.repository.savePaymentTransferSettings === 'function';
}

function ensureMemoryRepositoryCapabilities(repository: ChartServiceRepository): void {
  const mutableRepository = repository as ChartServiceRepository & {
    __fallbackSalesTeams?: SalesTeamRecord[];
    __fallbackPaymentTransferSettings?: PaymentTransferSettingsRecord | null;
  };

  mutableRepository.__fallbackSalesTeams ??= [];
  mutableRepository.__fallbackPaymentTransferSettings ??= null;

  if (typeof mutableRepository.listSalesTeams !== 'function') {
    mutableRepository.listSalesTeams = () => (
      mutableRepository.__fallbackSalesTeams ?? []
    ).map((team) => structuredClone(team));
  }

  if (typeof mutableRepository.saveSalesTeam !== 'function') {
    mutableRepository.saveSalesTeam = (team) => {
      const salesTeams = mutableRepository.__fallbackSalesTeams ?? [];
      const index = salesTeams.findIndex((item) => item.id === team.id);
      if (index >= 0) {
        salesTeams[index] = structuredClone(team);
      } else {
        salesTeams.push(structuredClone(team));
      }
      mutableRepository.__fallbackSalesTeams = salesTeams;
    };
  }

  if (typeof mutableRepository.getPaymentTransferSettings !== 'function') {
    mutableRepository.getPaymentTransferSettings = () => (
      mutableRepository.__fallbackPaymentTransferSettings
        ? structuredClone(mutableRepository.__fallbackPaymentTransferSettings)
        : null
    );
  }

  if (typeof mutableRepository.savePaymentTransferSettings !== 'function') {
    mutableRepository.savePaymentTransferSettings = (settings) => {
      mutableRepository.__fallbackPaymentTransferSettings = structuredClone(settings);
    };
  }
}
