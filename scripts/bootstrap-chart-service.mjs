import {
  bootstrapAsyncChartServiceRepository,
  createNodePgPostgresQueryExecutor,
  createPostgresAsyncChartServiceRepository,
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
  const migration = await runChartServicePostgresSchemaMigration(executor);
  const repository = createPostgresAsyncChartServiceRepository(executor);
  const bootstrap = await bootstrapAsyncChartServiceRepository(repository, {
    initialAdmin: {
      email: process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD,
      name: process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_NAME,
    },
  });

  console.log(`Applied chart service Postgres schema migration: ${migration.statementCount} statements.`);
  console.log(
    [
      `Seeded plans: ${bootstrap.createdPlanCount}`,
      `existing plans: ${bootstrap.skippedPlanCount}`,
      `created initial admin: ${bootstrap.createdAdmin ? 'yes' : 'no'}`,
      `updated initial admin: ${bootstrap.updatedAdmin ? 'yes' : 'no'}`,
      `existing initial admin: ${bootstrap.skippedAdmin ? 'yes' : 'no'}`,
    ].join(', '),
  );
} finally {
  await executor.close();
}
