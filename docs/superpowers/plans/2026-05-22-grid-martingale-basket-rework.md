# Grid Martingale Basket Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild grid martingale as independent long/short basket strategy with basket TP and equity stop.

**Architecture:** Keep strategy execution inside the existing worker string strategy model, but replace the current long-only leg accumulator with two independent basket state machines. Update the strategy report and modal settings to match the new basket semantics.

**Tech Stack:** TypeScript, existing strategy worker string execution, Node test runner

---

### Task 1: Rework strategy runtime
- Files: `src/strategy/strategies/grid-martingale-js.ts`, `src/strategy/strategies/grid-martingale-presets.js`, `tests/grid-martingale-config.test.mjs`
- Add failing tests for standalone worker execution and bidirectional basket behavior.
- Implement long/short independent basket state with basket TP and equity stop.

### Task 2: Update report semantics
- Files: `src/chart/SimpleChart.ts`, `tests/grid-martingale-config.test.mjs`
- Add failing checks for long/short basket close interpretation.
- Update report builder to reconstruct baskets from signals.

### Task 3: Update user-facing settings
- Files: `src/ui/modal-handlers.ts`, `src/strategy/strategies/grid-martingale-js.ts`
- Align labels and defaults with basket terminology.
- Keep per-symbol recommended values while allowing manual overrides.

### Task 4: Verification
- Files: `tests/grid-martingale-config.test.mjs`, `tests/grid-srouter-levels.test.mjs`, `tests/gateway-provider-routing.test.mjs`
- Run targeted tests and production build.
