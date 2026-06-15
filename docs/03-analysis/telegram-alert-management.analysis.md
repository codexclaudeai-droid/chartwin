# Telegram Alert Management Analysis

## Match Rate

100% for the implemented scope.

## Checks

- Admin dashboard includes a dedicated `telegramAlerts` section.
- Admin page renders `AdminTelegramAlertsPanel`.
- Multiple Telegram bot profiles can be stored in memory and Postgres-backed repositories.
- Public profile serialization masks bot tokens and does not expose raw tokens.
- Telegram signal delivery filters by event type, strategy ID, symbol ID, and timeframe ID.
- Delivery attempts are logged as sent or failed.
- Telegram message text omits strategy names and uses `S/L` and `T/P` labels for stop-loss/take-profit.
- Authenticated chart signal API dispatches normalized signal events through the Telegram delivery helper.
- Live chart strategy BUY/SELL notices post to the Telegram signal API with active strategy and symbol context.
- Production realtime alerts can run from the explicit Node monitor process with `npm run service:telegram-monitor`; Cloudflare scheduled Telegram monitoring is paused by default and returns a no-op unless `CHART_SERVICE_TELEGRAM_CRON_ENABLED=true`.
- Node monitor signal events create PWA push notification records for active free-trial users and active/expiring paid subscribers, excluding expired subscriptions and suspended accounts.
- Postgres schema includes `telegram_bot_profiles` and `telegram_delivery_logs`.
- Admin API smoke test saved and listed a profile without leaking the raw token.

## Gaps

- Stop-loss and take-profit are supported in profile filters and the signal API contract, but live SL/TP messages need a dedicated trade lifecycle event producer.
- User-level Telegram opt-in/DM routing is not implemented yet.
- User-level PWA interested-symbol and timeframe filtering is not implemented yet; current PWA signal push follows the server monitor jobs.
- Token encryption at rest is not implemented; current protection is server-only storage plus response masking.
- Cloudflare cron reactivation is deferred until its timing can match the explicit Node monitor's admin-selected symbol/timeframe behavior.

## Verification

- `node --test tests\chart-service-telegram-alerts.test.mjs`: pass.
- `node --test tests\chart-service-signal-push.test.mjs`: pass.
- `node --test tests\chart-service-telegram-monitor-runner.test.mjs`: pass.
- `node --test tests\chart-service-telegram-alerts.test.mjs tests\chart-signal-live-notice.test.mjs`: pass.
- `node --test tests\chart-service-database-schema.test.mjs tests\chart-service-postgres-repository.test.mjs tests\chart-service-postgres-mappers.test.mjs tests\chart-service-async-repository.test.mjs`: pass.
- `npm.cmd run build`: pass.
- `npm.cmd run service:build`: pass.
- `node --test tests\*.test.mjs`: fails on pre-existing/current-date-sensitive tests outside this feature, including expired fixture sessions dated 2026-05-31.
