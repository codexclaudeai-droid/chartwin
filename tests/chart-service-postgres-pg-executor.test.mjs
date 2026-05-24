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

test('pg pool options preserve the connection string and normalize SSL behavior', async () => {
  const { createPgPoolOptions } = await import('../src/server/chart-service/index.ts');
  const requiredSsl = resolvePostgresConnectionSettings({
    databaseUrl: 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=require',
  });
  const disabledSsl = resolvePostgresConnectionSettings({
    databaseUrl: 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=disable',
  });

  assert.deepEqual(createPgPoolOptions(requiredSsl), {
    connectionString: 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=require',
    ssl: { rejectUnauthorized: false },
  });
  assert.deepEqual(createPgPoolOptions(disabledSsl), {
    connectionString: 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=disable',
    ssl: false,
  });
});
