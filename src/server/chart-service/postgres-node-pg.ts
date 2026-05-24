import { Pool, type PoolConfig } from 'pg';
import type { PostgresConnectionSettings } from './postgres-connection.ts';
import {
  createPgPoolOptions,
  createPgPostgresQueryExecutor,
} from './postgres-pg-executor.ts';
import type { PostgresQueryExecutor } from './postgres-repository.ts';

export function createNodePgPostgresQueryExecutor(
  settings: PostgresConnectionSettings,
): PostgresQueryExecutor {
  return createPgPostgresQueryExecutor(new Pool(createPgPoolOptions(settings) as PoolConfig));
}
