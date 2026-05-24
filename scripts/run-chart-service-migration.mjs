import {
  createNodePgPostgresQueryExecutor,
  resolvePostgresConnectionSettings,
  runChartServicePostgresSchemaMigration,
} from '../src/server/chart-service/index.ts';

const settings = resolvePostgresConnectionSettings({
  databaseUrl: process.env.CHART_SERVICE_DATABASE_URL,
  databaseSslMode: process.env.CHART_SERVICE_DATABASE_SSL_MODE,
  runtimeMode: process.env.NODE_ENV,
});

const executor = createNodePgPostgresQueryExecutor(settings);

try {
  const result = await runChartServicePostgresSchemaMigration(executor);
  console.log(`Applied chart service Postgres schema migration: ${result.statementCount} statements.`);
} finally {
  await executor.close();
}

