import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('postgres migration splitter trims blank statements and preserves quoted semicolons', async () => {
  const { splitPostgresMigrationStatements } = await import('../src/server/chart-service/index.ts');

  const statements = splitPostgresMigrationStatements(`
    ;
    create table one (id text);
    create table two (note text default 'a;b');
  `);

  assert.deepEqual(statements, [
    'create table one (id text)',
    "create table two (note text default 'a;b')",
  ]);
});

test('postgres schema migration runner applies statements inside a transaction', async () => {
  const { runChartServicePostgresSchemaMigration } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      return { rows: [] };
    },
  };

  const result = await runChartServicePostgresSchemaMigration(executor, {
    schemaSql: `
      create table one (id text);
      create index one_id_idx on one (id);
    `,
  });

  assert.equal(result.statementCount, 2);
  assert.deepEqual(calls.map((call) => call.sql), [
    'begin',
    'create table one (id text)',
    'create index one_id_idx on one (id)',
    'commit',
  ]);
  assert.deepEqual(calls.map((call) => call.values), [[], [], [], []]);
});

test('postgres schema migration runner rolls back and rethrows when a statement fails', async () => {
  const { runChartServicePostgresSchemaMigration } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql.includes('bad_table')) {
        throw new Error('migration statement failed');
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    runChartServicePostgresSchemaMigration(executor, {
      schemaSql: `
        create table good_table (id text);
        create table bad_table (id text);
      `,
    }),
    /migration statement failed/,
  );

  assert.deepEqual(calls.map((call) => call.sql), [
    'begin',
    'create table good_table (id text)',
    'create table bad_table (id text)',
    'rollback',
  ]);
});

test('postgres schema migration runner uses a transaction-capable executor when available', async () => {
  const { runChartServicePostgresSchemaMigration } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query() {
      throw new Error('base executor should not be used for transactional migrations');
    },
    async transaction(operation) {
      calls.push('begin');
      const result = await operation({
        async query(statement) {
          calls.push(statement.sql);
          return { rows: [] };
        },
      });
      calls.push('commit');
      return result;
    },
  };

  const result = await runChartServicePostgresSchemaMigration(executor, {
    schemaSql: 'create table tx_table (id text);',
  });

  assert.equal(result.statementCount, 1);
  assert.deepEqual(calls, [
    'begin',
    'create table tx_table (id text)',
    'commit',
  ]);
});

test('postgres migration harness is wired into package scripts and closes the pg executor', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/run-chart-service-migration.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:migrate'], 'node scripts/run-chart-service-migration.mjs');
  assert.match(script, /resolvePostgresConnectionSettings/);
  assert.match(script, /createNodePgPostgresQueryExecutor/);
  assert.match(script, /runChartServicePostgresSchemaMigration/);
  assert.match(script, /close/);
});
