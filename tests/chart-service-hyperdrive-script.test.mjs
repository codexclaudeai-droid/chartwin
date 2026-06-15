import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Hyperdrive setup script can bind a pre-created config without Cloudflare API permissions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chart-service-hyperdrive-'));
  fs.writeFileSync(
    path.join(tempDir, 'wrangler.jsonc'),
    [
      '{',
      '  "name": "chartwin",',
      '  "compatibility_date": "2026-05-20",',
      '  "main": ".open-next/worker.js",',
      '  "vars": {',
      '    "CHART_SERVICE_BASE_URL": "https://tradingcore.co"',
      '  }',
      '  // Telegram monitor cron is intentionally paused.',
      '}',
    ].join('\n'),
  );

  const result = spawnSync(
    process.execPath,
    [path.resolve('scripts/ensure-cloudflare-hyperdrive.mjs')],
    {
      cwd: tempDir,
      env: {
        CLOUDFLARE_HYPERDRIVE_ID: '023e105f4ecef8ad9ca31a8372d0c353',
        CLOUDFLARE_HYPERDRIVE_NAME: 'tradingcore-hyperdrive',
        CLOUDFLARE_HYPERDRIVE_BINDING: 'HYPERDRIVE',
      },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /HYPERDRIVE READY/);

  const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'wrangler.jsonc'), 'utf8'));
  assert.deepEqual(config.hyperdrive, [
    {
      binding: 'HYPERDRIVE',
      id: '023e105f4ecef8ad9ca31a8372d0c353',
    },
  ]);
});

test('Hyperdrive setup script does not refresh existing config origins unless explicitly enabled', () => {
  const source = fs.readFileSync(new URL('../scripts/ensure-cloudflare-hyperdrive.mjs', import.meta.url), 'utf8');

  assert.match(source, /CLOUDFLARE_HYPERDRIVE_SYNC_ORIGIN/);
  assert.match(source, /const hyperdrive = configuredHyperdriveId[\s\S]*\? \{ id: configuredHyperdriveId \}/);
  assert.match(source, /if \(!shouldSyncOrigin\) return existingConfig;/);
  assert.match(source, /updateHyperdrive/);
  assert.match(source, /cloudflareRequest\('PATCH'/);
});
