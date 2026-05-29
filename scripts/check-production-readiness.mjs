import { getChartServiceRuntimeReadiness } from '../src/server/chart-service/runtime-readiness.ts';

const readiness = getChartServiceRuntimeReadiness(process.env);
const warningCount = readiness.checks.filter((check) => check.status === 'warn').length;

console.log(`[READINESS TARGET] ${getReadinessTargetLabel(readiness)}`);

for (const check of readiness.checks) {
  const marker = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${marker}] ${check.label}: ${check.message}`);
}

if (warningCount > 0 && readiness.mode !== 'production') {
  console.log(
    '[READINESS NOTE] Local warnings are expected during service:launch-check. '
    + 'Use service:postgres:gate for real production DB validation.',
  );
}

if (!readiness.ok) {
  console.error('Production readiness check failed.');
  process.exit(1);
}

console.log('Production readiness check passed.');

function getReadinessTargetLabel(readiness) {
  if (readiness.mode === 'production') {
    return readiness.repository.kind === 'postgres'
      ? 'production postgres'
      : `production ${readiness.repository.kind}`;
  }

  return readiness.repository.kind === 'postgres'
    ? `${readiness.mode} postgres`
    : 'local development';
}
