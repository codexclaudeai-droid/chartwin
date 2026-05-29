import { spawnSync } from 'node:child_process';

const requiredEnv = [
  'CHART_SERVICE_REPOSITORY',
  'CHART_SERVICE_DATABASE_URL',
  'CHART_SERVICE_SESSION_SECRET',
  'CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL',
  'CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD',
];
const steps = [
  { name: 'service:prod-env:check' },
  { name: 'service:check' },
  { name: 'service:bootstrap' },
  { name: 'service:postgres:admin-check' },
  { name: 'service:security' },
  { name: 'service:build' },
];
const dryRun = process.env.CHART_SERVICE_POSTGRES_GATE_DRY_RUN === '1';

assertPostgresGateEnv();

for (const [index, step] of steps.entries()) {
  console.log(`[POSTGRES GATE] ${index + 1}/${steps.length} ${step.name}`);
  if (dryRun) continue;

  const invocation = getNpmRunInvocation(step.name);
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      CHART_SERVICE_REPOSITORY: 'postgres',
    },
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[POSTGRES GATE] ${step.name} failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log('Chart service Postgres gate passed.');

function assertPostgresGateEnv() {
  if (process.env.CHART_SERVICE_REPOSITORY !== 'postgres') {
    fail('CHART_SERVICE_REPOSITORY must be postgres.');
  }

  const missing = requiredEnv.filter((key) => !String(process.env[key] ?? '').trim());
  if (missing.length > 0) {
    fail(`Missing required Postgres gate environment variables: ${missing.join(', ')}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getNpmRunInvocation(scriptName) {
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', `npm.cmd run ${scriptName}`],
    };
  }

  return {
    command: 'npm',
    args: ['run', scriptName],
  };
}
