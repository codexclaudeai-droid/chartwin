import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePostgresConnectionSettings } from '../src/server/chart-service/index.ts';

test('pg executor adapts Pool.query(sql, values) to the postgres statement executor', async () => {
  const { createPgPostgresQueryExecutor } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ id: 'user_1' }] };
    },
  };

  const executor = createPgPostgresQueryExecutor(pool);
  const result = await executor.query({
    sql: 'select * from users where id = $1',
    values: ['user_1'],
  });

  assert.deepEqual(result.rows, [{ id: 'user_1' }]);
  assert.deepEqual(calls, [{
    sql: 'select * from users where id = $1',
    values: ['user_1'],
  }]);
});

test('pg pool options strip sslmode from the connection string and normalize SSL behavior', async () => {
  const { createPgPoolOptions } = await import('../src/server/chart-service/index.ts');
  const requiredSsl = resolvePostgresConnectionSettings({
    databaseUrl: 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=require',
  });
  const disabledSsl = resolvePostgresConnectionSettings({
    databaseUrl: 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=disable',
  });
  const cloudflareSsl = resolvePostgresConnectionSettings({
    databaseUrl: 'postgresql://postgres.project-ref:secret@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require',
    runtimeTarget: 'cloudflare-workers',
  });
  const hyperdriveSsl = resolvePostgresConnectionSettings({
    databaseUrl: 'postgresql://token.hyperdrive.local:5432/config-id',
    databaseSslMode: 'require',
    runtimeTarget: 'cloudflare-workers',
    runtimeMode: 'production',
  });

  assert.deepEqual(createPgPoolOptions(requiredSsl), {
    connectionString: 'postgresql://chart_app:secret@db.example.com/chart_service',
    ssl: { rejectUnauthorized: false },
  });
  assert.deepEqual(createPgPoolOptions(disabledSsl), {
    connectionString: 'postgresql://chart_app:secret@db.example.com/chart_service',
    ssl: false,
  });
  assert.deepEqual(createPgPoolOptions(cloudflareSsl), {
    connectionString: 'postgresql://postgres:secret@db.project-ref.supabase.co:5432/postgres',
    ssl: true,
  });
  assert.deepEqual(createPgPoolOptions(hyperdriveSsl), {
    connectionString: 'postgresql://token.hyperdrive.local:5432/config-id',
    ssl: false,
  });
});

test('pg client executor opens a fresh client for each plain query', async () => {
  const { createPgClientPostgresQueryExecutor } = await import('../src/server/chart-service/index.ts');
  const lifecycle = [];
  let clientIndex = 0;
  const executor = createPgClientPostgresQueryExecutor(() => {
    const id = ++clientIndex;
    return {
      async connect() {
        lifecycle.push(`connect:${id}`);
      },
      async query(sql, values) {
        lifecycle.push({ id, sql, values });
        return { rows: [{ id }] };
      },
      async end() {
        lifecycle.push(`end:${id}`);
      },
    };
  });

  assert.deepEqual((await executor.query({ sql: 'select $1', values: ['a'] })).rows, [{ id: 1 }]);
  assert.deepEqual((await executor.query({ sql: 'select $1', values: ['b'] })).rows, [{ id: 2 }]);
  assert.deepEqual(lifecycle, [
    'connect:1',
    { id: 1, sql: 'select $1', values: ['a'] },
    'end:1',
    'connect:2',
    { id: 2, sql: 'select $1', values: ['b'] },
    'end:2',
  ]);
});

test('pg client executor keeps transaction statements on one client', async () => {
  const { createPgClientPostgresQueryExecutor } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = createPgClientPostgresQueryExecutor(() => ({
    async connect() {
      calls.push('connect');
    },
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ ok: true }] };
    },
    async end() {
      calls.push('end');
    },
  }));

  const result = await executor.transaction(async (transactionExecutor) => (
    await transactionExecutor.query({ sql: 'insert into users(id) values($1)', values: ['user_1'] })
  ));

  assert.deepEqual(result.rows, [{ ok: true }]);
  assert.deepEqual(calls, [
    'connect',
    { sql: 'begin', values: undefined },
    { sql: 'insert into users(id) values($1)', values: ['user_1'] },
    { sql: 'commit', values: undefined },
    'end',
  ]);
});
