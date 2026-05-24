import type { PostgresConnectionSettings, PostgresSslMode } from './postgres-connection.ts';
import type {
  PostgresQueryExecutor,
  PostgresQueryResult,
  TransactionalPostgresQueryExecutor,
} from './postgres-repository.ts';
import type { PostgresRow, PostgresStatement } from './postgres-mappers.ts';

export type PgClientLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: PostgresRow[] }>;
  release?(): void;
};

export type PgPoolLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: PostgresRow[] }>;
  connect?(): Promise<PgClientLike>;
};

export type PgPoolOptions = {
  connectionString: string;
  ssl?: false | { rejectUnauthorized: boolean };
};

export function createPgPostgresQueryExecutor(pool: PgPoolLike): PostgresQueryExecutor | TransactionalPostgresQueryExecutor {
  const executor: PostgresQueryExecutor = {
    async query(statement: PostgresStatement): Promise<PostgresQueryResult> {
      const result = await pool.query(statement.sql, statement.values);
      return { rows: result.rows };
    },
  };

  if (typeof pool.connect !== 'function') {
    return executor;
  }

  return {
    ...executor,
    async transaction<T>(operation: (executor: PostgresQueryExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect!();
      const transactionExecutor = createPgPostgresQueryExecutor(client);
      await client.query('begin');
      try {
        const result = await operation(transactionExecutor);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release?.();
      }
    },
  };
}

export function createPgPoolOptions(settings: PostgresConnectionSettings): PgPoolOptions {
  const options: PgPoolOptions = {
    connectionString: settings.connectionString,
  };
  const ssl = createPgSslOption(settings.sslMode);
  if (ssl !== undefined) {
    options.ssl = ssl;
  }
  return options;
}

function createPgSslOption(sslMode: PostgresSslMode): PgPoolOptions['ssl'] | undefined {
  if (sslMode === 'disable') return false;
  if (sslMode === 'require') return { rejectUnauthorized: false };
  if (sslMode === 'verify-ca' || sslMode === 'verify-full') return { rejectUnauthorized: true };
  return undefined;
}
