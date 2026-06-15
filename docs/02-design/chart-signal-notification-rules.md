# Chart Signal Notification Rules

This document defines the operating rules for chart signal popups and voice alerts.
Keep it updated whenever signal alert behavior, audio files, or chart strategy recompute timing changes.

## Purpose

Signal notifications should help users notice a newly generated buy/sell signal without replaying old signals after page load, refresh, data reconnect, or strategy recomputation.

Core principle:

- Historical signals are shown in the chart, strategy report, and badge state.
- Popup and voice alerts are reserved for newly detected signals after the chart session is ready.

## Source Of Truth

Implementation files:

- `src/app/init.ts`
  - Detects strategy signal changes.
  - Decides whether to show a popup and play voice.
  - Suppresses initial and reconnect backlogs.
- `src/domain/chart-service/notification-voice.ts`
  - Maps signal messages to stored audio files.
  - Falls back to browser TTS when stored audio cannot be played.
- `app/api/telegram-alerts/signal/route.ts`
  - Receives chart-page realtime BUY/SELL signal events and dispatches matching Telegram alerts.
- `src/server/chart-service/telegram-signal-monitor-runner.ts`
  - Runs the server-side signal monitor loop for browser-free Telegram alert delivery.
- `src/server/chart-service/signal-push-notifications.ts`
  - Creates signal notification records and PWA push attempts for eligible members.

Test files:

- `tests/chart-signal-live-notice.test.mjs`
  - Guards popup/voice timing rules and chart-page Telegram signal posting.
- `tests/chart-service-notification-voice.test.mjs`
  - Guards signal voice text and audio file mapping.

Audio files:

- `public/audio/notifications/signal-buy.mp3`
- `public/audio/notifications/signal-sell.mp3`

## Terms

| Term | Meaning |
| --- | --- |
| Historical signal | A signal that already exists in the loaded candle and strategy result set. |
| Live signal | A signal first detected after the chart is loaded and the current strategy snapshot is ready. |
| Backlog | Multiple existing signals detected at once after page load, refresh, reconnect, or recompute. |
| Ready snapshot | A chart state where candles and strategy signal series both exist and the signal series length covers the candles. |
| Baseline key | The current signal context: symbol, timeframe, and active strategy. |

## Notification Rules

### 1. Initial Load

On first chart load, existing signals must not trigger popup or voice.

Required behavior:

- Wait until the signal snapshot is ready.
- Mark existing signals for the current baseline as already announced.
- Do not play audio.
- Do not show stacked signal popups.

Rationale:

Users opening the chart should not hear signals that happened before they arrived.

### 2. Data Reload Or Reconnect

When live data is reloaded or the feed reconnects, the next ready strategy computation is treated as a baseline refresh.

Required behavior:

- Suppress popup and voice for the next ready compute.
- Rebuild the baseline from existing signals.
- Resume popup and voice only for signals detected after that baseline.

Examples:

- Browser refresh.
- Symbol reload.
- Timeframe reload.
- Gateway or Binance feed reconnect.
- Manual data reload path.

### 3. Strategy Context Change

When symbol, timeframe, or active strategy changes, the baseline changes.

Required behavior:

- Existing signals under the new baseline are marked as announced.
- Popup and voice remain silent during baseline creation.
- New signals after the new baseline may alert normally.

Baseline key format:

```text
symbol:timeframe:strategyName
```

### 4. Hidden Tab

Popup and voice alerts should run only while the browser tab is visible.

Required behavior:

- If `document.visibilityState !== 'visible'`, do not show popup or play voice.
- Badge and strategy report state may still update separately.

Rationale:

Users should not return to a tab and get a burst of old voice alerts.

### 5. Multiple Signals Detected At Once

When several unannounced signals are detected in one pass, only the latest signal may trigger popup and voice.

Required behavior:

- Sort detected signals by candle time.
- Announce only the latest item.
- Do not loop through every detected item with popup and voice.

Rationale:

Multiple signals in one pass usually means backlog or recompute behavior, not a sequence of live events the user needs to hear one by one.

### 6. Signal Voice Text

Voice messages should stay short.

Current signal messages:

| Side | Voice text | Audio file |
| --- | --- | --- |
| Buy | `매수신호발생` | `signal-buy.mp3` |
| Sell | `매도신호발생` | `signal-sell.mp3` |

Avoid long phrases for chart signals. Longer service notifications belong in the general notification center flow.

### 7. Stored Audio First, TTS Fallback

Signal voice uses stored audio first.

Flow:

1. Format signal message in `formatSignalVoiceMessage`.
2. Resolve stored audio path in `getStoredNotificationAudioPath`.
3. Try to play the mp3 file.
4. Fall back to browser speech synthesis if stored audio is missing or playback fails.

Stored audio paths:

