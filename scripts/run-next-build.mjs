import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Keep this path deterministic so Next does not append a new tsconfig include on every build.
const distDir = '.tmp/next-service-build';
const tsconfigPath = 'tsconfig.json';
const originalTsconfig = readFileSync(tsconfigPath, 'utf8');
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
