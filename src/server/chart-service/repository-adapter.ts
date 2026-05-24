import { createMockChartServiceRepository } from './mock-repository.ts';
import {
  createAsyncChartServicePersistence,
  type AsyncChartServicePersistence,
  type AsyncChartServiceRepository,
} from './async-repository.ts';
import {
  getPostgresConnectionSignature,
  resolvePostgresConnectionSettings,
  type PostgresConnectionSettings,
} from './postgres-connection.ts';
import {
  createPostgresAsyncChartServiceRepository,
  type PostgresQueryExecutor,
} from './postgres-repository.ts';
import type { ChartServiceRepository } from './repository.ts';

const MEMORY_REPOSITORY_SCHEMA_VERSION = 'auth-password-hash-v1';

export type ChartServiceRepositoryAdapterKind = 'memory' | 'postgres';

export type ChartServiceRepositoryRuntimeEnv = {
  NODE_ENV?: string;
  CHART_SERVICE_REPOSITORY?: string;
  CHART_SERVICE_DATABASE_URL?: string;
  CHART_SERVICE_DATABASE_SSL_MODE?: string;
};

export type ChartServiceRepositoryAdapterConfig = {
  adapter?: string | null;
  databaseUrl?: string | null;
  databaseSslMode?: string | null;
  runtimeMode?: string | null;
  postgresQueryExecutor?: PostgresQueryExecutor | null;
};

export type ResolvedChartServiceRepositoryAdapter = {
  kind: ChartServiceRepositoryAdapterKind;
  isPersistent: boolean;
  label: string;
  connection?: PostgresConnectionSettings;
};

export function getChartServiceRepositoryConfigFromEnv(
  env: ChartServiceRepositoryRuntimeEnv = getRuntimeEnv(),
): ChartServiceRepositoryAdapterConfig {
  return {
    adapter: env.CHART_SERVICE_REPOSITORY,
    databaseUrl: env.CHART_SERVICE_DATABASE_URL,
    databaseSslMode: env.CHART_SERVICE_DATABASE_SSL_MODE,
    runtimeMode: env.NODE_ENV,
  };
}

export function resolveChartServiceRepositoryAdapter(
  config: ChartServiceRepositoryAdapterConfig,
): ResolvedChartServiceRepositoryAdapter {
  const adapter = normalizeAdapter(config.adapter);

  if (adapter === 'memory') {
    return {
      kind: 'memory',
      isPersistent: false,
      label: 'In-memory mock repository',
    };
  }

  const connection = resolvePostgresConnectionSettings({
    databaseUrl: config.databaseUrl,
    databaseSslMode: config.databaseSslMode,
    runtimeMode: config.runtimeMode,
  });

  return {
    kind: 'postgres',
    isPersistent: true,
    label: 'Postgres repository adapter',
    connection,
  };
}

export function createChartServiceRepositoryFromConfig(
  config: ChartServiceRepositoryAdapterConfig,
): ChartServiceRepository {
  const adapter = resolveChartServiceRepositoryAdapter(config);

  if (adapter.kind === 'memory') {
    return createMockChartServiceRepository();
  }

  throw new Error('Postgres repository adapter is configured but not implemented yet');
}

export function createAsyncChartServicePersistenceFromConfig(
  config: ChartServiceRepositoryAdapterConfig,
): AsyncChartServicePersistence {
  const adapter = resolveChartServiceRepositoryAdapter(config);

  if (adapter.kind === 'memory') {
    return createAsyncChartServicePersistence(createMockChartServiceRepository());
  }

  if (!config.postgresQueryExecutor) {
    throw new Error('Postgres query executor is required before the async repository adapter can be used.');
  }

  const repository = createPostgresAsyncChartServiceRepository(config.postgresQueryExecutor);
  const runOperation = async <T>(
    operation: (repository: AsyncChartServiceRepository) => T | Promise<T>,
  ): Promise<Awaited<T>> => await operation(repository);

  return {
    repository,
    runRead: runOperation,
    runMutation: runOperation,
  };
}

export function getChartServiceRepositoryConfigSignature(
  config: ChartServiceRepositoryAdapterConfig,
): string {
  const adapter = resolveChartServiceRepositoryAdapter(config);
  if (adapter.kind === 'memory') {
    return `${adapter.kind}:${MEMORY_REPOSITORY_SCHEMA_VERSION}`;
  }

  if (!adapter.connection) {
    throw new Error('Postgres repository adapter resolved without connection settings');
  }

  return `${adapter.kind}:${getPostgresConnectionSignature(adapter.connection)}`;
}

function normalizeAdapter(adapter: string | null | undefined): ChartServiceRepositoryAdapterKind {
  const normalized = adapter?.trim().toLowerCase() || 'memory';
  if (normalized === 'memory' || normalized === 'mock') {
    return 'memory';
  }
  if (normalized === 'postgres' || normalized === 'postgresql') {
    return 'postgres';
  }

  throw new Error(`Unsupported chart service repository adapter: ${adapter}`);
}

function getRuntimeEnv(): ChartServiceRepositoryRuntimeEnv {
  return ((globalThis as typeof globalThis & {
    process?: { env?: ChartServiceRepositoryRuntimeEnv };
  }).process?.env) ?? {};
}
