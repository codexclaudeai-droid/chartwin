import { renderChartServicePostgresSchema } from './database-schema.ts';
import type { PostgresStatement } from './postgres-mappers.ts';
import type { PostgresQueryExecutor } from './postgres-repository.ts';

export type ChartServicePostgresMigrationOptions = {
  schemaSql?: string;
  useTransaction?: boolean;
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
  const statements = splitPostgresMigrationStatements(options.schemaSql ?? renderChartServicePostgresSchema());
  const useTransaction = options.useTransaction ?? true;

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

