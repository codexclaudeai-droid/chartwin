import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve('.');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const wranglerSource = fs.readFileSync(path.join(repoRoot, 'wrangler.jsonc'), 'utf8');
const viteConfigSource = fs.readFileSync(path.join(repoRoot, 'vite.config.js'), 'utf8');

function runGuard(configSource) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chartwin-guard-'));
  const configPath = path.join(dir, 'wrangler.jsonc');
  fs.writeFileSync(configPath, configSource);
  return spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/guard-cloudflare-deploy.mjs'),
    '--config',
    configPath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function runPagesBuildGuard(env = {}) {
  return spawnSync(process.execPath, [
    path.join(repoRoot, 'scripts/guard-cloudflare-pages-build.mjs'),
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  });
}

test('Cloudflare deploy scripts cannot run a Workers deploy from this chart repo', () => {
  assert.match(packageJson.scripts.prebuild ?? '', /guard-cloudflare-pages-build\.mjs/);
  assert.match(viteConfigSource, /guard-cloudflare-pages-build\.mjs/);
  assert.match(packageJson.scripts['deploy:cloudflare'], /guard-cloudflare-deploy\.mjs/);
  assert.match(packageJson.scripts['deploy:cloudflare'], /wrangler pages deploy/);
  assert.doesNotMatch(packageJson.scripts['deploy:cloudflare'], /\bwrangler deploy\b/);
  assert.doesNotMatch(packageJson.scripts['deploy:cloudflare'], /--project-name\s+chartwin\b/);
  assert.doesNotMatch(packageJson.scripts['deploy:cloudflare:prod'], /\bwrangler (pages )?deploy\b/);
});

test('wrangler config is isolated from the production chartwin Worker', () => {
  assert.match(wranglerSource, /"pages_build_output_dir"\s*:\s*"\.\/dist"/);
  assert.doesNotMatch(wranglerSource, /"main"\s*:/);
  assert.doesNotMatch(wranglerSource, /"assets"\s*:/);
  assert.doesNotMatch(wranglerSource, /"routes"\s*:/);
  assert.doesNotMatch(wranglerSource, /"workers_dev"\s*:/);
  assert.doesNotMatch(wranglerSource, /tradingcore\.co/);
  assert.doesNotMatch(wranglerSource, /"chartwin"/);
  assert.doesNotMatch(wranglerSource, /CHART_SERVICE_/);
  assert.doesNotMatch(wranglerSource, /"send_email"\s*:/);
  assert.doesNotMatch(wranglerSource, /"hyperdrive"\s*:/);
});

test('deploy guard rejects production Worker-shaped wrangler config', () => {
  const result = runGuard(`{
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "chartwin",
    "main": "./worker/index.js",
    "workers_dev": true,
    "routes": [{ "pattern": "tradingcore.co", "custom_domain": true }],
    "vars": { "CHART_SERVICE_BASE_URL": "https://tradingcore.co" },
    "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "abc" }],
    "send_email": [{ "name": "EMAIL" }]
  }`);

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /Blocked Cloudflare deploy/i);
  assert.match(`${result.stderr}${result.stdout}`, /chartwin/);
  assert.match(`${result.stderr}${result.stdout}`, /tradingcore\.co/);
});

test('deploy guard accepts this chart Pages config', () => {
  const result = runGuard(wranglerSource);

  assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
});

test('Pages build guard blocks Git deployments to chartwin.pages.dev', () => {
  const result = runPagesBuildGuard({
    CF_PAGES: '1',
    CF_PAGES_BRANCH: 'codex/nq-signal-history-guards',
    CF_PAGES_COMMIT_SHA: '527c3b4',
    CF_PAGES_URL: 'https://88e66bd8.chartwin.pages.dev',
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /Blocked Cloudflare Pages build/i);
  assert.match(`${result.stderr}${result.stdout}`, /chartwin\.pages\.dev/);
});

test('Pages build guard allows local and non-chartwin Pages builds', () => {
  const localResult = runPagesBuildGuard();

  assert.equal(localResult.status, 0, `${localResult.stderr}${localResult.stdout}`);

  const otherPagesResult = runPagesBuildGuard({
    CF_PAGES: '1',
    CF_PAGES_URL: 'https://example.pages.dev',
  });

  assert.equal(otherPagesResult.status, 0, `${otherPagesResult.stderr}${otherPagesResult.stdout}`);
});
