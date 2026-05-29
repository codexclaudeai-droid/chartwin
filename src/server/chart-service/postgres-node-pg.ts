import { Client, Pool, type ClientConfig, type PoolConfig } from 'pg';
import {
  isCloudflareHyperdriveConnection,
  type PostgresConnectionSettings,
} from './postgres-connection.ts';
import {
  createPgClientPostgresQueryExecutor,
  createPgPoolOptions,
  createPgPostgresQueryExecutor,
} from './postgres-pg-executor.ts';
import {
  isTransactionalPostgresQueryExecutor,
  type TransactionalPostgresQueryExecutor,
} from './postgres-repository.ts';

export type ClosablePostgresQueryExecutor = TransactionalPostgresQueryExecutor & {
  close(): Promise<void>;
};

export function createNodePgPostgresQueryExecutor(
  settings: PostgresConnectionSettings,
): ClosablePostgresQueryExecutor {
  if (shouldUseHyperdriveRequestClient(settings)) {
    const clientOptions = createPgPoolOptions(settings) as ClientConfig;
    const executor = createPgClientPostgresQueryExecutor(
      () => new Client(clientOptions),
      { closeClient: false },
    );
    return createLoggedClosablePostgresQueryExecutor(settings, executor, async () => undefined);
  }

  const pool = new Pool(createPgPoolOptions(settings) as PoolConfig);
  const executor = createPgPostgresQueryExecutor(pool);
  return createLoggedClosablePostgresQueryExecutor(settings, executor, async () => {
    await pool.end();
  });
}

function createLoggedClosablePostgresQueryExecutor(
  settings: PostgresConnectionSettings,
  executor: ReturnType<typeof createPgPostgresQueryExecutor> | ReturnType<typeof createPgClientPostgresQueryExecutor>,
  close: () => Promise<void>,
): ClosablePostgresQueryExecutor {
  if (!isTransactionalPostgresQueryExecutor(executor)) {
    throw new Error('Node pg executor must support transaction-capable client connections.');
  }

  return {
    ...executor,
    async query(statement) {
      try {
        return await executor.query(statement);
      } catch (error) {
        console.error('[chart-service-postgres-query-failed]', settings.safeLabel, renderErrorMessage(error));
        throw error;
      }
    },
    async transaction(operation) {
      try {
        return await executor.transaction(operation);
      } catch (error) {
        console.error('[chart-service-postgres-transaction-failed]', settings.safeLabel, renderErrorMessage(error));
        throw error;
      }
    },
    async close(): Promise<void> {
      await close();
    },
  };
}

function shouldUseHyperdriveRequestClient(settings: PostgresConnectionSettings): boolean {
  return settings.runtimeTarget === 'cloudflare-workers' && isCloudflareHyperdriveConnection(settings);
}

function renderErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
