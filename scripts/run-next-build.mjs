import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

// Keep this path deterministic so Next does not append a new tsconfig include on every build.
const distDir = '.tmp/next-service-build';
const tsconfigPath = 'tsconfig.json';
const originalTsconfig = readFileSync(tsconfigPath, 'utf8');
rmSync(distDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  env: {
    ...process.env,
    NEXT_DIST_DIR: distDir,
  },
  stdio: 'inherit',
});
writeFileSync(tsconfigPath, originalTsconfig);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
