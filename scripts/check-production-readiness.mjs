import { getChartServiceRuntimeReadiness } from '../src/server/chart-service/runtime-readiness.ts';

const readiness = getChartServiceRuntimeReadiness(process.env);

for (const check of readiness.checks) {
  const marker = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${marker}] ${check.label}: ${check.message}`);
}

if (!readiness.ok) {
  console.error('Production readiness check failed.');
  process.exit(1);
}

console.log('Production readiness check passed.');
