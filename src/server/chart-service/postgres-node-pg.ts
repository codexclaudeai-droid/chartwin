import { Pool, type PoolConfig } from 'pg';
import type { PostgresConnectionSettings } from './postgres-connection.ts';
import {
  createPgPoolOptions,
  createPgPostgresQueryExecutor,
} from './postgres-pg-executor.ts';
import type { PostgresQueryExecutor } from './postgres-repository.ts';

export type ClosablePostgresQueryExecutor = PostgresQueryExecutor & {
  close(): Promise<void>;
};

export function createNodePgPostgresQueryExecutor(
  settings: PostgresConnectionSettings,
): ClosablePostgresQueryExecutor {
  const pool = new Pool(createPgPoolOptions(settings) as PoolConfig);
  const executor = createPgPostgresQueryExecutor(pool);

  return {
    ...executor,
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
