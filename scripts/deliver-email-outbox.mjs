import {
  createAsyncChartServiceRepository,
  createEmailDeliveryProviderFromEnv,
  createMockChartServiceRepository,
  createNodePgPostgresQueryExecutor,
  createPostgresAsyncChartServiceRepository,
  deliverQueuedEmailOutbox,
  isTransactionalPostgresQueryExecutor,
  resolveChartServiceRepositoryAdapter,
} from '../src/server/chart-service/index.ts';

const adapter = resolveChartServiceRepositoryAdapter({
  adapter: process.env.CHART_SERVICE_REPOSITORY,
  databaseUrl: process.env.CHART_SERVICE_DATABASE_URL,
  databaseSslMode: process.env.CHART_SERVICE_DATABASE_SSL_MODE,
  runtimeMode: process.env.NODE_ENV,
});
const provider = createEmailDeliveryProviderFromEnv(process.env);
const limit = process.env.CHART_SERVICE_EMAIL_DELIVERY_LIMIT
  ? Number(process.env.CHART_SERVICE_EMAIL_DELIVERY_LIMIT)
  : undefined;

if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
  throw new Error('CHART_SERVICE_EMAIL_DELIVERY_LIMIT must be a non-negative integer.');
}

let close = async () => {};
let summary;

try {
  if (adapter.kind === 'postgres') {
    if (!adapter.connection) {
      throw new Error('Postgres email delivery requires CHART_SERVICE_DATABASE_URL.');
    }
    const executor = createNodePgPostgresQueryExecutor(adapter.connection);
    close = () => executor.close();
    const deliver = async (queryExecutor) => {
      const repository = createPostgresAsyncChartServiceRepository(queryExecutor);
      return deliverQueuedEmailOutbox(repository, provider, {
        deliveredAt: new Date().toISOString(),
        limit,
      });
    };
    summary = isTransactionalPostgresQueryExecutor(executor)
      ? await executor.transaction(deliver)
      : await deliver(executor);
  } else {
    const repository = createAsyncChartServiceRepository(createMockChartServiceRepository());
    summary = await deliverQueuedEmailOutbox(repository, provider, {
      deliveredAt: new Date().toISOString(),
      limit,
    });
  }

  console.log(
    [
      `Email outbox delivery processed: ${summary.processed}`,
      `sent: ${summary.sent}`,
      `failed: ${summary.failed}`,
      `remaining queued: ${summary.remainingQueued}`,
    ].join(', '),
  );
} finally {
  await close();
}
