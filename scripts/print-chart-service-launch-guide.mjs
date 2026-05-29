const env = process.env;
const baseUrl = env.CHART_SERVICE_BASE_URL?.trim() || '<deployed-service-url>';
const databaseUrl = redactDatabaseUrl(env.CHART_SERVICE_DATABASE_URL?.trim() || '<production-postgres-url>');
const adminEmail = env.CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || '<first-admin-email>';

console.log('TradingCore Launch Guide');
console.log('');
console.log('1. Prepare production secrets');
console.log('   - Copy .env.production.example into your hosting secret manager.');
console.log(`   - CHART_SERVICE_DATABASE_URL=${databaseUrl}`);
console.log('   - CHART_SERVICE_SESSION_SECRET=<32-plus-random-characters>');
console.log(`   - CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL=${adminEmail}`);
console.log('   - CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD=<first-admin-password>');
console.log(`   - CHART_SERVICE_BASE_URL=${baseUrl}`);
console.log('');
console.log('2. Run local launch readiness');
console.log('   npm.cmd run service:launch-check');
console.log('');
console.log('3. Run production Postgres gate');
console.log('   Remove-Item Env:CHART_SERVICE_POSTGRES_GATE_DRY_RUN -ErrorAction SilentlyContinue');
console.log('   npm.cmd run service:prod-env:check');
console.log('   npm.cmd run service:postgres:gate');
console.log('');
console.log('4. Deploy the app');
console.log('   - Deploy the verified branch/build to the hosting provider.');
console.log('   - Keep rollback target and database backup ready before switching traffic.');
console.log('');
console.log('5. Run post-deploy smoke');
console.log(`   $env:CHART_SERVICE_BASE_URL='${baseUrl}'`);
console.log(`   $env:CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL='${adminEmail}'`);
console.log("   $env:CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD='<first-admin-password>'");
console.log('   npm.cmd run service:postdeploy:smoke');
console.log('');
console.log('Release sign-off');
console.log('   - launch-check passed');
console.log('   - postgres gate passed against the real DB');
console.log('   - postdeploy smoke passed against the deployed URL');

function redactDatabaseUrl(value) {
  if (!value || /^<[^>]+>$/.test(value)) return value;

  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString();
  } catch {
    return '<invalid-production-postgres-url>';
  }
}