```text
/audio/notifications/signal-buy.mp3
/audio/notifications/signal-sell.mp3
```

### 8. External Signal Delivery Source

For the current operating model, external signal delivery should run from the explicit Node server monitor, not Cloudflare cron.

Required behavior:

- The Node monitor is started with `npm run service:telegram-monitor`.
- The monitor reads enabled Telegram profiles and builds unique strategy/symbol/timeframe jobs.
- Each cycle runs just after the one-minute candle boundary by default.
- The monitor calculates closed-candle BUY/SELL signals and filters profiles by event, strategy, symbol, and timeframe before sending.
- The same server signal event creates PWA/app-push notifications for eligible members.
- A visible chart runtime still handles browser popup and voice locally.
- The chart runtime may still post the same live signal to `/api/telegram-alerts/signal`; shared watch state suppresses duplicate Telegram delivery.
- Cloudflare scheduled Telegram monitoring remains paused until its timeframe and timing calculations are verified.

Operational note:

Running a PWA, PC browser, mobile browser, or AWS-hosted browser session is no longer required for Telegram signal monitoring when the Node monitor process is active. PWA/web push and local voice behavior still depend on browser/PWA capabilities. The scheduled Cloudflare monitor code is kept for future reactivation but must not be the production signal source while cron timing is under review.

### 9. PWA App Push Recipients

Server-side signal PWA push currently targets users with active chart access:

- `trial_active` free-trial subscriptions when the trial end time has not passed.
- `active` and `expiring` paid subscriptions when the subscription end time has not passed.

Excluded users:

- Expired free trials.
- Expired, cancelled, refunded, pending, or requested subscriptions.
- Suspended user accounts.
- Users whose subscription start time is in the future.

Future profile-level filtering will add member-specific interested symbols and timeframes from My Profile. Until then, server-side PWA signal push follows the admin-defined server monitor jobs.

## State Rules

### Announced Signal Key

Each signal is tracked with a key built from:

```text
paneId:symbol:candleTime:side
```

This prevents the same signal from being announced repeatedly inside the current browser session.

### Baseline Suppression

The chart keeps a per-pane suppression flag for the next ready computation after reload/reconnect.

Expected lifecycle:

1. Reload starts.
2. Suppress flag is set for the pane.
3. Strategy computation completes with a ready snapshot.
4. Existing signals are marked as announced.
5. Suppress flag is cleared.
6. Future new signals may alert.

## What Should Not Happen

Do not allow these behaviors:

- Playing every signal found in today's historical data.
- Showing multiple stacked signal popups after page load.
- Replaying signals after refresh.
- Replaying signals after feed reconnect.
- Playing voice alerts while the tab is hidden.
- Using long narration for buy/sell chart signals.

## Change Checklist

When changing signal notification behavior, update all relevant items:

- `src/app/init.ts`
  - Detection, baseline, suppress, popup, and visibility rules.
- `src/domain/chart-service/notification-voice.ts`
  - Voice text and audio file mappings.
- `tests/chart-signal-live-notice.test.mjs`
  - Alert timing, backlog suppression, and Telegram post expectations.
- `wrangler.jsonc`
  - Keep Cloudflare Telegram cron paused unless deliberately reactivating the server monitor.
- `scripts/run-telegram-signal-monitor.mjs`
  - Keep the explicit Node monitor entrypoint working for AWS/process-manager deployments.
- `tests/chart-service-telegram-monitor-runner.test.mjs`
  - Guard Node monitor config, timing alignment, and package script wiring.
- `tests/chart-service-signal-push.test.mjs`
  - Guard PWA signal push recipient filtering and server monitor integration.
- `tests/chart-service-notification-voice.test.mjs`
  - Voice text and audio file path expectations.
- `public/audio/notifications/`
  - Replace or add mp3 files when voice content changes.
- This document.

## Verification

Run at minimum:

```powershell
node --test tests\chart-signal-live-notice.test.mjs
node --test tests\chart-service-signal-push.test.mjs
node --test tests\chart-service-telegram-monitor-runner.test.mjs
node --test tests\chart-service-notification-voice.test.mjs
npm.cmd run service:build
git diff --check
```

Manual QA:

- Open the chart after existing signals already exist.
- Confirm no old signal popup or voice plays immediately.
- Trigger or wait for a new signal.
- Confirm only the latest new signal shows one popup and plays one voice.
- Reload the page and confirm the same signal does not replay as a voice alert.

## Future Improvements

Consider these only if the current session-level suppression is not enough:

- Store the latest announced signal key in `localStorage` to prevent replay across browser restarts.
- Add a user setting for signal voice on/off.
- Add a cooldown window if a strategy can emit frequent alternating signals.
- Preload signal audio files after the first user interaction to reduce playback delay.
