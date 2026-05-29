import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const nextDistDir = '.next';
const workerOutputDir = '.open-next';
const runner = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  NEXT_DIST_DIR: nextDistDir,
  NODE_ENV: 'production',
};

rmSync(nextDistDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
rmSync(workerOutputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

run(runner, ['next', 'build'], env);
run(runner, [
  'opennextjs-cloudflare',
  'build',
  '--skipNextBuild',
  '--dangerouslyUseUnsupportedNextVersion',
], env);

function run(command, args, runEnv) {
  const result = spawnSync(command, args, {
    env: runEnv,
    shell: true,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
