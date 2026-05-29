import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'service:check' },
  { name: 'service:security' },
  { name: 'service:smoke' },
  { name: 'service:build' },
];
const dryRun = process.env.CHART_SERVICE_RELEASE_GATE_DRY_RUN === '1';

for (const [index, step] of steps.entries()) {
  console.log(`[RELEASE GATE] ${index + 1}/${steps.length} ${step.name}`);
  if (dryRun) continue;

  const invocation = getNpmRunInvocation(step.name);
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[RELEASE GATE] ${step.name} failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log('Chart service release gate passed.');

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
