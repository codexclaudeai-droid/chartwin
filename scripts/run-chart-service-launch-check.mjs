import { spawnSync } from 'node:child_process';

const dryRun = process.env.CHART_SERVICE_LAUNCH_CHECK_DRY_RUN === '1';
const steps = [
  {
    label: 'service:verify',
    run: () => runNpmScript('service:verify'),
  },
  {
    label: 'production docs and env tests',
    run: () => runNodeTest([
      'tests/chart-service-production-env-template.test.mjs',
      'tests/chart-service-deployment-runbook.test.mjs',
      'tests/chart-service-ci-workflow.test.mjs',
      'tests/chart-service-postgres-release-gate.test.mjs',
      'tests/chart-service-launch-check.test.mjs',
      'tests/chart-service-launch-guide.test.mjs',
      'tests/chart-service-readiness-output.test.mjs',
      'tests/chart-service-release-gap-report.test.mjs',
    ]),
  },
  {
    label: 'service:email:deliver',
    run: () => runNpmScript('service:email:deliver', getEmailDeliveryEnv()),
  },
  {
    label: 'service:postgres:gate dry-run',
    run: () => runNpmScript('service:postgres:gate', getPostgresDryRunEnv()),
  },
];

for (const [index, step] of steps.entries()) {
  console.log(`[LAUNCH CHECK] ${index + 1}/${steps.length} ${step.label}`);
  if (dryRun) continue;
  step.run();
}

console.log('TradingCore launch check passed.');

function runNodeTest(testFiles) {
  runCommand(process.execPath, ['--test', ...testFiles], process.env);
}

function runNpmScript(scriptName, env = process.env) {
  const invocation = getNpmRunInvocation(scriptName);
  runCommand(invocation.command, invocation.args, env);
}

function runCommand(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[LAUNCH CHECK] ${command} ${args.join(' ')} failed.`);
    process.exit(result.status ?? 1);
  }
}

function getEmailDeliveryEnv() {
  return {
    ...process.env,
    CHART_SERVICE_EMAIL_PROVIDER: process.env.CHART_SERVICE_EMAIL_PROVIDER || 'log',
    CHART_SERVICE_EMAIL_DELIVERY_LIMIT: process.env.CHART_SERVICE_EMAIL_DELIVERY_LIMIT || '50',
  };
}

function getPostgresDryRunEnv() {
  return {
    ...process.env,
    NODE_ENV: 'production',
    CHART_SERVICE_POSTGRES_GATE_DRY_RUN: '1',
    CHART_SERVICE_REPOSITORY: 'postgres',
    CHART_SERVICE_DATABASE_URL: process.env.CHART_SERVICE_DATABASE_URL || 'postgres://dry-run.invalid/chart_service',
    CHART_SERVICE_DATABASE_SSL_MODE: process.env.CHART_SERVICE_DATABASE_SSL_MODE || 'require',
    CHART_SERVICE_SESSION_SECRET: process.env.CHART_SERVICE_SESSION_SECRET || 'launch-check-session-secret-minimum-32-characters',
    CHART_SERVICE_EMAIL_PROVIDER: process.env.CHART_SERVICE_EMAIL_PROVIDER || 'log',
    CHART_SERVICE_EMAIL_DELIVERY_LIMIT: process.env.CHART_SERVICE_EMAIL_DELIVERY_LIMIT || '50',
    CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL || 'launch-admin@example.com',
    CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD || 'LaunchAdmin1234!',
    CHART_SERVICE_BOOTSTRAP_ADMIN_NAME: process.env.CHART_SERVICE_BOOTSTRAP_ADMIN_NAME || 'Launch Admin',
  };
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
