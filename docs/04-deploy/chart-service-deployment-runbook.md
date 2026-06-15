# TradingCore Chart Service Deployment Runbook

Created: 2026-05-26

This runbook is the release checklist for moving the TradingCore chart subscription service from local memory mode to production Postgres mode.

## 1. Release Modes

Use these commands depending on the target.

| Target | Command | Purpose |
| --- | --- | --- |
| Launch guide | `npm.cmd run service:launch-guide` | Prints the safe operator sequence for secrets, launch check, Postgres gate, deployment, and post-deploy smoke. |
| Launch readiness | `npm.cmd run service:launch-check` | Runs the full local release gate, production docs/env tests, email delivery harness, and Postgres dry-run gate as one command. |
| Local verification | `npm.cmd run service:verify` | Runs readiness, security, smoke, and Next build in memory-backed mode. |
| Postgres dry run | `CHART_SERVICE_POSTGRES_GATE_DRY_RUN=1 npm.cmd run service:postgres:gate` | Verifies Postgres gate order and required env without touching a database. |
| Production Postgres | `npm.cmd run service:postgres:gate` | Runs production env doctor, readiness, migration/bootstrap, initial admin login check, security checks, and Next build with Postgres env. |
| Post-deploy smoke | `npm.cmd run service:postdeploy:smoke` | Checks the deployed health endpoint, admin login, and authenticated admin dashboard API. |

## 2. Required Environment Variables

Use `.env.production.example` as the canonical template. Copy the keys into the hosting secret manager or deployment environment, then fill the blank values outside git.

```powershell
$env:NODE_ENV='production'
$env:CHART_SERVICE_REPOSITORY='postgres'
$env:CHART_SERVICE_DATABASE_URL='<production-postgres-url>'
$env:CHART_SERVICE_DATABASE_SSL_MODE='require'
$env:CLOUDFLARE_HYPERDRIVE_NAME='tradingcore-hyperdrive'
$env:CLOUDFLARE_HYPERDRIVE_ID='<optional-precreated-hyperdrive-id>'
$env:CLOUDFLARE_HYPERDRIVE_BINDING='HYPERDRIVE'
$env:CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE='<production-postgres-url>'
$env:CHART_SERVICE_SESSION_SECRET='<32-plus-random-characters>'
$env:CHART_SERVICE_EMAIL_PROVIDER='cloudflare'
$env:CHART_SERVICE_EMAIL_DELIVERY_LIMIT='50'
$env:CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID='<cloudflare-account-id>'
$env:CHART_SERVICE_CLOUDFLARE_API_TOKEN='<cloudflare-email-sending-api-token>'
$env:WEB_PUSH_PUBLIC_KEY='<vapid-public-key>'
$env:WEB_PUSH_PRIVATE_KEY='<vapid-private-key>'
$env:WEB_PUSH_SUBJECT='mailto:support@tradingcore.co'
$env:CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL='<first-admin-email>'
$env:CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD='<first-admin-password>'
$env:CHART_SERVICE_BOOTSTRAP_ADMIN_NAME='<first-admin-name>'
```

Required values:

