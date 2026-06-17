# Notification SSE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make member/admin notification counts update immediately while keeping 10-second polling as a fallback.

**Architecture:** Add an in-memory server-side notification realtime hub that exposes user-scoped SSE streams. Publish a `notifications.changed` event whenever `saveNotification` runs through the async repository, then let the header badge dispatch the existing browser refresh event when the stream receives a change.

**Tech Stack:** Next.js App Router route handlers, Web Streams API, browser `EventSource`, existing notification summary API.

---

### Task 1: Realtime Hub

**Files:**
- Create: `src/server/chart-service/notification-realtime.ts`
- Test: `tests/chart-service-notification-realtime.test.mjs`

- [ ] Write tests proving a user stream receives only its own `notifications.changed` event and cleans up after cancel.
- [ ] Implement the in-memory subscriber map with SSE encoding, heartbeat support, and a publish function returning delivered subscriber count.
- [ ] Run `node --test tests\chart-service-notification-realtime.test.mjs`.

### Task 2: Stream Route

**Files:**
- Create: `app/api/notifications/stream/route.ts`
- Modify: `tests/chart-service-notification-display.test.mjs`

- [ ] Add source-level assertions that the stream route authenticates with `getActorFromAsyncRequest` and returns `text/event-stream`.
- [ ] Implement the route with `createNotificationRealtimeStream(actor.id, { signal: request.signal })`.
- [ ] Run `node --test tests\chart-service-notification-display.test.mjs`.

### Task 3: Event Publishing

**Files:**
- Modify: `src/server/chart-service/async-repository.ts`
- Test: `tests/chart-service-notification-realtime.test.mjs`

- [ ] Add a test proving `createAsyncChartServiceRepository(...).saveNotification()` publishes one realtime event.
- [ ] Wrap async `saveNotification` so notification changes fan out without touching every notification call site.
- [ ] Run `node --test tests\chart-service-notification-realtime.test.mjs`.

### Task 4: Frontend Subscription

**Files:**
- Modify: `app/notification-events.ts`
- Modify: `app/notification-nav-link.tsx`
- Test: `tests/chart-service-notification-events.test.mjs`
- Test: `tests/chart-service-notification-display.test.mjs`

- [ ] Add tests for `subscribeNotificationRealtimeStream()` connecting to `/api/notifications/stream`, invoking callbacks, and closing on cleanup.
- [ ] Start the SSE stream only after the auth session is confirmed, dispatch existing refresh events on each realtime event, and leave 10-second polling active as fallback.
- [ ] Run focused notification tests.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run `node --test tests\chart-service-notification-realtime.test.mjs tests\chart-service-notification-events.test.mjs tests\chart-service-notification-display.test.mjs tests\chart-service-notification-summary-client.test.mjs`.
- [ ] Run `npm.cmd run service:build`.
- [ ] Confirm unrelated generated data such as `server/data/candles-db.json` is not staged.
