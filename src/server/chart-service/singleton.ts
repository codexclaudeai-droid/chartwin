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
import type { ChartServiceRepository } from './repository.ts';

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

  return globalForChartService.__chartServiceRepository;
}

export function getAsyncChartServicePersistence(env?: ChartServiceRepositoryRuntimeEnv) {
  const config = getChartServiceRepositoryConfigFromEnv(env);
  const signature = `async:${getChartServiceRepositoryConfigSignature(config)}`;
  if (
    !globalForChartService.__asyncChartServicePersistence ||
    globalForChartService.__asyncChartServicePersistenceSignature !== signature
  ) {
    const adapter = resolveChartServiceRepositoryAdapter(config);
    globalForChartService.__asyncChartServicePersistence = adapter.kind === 'memory'
      ? createAsyncChartServicePersistence(getChartServiceRepository(env))
      : createAsyncChartServicePersistenceFromConfig(config);
    globalForChartService.__asyncChartServicePersistenceSignature = signature;
  }

  return globalForChartService.__asyncChartServicePersistence;
}
