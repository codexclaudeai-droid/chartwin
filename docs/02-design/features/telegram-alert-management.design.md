# Telegram Alert Management Design

## Architecture

The feature adds a server-side Telegram alert module under `src/server/chart-service`. Admin API routes use the existing super-admin request guard and repository persistence pattern. The admin dashboard gets a new `telegramAlerts` section with a client component that manages bot profiles.

## Data Model

`TelegramBotProfileRecord`

- `id`
- `name`
- `botToken`
- `chatId`
- `isEnabled`
- `eventTypes`
- `strategyIds`
- `symbolIds`
- `timeframeIds`
- `lastTestedAt`
- `lastTestStatus`
- `lastTestError`
- `createdAt`
- `updatedAt`

`TelegramDeliveryLogRecord`

- `id`
- `profileId`
- `eventType`
- `strategyId`
- `symbolId`
- `message`
- `status`
- `telegramMessageId`
- `errorMessage`
- `createdAt`

Allowed event types are `buy`, `sell`, `stop_loss`, and `take_profit`.

## API

- `GET /admin/telegram-alerts`: list profiles with masked tokens and recent logs.
- `POST /admin/telegram-alerts`: create or update a bot profile.
- `DELETE /admin/telegram-alerts?id=...`: delete a bot profile.
- `POST /admin/telegram-alerts/test`: send a test message for a stored or submitted profile.
- `POST /api/telegram-alerts/signal`: receive an authenticated chart signal event and dispatch it through enabled Telegram profiles.

Admin management routes require super-admin authorization. The chart signal route requires a valid user session and uses the existing mutation guard/rate limit.

## Telegram Delivery

`sendTelegramAlertForSignal(repository, event, fetcher)`:

1. Reads enabled profiles.
2. Filters by event type, strategy ID, symbol ID, and timeframe ID.
3. Sends `sendMessage` to the Telegram Bot API.
4. Writes one delivery log per matched profile.
5. Returns delivery results for diagnostics.

`sendAsyncTelegramAlertForSignal(repository, event, fetcher)` mirrors the same flow for Next API routes backed by async persistence.

The chart page posts new live strategy BUY/SELL signals to `/api/telegram-alerts/signal` with the active strategy ID, symbol, timeframe, price, optional S/L and T/P levels, and signal time. Telegram message text does not show the strategy name. Stop-loss and take-profit are displayed as `S/L` and `T/P`.

Current production alerting can run from the Node server monitor without keeping a user browser open. The monitor is started with `npm run service:telegram-monitor`, reads enabled Telegram profiles, builds the strategy/symbol/timeframe watch list, and checks closed candles just after each one-minute boundary. Chart pages still post live signals for in-browser popup/voice behavior, but they are no longer the only possible realtime source.

When the Node monitor detects a new closed-candle BUY/SELL signal, it also creates `signal` notification records and attempts PWA app push delivery for members with active chart access. The initial recipient policy includes active free-trial users and active/expiring paid subscribers whose end time has not passed. Expired trials, expired paid subscriptions, pending requests, cancelled/refunded subscriptions, and suspended accounts are excluded. Member-level interested symbols and timeframes are intentionally deferred to the My Profile settings phase.

The Node monitor is configured with these optional environment variables:

- `CHART_SERVICE_SIGNAL_MONITOR_ENABLED=false`: disables the explicit Node monitor process.
- `CHART_SERVICE_SIGNAL_MONITOR_INTERVAL_MS`: defaults to `60000`.
- `CHART_SERVICE_SIGNAL_MONITOR_SETTLE_DELAY_MS`: defaults to `3000`, so checks run just after candle close.
- `CHART_SERVICE_SIGNAL_MONITOR_CANDLE_LIMIT`: defaults to `500`.

The Cloudflare scheduled server monitor remains in the codebase for later reuse, but its cron trigger is paused because Cloudflare cron timing and production timeframe alignment need more validation.

The scheduled worker only runs when `CHART_SERVICE_TELEGRAM_CRON_ENABLED=true` and a cron trigger is restored in `wrangler.jsonc`. With the default `false` setting, scheduled invocations return a disabled no-op result and do not calculate or send Telegram signal alerts.

The default fetcher calls:

`https://api.telegram.org/bot{token}/sendMessage`

## Admin UI

The admin dashboard menu adds `Telegram Alerts`. The panel supports:

- Submenus for `봇프로필관리` and `전송로그`.
- Notice-popup-style list/form switching for bot profile management.
- Add/edit/delete bot profiles.
- Enable/disable profiles.
- Bot token and chat ID entry.
- Event, strategy, and symbol filters.
- Timeframe filters.
- Test message button.
- Recent delivery log table.

After a token is saved, the UI displays only `123456...ABCD` style masked text.

## Test Plan

- Repository persists multiple Telegram profiles and logs.
- Postgres mappers preserve profile/log fields.
- Schema includes Telegram profile and log tables.
- Admin menu exposes the new section.
- Admin panel source does not render raw saved token fields.
- Delivery filters profiles and logs success/failure.
- Chart live signal notice posts BUY/SELL events to the Telegram signal API.
- Signal API authenticates, validates, and dispatches normalized events.
- Server signal monitor creates PWA push notifications for active free-trial and active paid subscribers while blocking expired subscriptions.
- Cloudflare scheduled monitor is paused by default while preserving the worker module for future cron reactivation.
