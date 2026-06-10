# BB MTF Kalman Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bollinger Bands MTF & Kalman Signal indicator that accurately supports a configurable higher timeframe, defaulting to 4h for a 1h chart workflow.

**Architecture:** Keep calculation in a focused indicator module, render visual bands/signals in a dedicated main-chart renderer, and wire settings through existing indicator catalog and popup patterns. HTF values are aggregated from chart candles, mapped back to chart bars without future leakage, then EMA-smoothed on the chart bar series to match the Pine execution order.

**Tech Stack:** TypeScript, canvas renderers, Node test runner, existing chart indicator settings UI.

---

### Task 1: Calculation Module

**Files:**
- Create: `src/chart/indicators/bb-mtf-kalman-signal.ts`
- Modify: `src/chart/indicators/index.ts`
- Test: `tests/indicator-calculations.test.mjs`

- [ ] Write failing tests for HTF aggregation/mapping, invalid timeframe warning, and reversal signal state.
- [ ] Implement timeframe parsing, HTF candle aggregation, Bollinger bands, Kalman LTF basis, HTF EMA smoothing, fills, and signals.
- [ ] Run indicator calculation tests.

### Task 2: Main Renderer

**Files:**
- Create: `src/chart/renderers/bb-mtf-kalman-signal-renderer.ts`
- Modify: `src/chart/renderers/main-indicator-orchestrator.ts`
- Modify: `src/chart/SimpleChart.ts`

- [ ] Render LTF/HTF band lines, gap fills, and buy/sell triangles.
- [ ] Include BB values in main price range calculation.
- [ ] Keep rendering gated by style visibility and indicator toggles.

### Task 3: UI Wiring

**Files:**
- Modify: `src/catalog/indicators.ts`
- Modify: `src/indicator-panel-module.ts`
- Modify: `src/ui/indicator-overlay.ts`
- Modify: `src/ui/modal-handlers.ts`
- Modify: `src/ui/workspace/pane-utils.ts`

- [ ] Add catalog entry, default styles, overlay label, pane summary name, and settings controls.
- [ ] Expose HTF timeframe, LTF/HTF length and multiplier, signals, fills, labels, and color option.

### Task 4: Verification

**Files:**
- Test: `tests/indicator-calculations.test.mjs`
- Test: relevant renderer/visibility tests

- [ ] Run `node --test tests\indicator-calculations.test.mjs`.
- [ ] Run related indicator renderer/visibility tests.
- [ ] Run `npm.cmd run build`.
