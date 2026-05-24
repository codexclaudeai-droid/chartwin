import { Pool, type PoolConfig } from 'pg';
import type { PostgresConnectionSettings } from './postgres-connection.ts';
import {
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
  const pool = new Pool(createPgPoolOptions(settings) as PoolConfig);
  const executor = createPgPostgresQueryExecutor(pool);
  if (!isTransactionalPostgresQueryExecutor(executor)) {
    throw new Error('Node pg Pool must support transaction-capable client connections.');
  }

  return {
    ...executor,
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
