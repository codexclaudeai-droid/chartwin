# Telegram Alert Management Plan

## Overview

Add Telegram alert management for strategy signals. Super admins can register multiple Telegram bot profiles, test each connection, and decide which signal events, strategies, symbols, and timeframes each profile receives.

## Goals

- Add a new admin dashboard menu for Telegram alert management.
- Allow multiple bot profiles for test and production channels.
- Store bot token securely on the server and only expose masked token text to the UI.
- Support buy, sell, stop-loss, and take-profit event filters.
- Support strategy, symbol, and timeframe allowlists per bot profile.
- Send test messages through the Telegram Bot API.
- Record delivery attempts for troubleshooting.

## Scope

In scope:

- Repository records for Telegram bot profiles and delivery logs.
- Mock and Postgres persistence support.
- Admin API routes for list/create/update/delete/test.
- Admin dashboard panel and navigation entry.
- Delivery helper that filters active profiles and sends Telegram messages.
- Focused tests for storage, masking, menu wiring, and delivery behavior.

Out of scope:

- User-specific Telegram DM opt-in flow.
- Automatic strategy signal event ingestion from live chart workers.
- Token encryption at rest beyond not returning the raw token to browsers.

## Success Criteria

- Super admin can manage multiple Telegram bot profiles from the admin page.
- A test bot can be connected with bot token and chat ID and receive a test message.
- The UI never renders the raw stored token after save.
- Only active profiles matching the event, strategy, symbol, and timeframe filters are selected for delivery.
- Delivery logs retain success/failure status and error messages.
- `node --test` targeted tests and `npm.cmd run build` pass.

## Risks

- Telegram bot tokens are secrets. The server must avoid echoing stored tokens.
- Public channels require the bot to be an admin. Test failures must show clear messages.
- Signal systems can produce duplicate events. This feature logs deliveries, but live event deduplication is reserved for the later ingestion step.
