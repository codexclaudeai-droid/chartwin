const redactedDatabaseUrl = redactDatabaseUrl(process.env.CHART_SERVICE_DATABASE_URL?.trim() ?? '');

console.log('TradingCore Release Gap Report');
console.log('');
console.log('READY GATES');
printItems([
  'service:launch-check covers local readiness, security, smoke, build, docs/env tests, email harness, and Postgres dry-run.',
  'service:postgres:gate covers production env doctor, readiness, migration/bootstrap, admin login check, security, and build.',
  'service:postdeploy:smoke covers deployed health, admin login, and authenticated admin dashboard access.',
  'Audit evidence exists for payment transfer setting changes and key admin mutations.',
  'Landing page final public copy and design polish are covered before launch.',
]);
console.log('');
console.log('REAL ENVIRONMENT REQUIRED');
printItems([
  `Real Postgres database connection must be supplied outside git: ${redactedDatabaseUrl || '<not-configured>'}.`,
  'Run service:postgres:gate against the real DB before switching traffic.',
  'Run service:postdeploy:smoke against the deployed CHART_SERVICE_BASE_URL after deployment.',
  'Manual bank transfer verification policy must remain operator-controlled in admin payments.',
  'Confirm production email policy: current harness is log provider until external delivery provider is wired.',
  'Complete browser QA for signup, pricing checkout, profile subscription status, notifications, support, and admin workflows.',
]);
console.log('');
console.log('POST-LAUNCH BACKLOG');
printItems([
  'KIS/MetaTrader data integration remains a separate market-data sprint.',
  'External email provider integration should replace the log provider before high-volume operations.',
  'Admin UI design-system polish can continue after launch gates are stable.',
  'Visitor analytics collection needs a real production event source before visitor statistics are final.',
  'Automated bank deposit confirmation is intentionally out of scope while admin manual approval is required.',
]);
console.log('');
console.log('RECOMMENDED NEXT COMMANDS');
printItems([
  'npm.cmd run service:launch-guide',
  'npm.cmd run service:launch-check',
  'npm.cmd run service:postgres:gate',
  'npm.cmd run service:postdeploy:smoke',
]);

function printItems(items) {
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function redactDatabaseUrl(value) {
  if (!value || /^<[^>]+>$/.test(value)) return '';

  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString();
  } catch {
    return '<invalid-database-url>';
  }
}
