import {
  authenticateAsyncUserWithPassword,
  createNodePgPostgresQueryExecutor,
  createPostgresAsyncChartServiceRepository,
  resolvePostgresConnectionSettings,
} from '../src/server/chart-service/index.ts';

const email = process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
const password = process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD ?? '';

if (!email || !password) {
  throw new Error('Postgres admin login check requires CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL and CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD.');
}

const settings = resolvePostgresConnectionSettings({
  databaseUrl: process.env.CHART_SERVICE_DATABASE_URL,
  databaseSslMode: process.env.CHART_SERVICE_DATABASE_SSL_MODE,
  runtimeMode: process.env.NODE_ENV,
});
const executor = createNodePgPostgresQueryExecutor(settings);

try {
  const repository = createPostgresAsyncChartServiceRepository(executor);
  const { user } = await authenticateAsyncUserWithPassword(repository, {
    email,
    password,
    createdAt: new Date().toISOString(),
  });

  if (user.role !== 'super_admin') {
    throw new Error(`Postgres admin login check expected super_admin but got ${user.role}.`);
  }

  console.log(`Postgres admin login check passed for ${user.email}.`);
} finally {
  await executor.close();
}
