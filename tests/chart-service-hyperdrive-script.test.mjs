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
    JSON.stringify({
      name: 'chartwin',
      compatibility_date: '2026-05-20',
      main: '.open-next/worker.js',
    }),
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
