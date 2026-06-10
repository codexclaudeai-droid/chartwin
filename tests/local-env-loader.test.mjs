import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('local env loader reads .env.local without overriding existing process values', async () => {
  const { loadLocalEnvFiles } = await import('../server/load-local-env.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'chart-env-'));
  const env = {
    CHART_SERVICE_REPOSITORY: 'memory',
  };

  try {
    await writeFile(join(dir, '.env.local'), [
      'CHART_SERVICE_REPOSITORY=postgres',
      'CHART_SERVICE_DATABASE_URL=postgresql://chart_app:secret@db.example.com/chart_service?sslmode=require',
      'CHART_SERVICE_DATABASE_SSL_MODE=require',
      'COMMENTED_VALUE=first # keep hash comments outside quotes',
      'QUOTED_VALUE="hello world"',
    ].join('\n'));

    const result = loadLocalEnvFiles({ cwd: dir, env });

    assert.equal(result.loadedFiles.length, 1);
    assert.equal(env.CHART_SERVICE_REPOSITORY, 'memory');
    assert.equal(env.CHART_SERVICE_DATABASE_URL, 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=require');
    assert.equal(env.CHART_SERVICE_DATABASE_SSL_MODE, 'require');
    assert.equal(env.COMMENTED_VALUE, 'first');
    assert.equal(env.QUOTED_VALUE, 'hello world');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('data gateway imports the local env loader before postgres store initialization', () => {
  const source = readFileSync(new URL('../server/data-gateway.mjs', import.meta.url), 'utf8');

  assert.match(source, /import '\.\/load-local-env\.mjs';/);
  assert.match(source, /createMarketCandlePostgresStoreFromEnv\(process\.env\)/);
});

test('postgres operation scripts import the local env loader', () => {
  const migration = readFileSync(new URL('../scripts/run-chart-service-migration.mjs', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../scripts/bootstrap-chart-service.mjs', import.meta.url), 'utf8');

  assert.match(migration, /import '\.\.\/server\/load-local-env\.mjs';/);
  assert.match(bootstrap, /import '\.\.\/server\/load-local-env\.mjs';/);
});