- `CHART_SERVICE_REPOSITORY=postgres`
- `CHART_SERVICE_DATABASE_URL`
- `CHART_SERVICE_DATABASE_SSL_MODE`
- `CLOUDFLARE_HYPERDRIVE_NAME=tradingcore-hyperdrive`
- `CLOUDFLARE_HYPERDRIVE_BINDING=HYPERDRIVE`
- `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`
- `CHART_SERVICE_SESSION_SECRET`
- `CHART_SERVICE_EMAIL_PROVIDER`
- `CHART_SERVICE_EMAIL_DELIVERY_LIMIT`
- `CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID`
- `CHART_SERVICE_CLOUDFLARE_API_TOKEN`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`
- `CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL`
- `CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD`
- `CHART_SERVICE_BOOTSTRAP_ADMIN_NAME`

Use `require`, `verify-ca`, or `verify-full` for production SSL mode. Do not paste real database URLs, session secrets, or bootstrap admin passwords into committed docs.

Cloudflare Hyperdrive can be resolved in two ways:

- Preferred automated path: keep `CLOUDFLARE_HYPERDRIVE_ID` blank and use a `CLOUDFLARE_API_TOKEN` with `Account > Hyperdrive > Edit`, so the deployment workflow can find or create `tradingcore-hyperdrive`.
- Manual fallback path: create Hyperdrive in the Cloudflare dashboard, then save its config ID as GitHub secret `CLOUDFLARE_HYPERDRIVE_ID`. In this mode the setup script binds that ID without calling the Hyperdrive create/list API.

OpenNext/Wrangler also requires `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` while resolving the Hyperdrive binding during CI deploy. Reuse the same value as `CHART_SERVICE_DATABASE_URL` through the secret manager; do not commit the real URL.

Generate Web Push VAPID keys with `node scripts/generate-vapid-keys.mjs`. For local development, use `node scripts/generate-vapid-keys.mjs --write-env-local` so `.env.local` is updated without committing secrets. For production, copy the printed `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT` values into the hosting secret manager or Cloudflare Worker secrets.

## 3. Pre-Deployment

Print the operator sequence if you need the launch order in one place.

```powershell
npm.cmd run service:launch-guide
```

Run the combined launch check first. This is the preferred single command before deployment.

```powershell
npm.cmd run service:launch-check
```

Expected result:

- Local release gate passes.
- Production environment template and deployment runbook tests pass.
- Email delivery harness is callable with the log provider.
- Postgres gate dry-run confirms the release sequence without touching a real database.

If you need a smaller local-only check, run:

```powershell
npm.cmd run service:verify
```

Expected result:

- Runtime readiness passes.
- Security tests pass.
- Core subscription smoke flow passes.
- Next production build passes.

## 4. Postgres Dry Run

Dry run confirms the gate order before touching the real database.

```powershell
$env:CHART_SERVICE_POSTGRES_GATE_DRY_RUN='1'
$env:CHART_SERVICE_REPOSITORY='postgres'
$env:CHART_SERVICE_DATABASE_URL='<dry-run-postgres-url>'
$env:CHART_SERVICE_SESSION_SECRET='<32-plus-random-characters>'
npm.cmd run service:postgres:gate
```

Expected order:

1. `service:check`
2. `service:bootstrap`
3. `service:security`
4. `service:build`

Remove `CHART_SERVICE_POSTGRES_GATE_DRY_RUN` before the real DB run.

## 5. Production Postgres Gate

Run this only after the real production DB values are set.

```powershell
Remove-Item Env:CHART_SERVICE_POSTGRES_GATE_DRY_RUN -ErrorAction SilentlyContinue
npm.cmd run service:postgres:gate
```

What this does:

- Runs `service:prod-env:check` to fail fast on missing values, placeholders, unsafe SSL mode, weak session secrets, weak admin passwords, or leaked sample credentials.
- Confirms production readiness.
- Applies the Postgres schema migration through `service:bootstrap`.
- Seeds default subscription plans.
- Creates the first super admin if it does not already exist.
- Runs `service:postgres:admin-check` to verify the bootstrap super admin can log in through the real Postgres repository.
- Runs security tests.
- Runs the Next service build.

Expected order:

1. `service:prod-env:check`
2. `service:check`
3. `service:bootstrap`
4. `service:postgres:admin-check`
5. `service:security`
6. `service:build`

## 6. Health Check

After deployment, verify the app health endpoint.

```powershell
Invoke-WebRequest https://YOUR_DOMAIN/api/health
```

The `/api/health` response must not expose database credentials. It should return readiness checks and an overall `ok` value.

For a stronger deployed-service smoke, set the deployed base URL and run:

```powershell
$env:CHART_SERVICE_BASE_URL='https://YOUR_DOMAIN'
$env:CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL='<first-admin-email>'
$env:CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD='<first-admin-password>'
npm.cmd run service:postdeploy:smoke
```

This command verifies:

- `/api/health` returns `ok=true` and does not expose database connection strings.
- `/api/auth/login` accepts the admin credentials and returns a session cookie.
- `/api/admin/dashboard` accepts the session cookie and returns an authenticated admin response.

## 7. Manual Smoke Checklist

## 7.1 Telegram Signal Monitor

Run the Telegram signal monitor as a separate always-on Node process on AWS or another server host. This process does not require a visible browser.

```powershell
$env:NODE_ENV='production'
$env:CHART_SERVICE_REPOSITORY='postgres'
$env:CHART_SERVICE_DATABASE_URL='<production-postgres-url>'
$env:CHART_SERVICE_DATABASE_SSL_MODE='require'
$env:CHART_SERVICE_SIGNAL_MONITOR_ENABLED='true'
$env:CHART_SERVICE_SIGNAL_MONITOR_INTERVAL_MS='60000'
$env:CHART_SERVICE_SIGNAL_MONITOR_SETTLE_DELAY_MS='3000'
npm.cmd run service:telegram-monitor
```

Operational notes:

- Keep `CHART_SERVICE_TELEGRAM_CRON_ENABLED=false` while Cloudflare cron monitoring is paused.
- The monitor reads Telegram alert profiles from the database and watches each enabled strategy/symbol/timeframe combination.
- The default check runs just after each one-minute candle boundary and also catches configured higher timeframes such as `5m`.
- New BUY/SELL signals also create PWA signal notifications for active free-trial users and active paid subscribers whose subscription has not expired.
- Actual PWA push delivery requires `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT` to be configured in the same runtime environment as this monitor.
- Run it under a process manager such as systemd, PM2, Docker restart policy, or the hosting provider's background worker feature.

## 7.2 Manual Smoke Checklist

After deployment, verify these flows in the browser:

- Sign up with phone number, password confirmation, and required agreements.
- Log in as the new member.
- Select a subscription plan on `/pricing`.
- Submit a bank transfer request with depositor name.
- Log in as admin and confirm deposit.
- Approve the subscription.
- Confirm the member profile shows active subscription and chart access.
- Create a support thread and reply from admin.
- Confirm the member sees the reply through notifications or support.

## 8. Rollback

Rollback is deployment rollback first, database rollback second.

Application rollback:

1. Stop the new deployment or promote the previous deployment from the hosting provider.
2. Keep the database online.
3. Run `/api/health` against the restored app.
4. Re-run `npm.cmd run service:verify` locally against the rollback branch if needed.

Database rollback:

- Do not automatically reverse migrations.
- Prefer a forward hotfix migration.
- Take a database backup before any manual data repair.
- Preserve audit logs for payment, subscription, and admin setting changes.

## 9. Release Sign-Off

Only release when all are true:

- `npm.cmd run service:launch-check` passes locally.
- `service:prod-env:check` passes with real production secrets set outside git.
- `npm.cmd run service:verify` passes locally.
- `npm.cmd run service:postgres:gate` passes against the target DB.
- `service:postgres:admin-check` confirms the first super admin can log in.
- `npm.cmd run service:postdeploy:smoke` passes against the deployed app.
- `/api/health` returns a safe healthy response.
- The first super admin can log in.
- Admin deposit confirmation and subscription approval work.
- Payment transfer settings changes create audit logs.
- Rollback path is known before launch.
