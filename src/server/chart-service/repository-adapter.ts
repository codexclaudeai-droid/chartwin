import { createMockChartServiceRepository } from './mock-repository.ts';
import { getCloudflareContext } from '@opennextjs/cloudflare';
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
  isTransactionalPostgresQueryExecutor,
  type PostgresQueryExecutor,
} from './postgres-repository.ts';
import {
  createPgPoolOptions,
  createPgPostgresQueryExecutor,
  type PgPoolLike,
  type PgPoolOptions,
} from './postgres-pg-executor.ts';
import { createNodePgPostgresQueryExecutor } from './postgres-node-pg.ts';
import type { ChartServiceRepository } from './repository.ts';

const MEMORY_REPOSITORY_SCHEMA_VERSION = [
  'auth-password-hash-v1',
  'password-reset-v1',
  'email-outbox-v1',
  'sales-teams-v1',
  'payment-transfer-settings-v1',
  'telegram-signal-watch-state-v1',
  'signal-events-v1',
  'signal-event-claim-v1',
].join('-');

export type ChartServiceRepositoryAdapterKind = 'memory' | 'postgres';

export type ChartServiceRepositoryRuntimeEnv = {
  NODE_ENV?: string;
  CHART_SERVICE_REPOSITORY?: string;
  CHART_SERVICE_DATABASE_URL?: string;
  CHART_SERVICE_DATABASE_SSL_MODE?: string;
  CHART_SERVICE_RUNTIME_TARGET?: string;
  CHART_SERVICE_TELEGRAM_CRON_ENABLED?: string;
  CHART_SERVICE_SIGNAL_MONITOR_ENABLED?: string;
  CHART_SERVICE_SIGNAL_MONITOR_INTERVAL_MS?: string;
  CHART_SERVICE_SIGNAL_MONITOR_SETTLE_DELAY_MS?: string;
  CHART_SERVICE_SIGNAL_MONITOR_CANDLE_LIMIT?: string;
  HYPERDRIVE?: { connectionString?: string };
};

export type ChartServiceRepositoryAdapterConfig = {
  adapter?: string | null;
  databaseUrl?: string | null;
  databaseSslMode?: string | null;
  runtimeTarget?: string | null;
  runtimeMode?: string | null;
  postgresQueryExecutor?: PostgresQueryExecutor | null;
  postgresPoolFactory?: ((options: PgPoolOptions) => PgPoolLike) | null;
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
    databaseUrl: env.HYPERDRIVE?.connectionString ?? env.CHART_SERVICE_DATABASE_URL,
    databaseSslMode: env.CHART_SERVICE_DATABASE_SSL_MODE,
    runtimeTarget: env.CHART_SERVICE_RUNTIME_TARGET,
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
    runtimeTarget: config.runtimeTarget,
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

  const queryExecutor = config.postgresQueryExecutor
    ?? createPostgresQueryExecutorFromPoolFactory(config, adapter)
    ?? createPostgresQueryExecutorFromRuntime(adapter);
  if (!queryExecutor) {
    throw new Error('Postgres query executor is required before the async repository adapter can be used.');
  }

  const repository = createPostgresAsyncChartServiceRepository(queryExecutor);
  const runRead = async <T>(
    operation: (repository: AsyncChartServiceRepository) => T | Promise<T>,
  ): Promise<Awaited<T>> => await operation(repository);
  const runMutation = async <T>(
    operation: (repository: AsyncChartServiceRepository) => T | Promise<T>,
  ): Promise<Awaited<T>> => {
    if (!isTransactionalPostgresQueryExecutor(queryExecutor)) {
      return await operation(repository);
    }

    return await queryExecutor.transaction(async (transactionExecutor) => {
      const transactionRepository = createPostgresAsyncChartServiceRepository(transactionExecutor);
      return await operation(transactionRepository);
    });
  };

  return {
    repository,
    runRead,
    runMutation,
  };
}

function createPostgresQueryExecutorFromPoolFactory(
  config: ChartServiceRepositoryAdapterConfig,
  adapter: ResolvedChartServiceRepositoryAdapter,
): PostgresQueryExecutor | null {
  if (!config.postgresPoolFactory) return null;
  if (!adapter.connection) {
    throw new Error('Postgres repository adapter resolved without connection settings');
  }

  return createPgPostgresQueryExecutor(config.postgresPoolFactory(createPgPoolOptions(adapter.connection)));
}

function createPostgresQueryExecutorFromRuntime(
  adapter: ResolvedChartServiceRepositoryAdapter,
): PostgresQueryExecutor | null {
  if (!adapter.connection) return null;
  return createNodePgPostgresQueryExecutor(adapter.connection);
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
  const processEnv: ChartServiceRepositoryRuntimeEnv = ((globalThis as typeof globalThis & {
    process?: { env?: ChartServiceRepositoryRuntimeEnv };
  }).process?.env) ?? {};
  const hyperdriveConnectionString = getHyperdriveConnectionString();
  if (!hyperdriveConnectionString) return processEnv;

  return {
    ...processEnv,
    CHART_SERVICE_DATABASE_URL: hyperdriveConnectionString,
  };
}

function getHyperdriveConnectionString(): string | null {
  try {
    const context = getCloudflareContext();
    const hyperdrive = (context.env as {
      HYPERDRIVE?: { connectionString?: string };
    }).HYPERDRIVE;
    return hyperdrive?.connectionString ?? null;
  } catch {
    return null;
  }
}
