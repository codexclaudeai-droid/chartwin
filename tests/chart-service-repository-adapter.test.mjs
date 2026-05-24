import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAsyncChartServicePersistenceFromConfig,
  createChartServiceRepositoryFromConfig,
  getChartServiceRepository,
  getChartServiceRepositoryConfigSignature,
  resolvePostgresConnectionSettings,
  resolveChartServiceRepositoryAdapter,
} from '../src/server/chart-service/index.ts';

test('repository adapter defaults to isolated in-memory persistence', () => {
  const resolved = resolveChartServiceRepositoryAdapter({});

  assert.deepEqual(resolved, {
    kind: 'memory',
    isPersistent: false,
    label: 'In-memory mock repository',
  });

  const first = createChartServiceRepositoryFromConfig({});
  first.saveUser({
    id: 'user_temp',
    email: 'temp@example.com',
    name: 'Temp',
    role: 'member',
    accountStatus: 'active',
    passwordHash: 'pbkdf2_sha256$1$test$test',
  });

  const second = createChartServiceRepositoryFromConfig({});
  assert.equal(second.getUserById('user_temp'), null);
});

test('postgres repository adapter requires a database url before selection', () => {
  assert.throws(
    () => resolveChartServiceRepositoryAdapter({ adapter: 'postgres' }),
    /CHART_SERVICE_DATABASE_URL/,
  );

  const resolved = resolveChartServiceRepositoryAdapter({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart-service.local/app',
  });

  assert.equal(resolved.kind, 'postgres');
  assert.equal(resolved.isPersistent, true);
  assert.equal(resolved.label, 'Postgres repository adapter');
  assert.equal(resolved.connection.safeLabel, 'postgres://chart-service.local/app?sslmode=prefer');
});

test('repository adapter rejects unknown persistence modes early', () => {
  assert.throws(
    () => resolveChartServiceRepositoryAdapter({ adapter: 'sqlite' }),
    /Unsupported chart service repository adapter/,
  );
});

test('global repository singleton is keyed by resolved adapter config', () => {
  const env = { CHART_SERVICE_REPOSITORY: 'memory' };
  const first = getChartServiceRepository(env);
  const second = getChartServiceRepository(env);

  assert.equal(first, second);
});

test('memory repository signature carries the service data schema version', () => {
  const signature = getChartServiceRepositoryConfigSignature({
    adapter: 'memory',
  });

  assert.match(signature, /^memory:/);
  assert.match(signature, /auth-password-hash/);
  assert.match(signature, /password-reset/);
  assert.match(signature, /email-outbox/);
  assert.match(signature, /sales-teams/);
  assert.match(signature, /payment-transfer-settings/);
});

test('postgres connection settings redact credentials and normalize SSL mode', () => {
  const settings = resolvePostgresConnectionSettings({
    databaseUrl: ' postgresql://chart_app:super-secret@db.example.com:5432/chart_service?sslmode=verify-full ',
  });

  assert.equal(settings.host, 'db.example.com');
  assert.equal(settings.port, '5432');
  assert.equal(settings.databaseName, 'chart_service');
  assert.equal(settings.hasCredentials, true);
  assert.equal(settings.sslMode, 'verify-full');
  assert.equal(settings.safeLabel, 'postgresql://db.example.com:5432/chart_service?sslmode=verify-full');
  assert.equal(JSON.stringify(settings).includes('super-secret'), false);
});

test('postgres adapter rejects invalid connection protocol and SSL mode early', () => {
  assert.throws(
    () => resolveChartServiceRepositoryAdapter({
      adapter: 'postgres',
      databaseUrl: 'mysql://user:secret@db.example.com/chart_service',
    }),
    /postgres connection URL/,
  );

  assert.throws(
    () => resolveChartServiceRepositoryAdapter({
      adapter: 'postgres',
      databaseUrl: 'postgres://user:secret@db.example.com/chart_service?sslmode=off',
    }),
    /Unsupported CHART_SERVICE_DATABASE_SSL_MODE/,
  );
});

test('postgres repository signatures are credential-safe but connection-specific', () => {
  const first = getChartServiceRepositoryConfigSignature({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart_app:secret-one@db.example.com/chart_service',
  });
  const second = getChartServiceRepositoryConfigSignature({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart_app:secret-two@db.example.com/chart_service',
  });

  assert.notEqual(first, second);
  assert.equal(first.includes('secret-one'), false);
  assert.equal(second.includes('secret-two'), false);
  assert.match(first, /^postgres:postgres:\/\/db\.example\.com\/chart_service\?sslmode=prefer:/);
});

