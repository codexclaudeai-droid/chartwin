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
- Production realtime alerts can run from Cloudflare scheduled monitoring or the explicit Node monitor process with `npm run service:telegram-monitor`.
- Cloudflare scheduled monitoring forwards env.HYPERDRIVE into non-Binance candle reads, so XAUUSD and NQ1! do not fall back to the direct origin database connection.
- Browser and server strategy inputs share 3,000 candles; gateway symbols use the same bounded gap fill and Binance history uses 1,000-candle pagination.
- The monitor rechecks the latest three closed candles for newly exposed stateful-strategy signals, seeds existing signals without replay, and keeps a 180-second hard cap for revised events.
- A freshly published server SSE event can trigger the open chart popup and voice even when the original candle exceeded the normal 90-second window.
- Node monitor signal events create PWA push notification records for active free-trial users and active/expiring paid subscribers, excluding expired subscriptions and suspended accounts.
- Postgres schema includes `telegram_bot_profiles` and `telegram_delivery_logs`.
- Admin API smoke test saved and listed a profile without leaking the raw token.

## Gaps

- Stop-loss and take-profit are supported in profile filters and the signal API contract, but live SL/TP messages need a dedicated trade lifecycle event producer.
- User-level Telegram opt-in/DM routing is not implemented yet.
- User-level PWA interested-symbol and timeframe filtering is not implemented yet; current PWA signal push follows the server monitor jobs.
- Token encryption at rest is not implemented; current protection is server-only storage plus response masking.

## Verification

- `node --test tests\chart-service-telegram-alerts.test.mjs`: pass.
- Focused server candle, revision, SSE, and delivery guard suite: 42 passed.
- `node --test tests\chart-service-signal-push.test.mjs`: pass.
- `node --test tests\chart-service-telegram-monitor-runner.test.mjs`: pass.
- `node --test tests\chart-service-telegram-alerts.test.mjs tests\chart-signal-live-notice.test.mjs`: pass.
- `node --test tests\chart-service-database-schema.test.mjs tests\chart-service-postgres-repository.test.mjs tests\chart-service-postgres-mappers.test.mjs tests\chart-service-async-repository.test.mjs`: pass.
- `npm.cmd run build`: pass.
- `npm.cmd run service:build`: pass.
- Live XAUUSD replay: first calculation sent 0; the revised 05:54 candle sent exactly one `BUY XAUUSD` message with the original KST signal time.
- `node --test tests\*.test.mjs`: 15 failures remain in unrelated in-progress admin, payment, encoding, gateway dual-write, and chart strategy tests.
- `npm.cmd run service:cloudflare:build`: Windows OpenNext CLI exits after its unsupported-Windows warning; the regular Next production build passes.
