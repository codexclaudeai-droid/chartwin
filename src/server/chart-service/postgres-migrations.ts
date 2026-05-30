import { renderChartServicePostgresSchema } from './database-schema.ts';
import type { PostgresStatement } from './postgres-mappers.ts';
import {
  isTransactionalPostgresQueryExecutor,
  type PostgresQueryExecutor,
} from './postgres-repository.ts';

export type ChartServicePostgresMigrationOptions = {
  schemaSql?: string;
  useTransaction?: boolean;
  maxAttempts?: number;
  retryDelayMs?: number;
};

export type ChartServicePostgresMigrationResult = {
  statementCount: number;
};

export function splitPostgresMigrationStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (inSingleQuote && nextChar === "'") {
        current += nextChar;
        index += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      pushStatement(statements, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushStatement(statements, current);
  return statements;
}

export async function runChartServicePostgresSchemaMigration(
  executor: PostgresQueryExecutor,
  options: ChartServicePostgresMigrationOptions = {},
): Promise<ChartServicePostgresMigrationResult> {
  const maxAttempts = normalizeMigrationMaxAttempts(options.maxAttempts);
  const retryDelayMs = normalizeMigrationRetryDelayMs(options.retryDelayMs);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runChartServicePostgresSchemaMigrationOnce(executor, options);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryablePostgresMigrationError(error)) {
        throw error;
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw new Error('Postgres schema migration retry loop exited unexpectedly.');
}

async function runChartServicePostgresSchemaMigrationOnce(
  executor: PostgresQueryExecutor,
  options: ChartServicePostgresMigrationOptions,
): Promise<ChartServicePostgresMigrationResult> {
  const statements = splitPostgresMigrationStatements(options.schemaSql ?? renderChartServicePostgresSchema());
  const useTransaction = options.useTransaction ?? true;

  if (useTransaction && isTransactionalPostgresQueryExecutor(executor)) {
    return executor.transaction(async (transactionExecutor) => {
      for (const statement of statements) {
        await transactionExecutor.query(createPostgresMigrationStatement(statement));
      }
      return {
        statementCount: statements.length,
      };
    });
  }

  if (useTransaction) {
    await executor.query(createPostgresMigrationStatement('begin'));
  }

  try {
    for (const statement of statements) {
      await executor.query(createPostgresMigrationStatement(statement));
    }

    if (useTransaction) {
      await executor.query(createPostgresMigrationStatement('commit'));
    }
  } catch (error) {
    if (useTransaction) {
      await executor.query(createPostgresMigrationStatement('rollback'));
    }
    throw error;
  }

  return {
    statementCount: statements.length,
  };
}

function isRetryablePostgresMigrationError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '40P01' || code === '40001';
}

function normalizeMigrationMaxAttempts(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 3;
  return Math.max(1, Math.floor(value));
}

function normalizeMigrationRetryDelayMs(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 750;
  return Math.max(0, Math.floor(value));
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createPostgresMigrationStatement(sql: string): PostgresStatement {
  return {
    sql,
    values: [],
  };
}

function pushStatement(statements: string[], sql: string): void {
  const normalized = sql.trim();
  if (normalized) {
    statements.push(normalized);
  }
}
