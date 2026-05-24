import type { PostgresConnectionSettings, PostgresSslMode } from './postgres-connection.ts';
import type { PostgresQueryExecutor, PostgresQueryResult } from './postgres-repository.ts';
import type { PostgresRow, PostgresStatement } from './postgres-mappers.ts';

export type PgPoolLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: PostgresRow[] }>;
};

export type PgPoolOptions = {
  connectionString: string;
  ssl?: false | { rejectUnauthorized: boolean };
};

export function createPgPostgresQueryExecutor(pool: PgPoolLike): PostgresQueryExecutor {
  return {
    async query(statement: PostgresStatement): Promise<PostgresQueryResult> {
      const result = await pool.query(statement.sql, statement.values);
      return { rows: result.rows };
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