test('async persistence factory creates isolated awaitable memory adapters', async () => {
  const first = createAsyncChartServicePersistenceFromConfig({ adapter: 'memory' });
  const second = createAsyncChartServicePersistenceFromConfig({ adapter: 'memory' });

  await first.runMutation((repository) => repository.saveUser({
    id: 'user_async_factory',
    email: 'factory@example.com',
    name: 'Factory User',
    role: 'member',
    accountStatus: 'active',
    passwordHash: 'pbkdf2_sha256$1$test$test',
  }));

  assert.equal((await first.repository.getUserById('user_async_factory'))?.email, 'factory@example.com');
  assert.equal(await second.repository.getUserById('user_async_factory'), null);
});

test('async persistence factory can create postgres persistence from the runtime pg client', () => {
  const persistence = createAsyncChartServicePersistenceFromConfig({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart_app:secret@db.example.com/chart_service',
  });

  assert.equal(typeof persistence.repository.getUserById, 'function');
});

test('async persistence factory can create postgres persistence from an injected executor', async () => {
  const calls = [];
  const persistence = createAsyncChartServicePersistenceFromConfig({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart_app:secret@db.example.com/chart_service',
    postgresQueryExecutor: {
      async query(statement) {
        calls.push(statement);
        return {
          rows: [{
            id: 'user_1',
            email: 'member@example.com',
            name: 'Member',
            role: 'member',
            account_status: 'active',
            password_hash: 'hash',
          }],
        };
      },
    },
  });

  const user = await persistence.runRead((repository) => repository.getUserById('user_1'));

  assert.equal(user.email, 'member@example.com');
  assert.equal(calls[0].sql, 'select * from users where id = $1');
  assert.deepEqual(calls[0].values, ['user_1']);
});

test('postgres async persistence runs mutations through a transaction-capable executor', async () => {
  const calls = [];
  const queryExecutor = {
    async query(statement) {
      calls.push(`read:${statement.sql}`);
      return { rows: [] };
    },
    async transaction(operation) {
      calls.push('begin');
      const result = await operation({
        async query(statement) {
          calls.push(`tx:${statement.sql}`);
          return { rows: [] };
        },
      });
      calls.push('commit');
      return result;
    },
  };
  const persistence = createAsyncChartServicePersistenceFromConfig({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart_app:secret@db.example.com/chart_service',
    postgresQueryExecutor: queryExecutor,
  });

  await persistence.runRead((repository) => repository.listPlans());
  await persistence.runMutation((repository) => repository.saveUser({
    id: 'user_tx',
    email: 'tx@example.com',
    name: 'Tx User',
    role: 'member',
    accountStatus: 'active',
    passwordHash: 'hash',
  }));

  assert.equal(calls[0], 'read:select * from subscription_plans');
  assert.equal(calls[1], 'begin');
  assert.match(calls[2], /^tx:insert into users /);
  assert.equal(calls.at(-1), 'commit');
});

test('postgres async persistence rolls back transaction-capable mutations on failure', async () => {
  const calls = [];
  const persistence = createAsyncChartServicePersistenceFromConfig({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart_app:secret@db.example.com/chart_service',
    postgresQueryExecutor: {
      async query() {
        return { rows: [] };
      },
      async transaction(operation) {
        calls.push('begin');
        try {
          return await operation({
            async query(statement) {
              calls.push(`tx:${statement.sql}`);
              return { rows: [] };
            },
          });
        } catch (error) {
          calls.push('rollback');
          throw error;
        }
      },
    },
  });

  await assert.rejects(
    persistence.runMutation(async (repository) => {
      await repository.savePlan({
        id: 'plan_tx',
        name: 'Tx Plan',
        durationDays: 30,
        basePriceUsd: 99,
        discountPercent: 0,
        isActive: true,
      });
      throw new Error('stop transaction');
    }),
    /stop transaction/,
  );

  assert.equal(calls[0], 'begin');
  assert.match(calls[1], /^tx:insert into subscription_plans /);
  assert.equal(calls.at(-1), 'rollback');
});

test('async persistence factory can create postgres persistence from a pool factory', async () => {
  const poolCalls = [];
  const queryCalls = [];
  const persistence = createAsyncChartServicePersistenceFromConfig({
    adapter: 'postgres',
    databaseUrl: 'postgres://chart_app:secret@db.example.com/chart_service?sslmode=require',
    postgresPoolFactory(options) {
      poolCalls.push(options);
      return {
        async query(sql, values) {
          queryCalls.push({ sql, values });
          return {
            rows: [{
              id: 'user_2',
              email: 'pool@example.com',
              name: 'Pool User',
              role: 'member',
              account_status: 'active',
              password_hash: 'hash',
            }],
          };
        },
      };
    },
  });

  const user = await persistence.runRead((repository) => repository.getUserById('user_2'));

  assert.equal(user.email, 'pool@example.com');
  assert.deepEqual(poolCalls[0], {
    connectionString: 'postgres://chart_app:secret@db.example.com/chart_service?sslmode=require',
    ssl: { rejectUnauthorized: false },
  });
  assert.deepEqual(queryCalls[0], {
    sql: 'select * from users where id = $1',
    values: ['user_2'],
  });
});
