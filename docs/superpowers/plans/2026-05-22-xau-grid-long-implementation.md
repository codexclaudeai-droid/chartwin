# XAU Grid Long Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new chart-only XAU grid long strategy module that mirrors the Pine close-to-close grid behavior and keeps future bot-ready metadata in a reusable runtime.

**Architecture:** Implement a reusable runtime that simulates per-bar grid slot ownership, then wrap it in a standard `sourceCode` strategy definition that returns `-1`, `0`, or `1` to the existing chart strategy engine. Register the new strategy in the shared index and cover the runtime with focused Node tests for level generation, buy/sell transitions, multi-level crossings, and wrapper integration.

**Tech Stack:** TypeScript, existing inline strategy source pattern, Node test runner, vm-based sourceCode execution tests

---

### Task 1: Add failing tests for the XAU grid runtime and wrapper

**Files:**
- Create: `tests/xau-grid-long-runtime.test.mjs`

- [ ] **Step 1: Write the failing test**

Add tests that assert:
- arithmetic and geometric levels are generated correctly
- a downward cross into an empty slot emits a buy signal
- an upward cross above an owned slot emits a sell signal
- one large bar can record multiple crossed levels while collapsing chart output to one signal
- the strategy wrapper executes standalone and returns non-zero signals on matching input

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/xau-grid-long-runtime.test.mjs`
Expected: FAIL because `xau-grid-long-runtime.ts` and `xau-grid-long-js.ts` do not exist yet

### Task 2: Implement the reusable XAU grid runtime

**Files:**
- Create: `src/strategy/strategies/xau-grid-long-runtime.ts`

- [ ] **Step 1: Write minimal implementation**

Implement:
- `resolveXauGridLongConfig`
- `buildXauGridLevels`
- `simulateXauGridLong`

Runtime result should include:
- `signals`
- `levels`
- `bars`
- `config`

Each bar metadata object should keep:
- `buyLevels`
- `sellLevels`
- `ownedCount`
- `avgEntry`
- `deployedCapital`
- `openQty`
- `openPnl`
- `eventType`
- `botPayloadHint`

- [ ] **Step 2: Run test to verify partial progress**

Run: `node --test tests/xau-grid-long-runtime.test.mjs`
Expected: some tests still fail until wrapper and index registration are complete

### Task 3: Add the strategy wrapper and register it

**Files:**
- Create: `src/strategy/strategies/xau-grid-long-js.ts`
- Modify: `src/strategy/strategies/index.ts`

- [ ] **Step 1: Write minimal implementation**

Create a strategy definition that:
- exposes defaults for `highPrice`, `lowPrice`, `nLevels`, `gridMode`, `investment`
- embeds `resolveXauGridLongConfig` and `simulateXauGridLong`
- caches series results in `context.__xauGridLongCache`
- returns `result.signals[index] || 0`

Register the strategy in exports and `ALL_STRATEGIES`.

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/xau-grid-long-runtime.test.mjs`
Expected: PASS

### Task 4: Run focused verification

**Files:**
- Verify: `tests/xau-grid-long-runtime.test.mjs`
- Verify existing related strategy file references

- [ ] **Step 1: Run verification**

Run: `node --test tests/xau-grid-long-runtime.test.mjs`
Expected: PASS with all assertions green

- [ ] **Step 2: Run one related existing test**

Run: `node --test tests/grid-martingale-config.test.mjs`
Expected: PASS to confirm no regression in neighboring strategy patterns
