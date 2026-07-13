# Telegram Alert Management Report

## Summary

Telegram bot profile management is implemented for super admins. The admin dashboard now has a Telegram Alerts menu where multiple bot profiles can be created, edited, deleted, enabled, and tested. Each profile supports event, strategy, symbol, and timeframe filters.

Live chart strategy BUY/SELL signals now post to an authenticated Telegram signal API, which dispatches messages to all enabled matching bot profiles.

Cloudflare scheduled monitoring provides the browser-free fallback, while `npm run service:telegram-monitor` remains available for AWS or another always-on host. Both calculate closed-candle signals from the admin Telegram profile filters and send matching Telegram alerts without keeping a user browser open. The same server signal events create PWA app-push notifications for active free-trial users and active/expiring paid subscribers whose access has not expired.

## Completed Items

- Added Telegram profile and delivery log repository records.
- Added memory and Postgres persistence.
- Added Postgres schema tables and mappers.
- Added Telegram Bot API sender with profile filtering and delivery logs.
- Added admin API routes for list/save/delete/test.
- Added admin dashboard Telegram Alerts panel.
- Split the Telegram admin panel into bot profile management and delivery log submenus.
- Changed bot profile management to a notice-popup-style board list with separate add/edit form.
- Added token masking so raw tokens are not returned to the browser.
- Added authenticated chart signal API for Telegram delivery.
- Connected live chart strategy BUY/SELL notices to the Telegram signal API.
- Added a Node Telegram signal monitor runner and `service:telegram-monitor` command for browser-free server monitoring.
- Added server-side PWA signal push notifications for active free-trial and active paid subscribers, with expired subscriptions blocked.
- Enabled Cloudflare scheduled monitoring as the browser-free catch-up path.
- Unified browser and server strategy history at 3,000 candles with gateway gap filling and Binance pagination.
- Added recent three-candle revision detection with baseline seeding and bounded late-signal delivery.
- Connected freshly published revised events to chart SSE popup and voice notifications.
- Removed strategy names from Telegram message text and added `S/L`/`T/P` level support.
- Added focused tests for storage, masking, menu wiring, schema, and delivery.

## Remaining Work

- Add a trade lifecycle event producer before live stop-loss and take-profit Telegram messages can be emitted.
- Add user-level Telegram preferences after the admin policy is stable.
- Add My Profile interested-symbol and timeframe settings for member-specific PWA signal filtering.
- Decide whether to encrypt bot tokens at rest before production launch.

## Quality Notes

The feature is ready for test-bot setup. A real Telegram test requires creating a bot, adding it to the target channel/group as an admin when needed, entering the bot token and chat ID, then using the Test button from the admin menu.
