# Pattern Alert Popup Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pattern alert popup actions that move to the detected pattern range, visually highlight it, and let the user confirm or enable pattern visibility from the popup.

**Architecture:** Extend `PatternSignal` so detections carry explicit range metadata, then wire popup action callbacks from `SimpleChart` into the popup renderer. Reuse existing `focusRangeByIndex(...)` and pattern visibility state so the new behavior stays aligned with the current chart UX.

**Tech Stack:** TypeScript, Vite, Node.js built-in test runner, existing chart UI modules

---

### Task 1: Add a failing regression test for signal range resolution

**Files:**
- Create: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\tests\pattern-detector.test.ts`
- Modify: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\src\patterns\pattern-detector.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPatternSignalRange } from '../src/patterns/pattern-detector.ts';

test('getPatternSignalRange prefers explicit range metadata', () => {
  const range = getPatternSignalRange({
    key: 'double-bottom-12-18',
    barIndex: 20,
    startIndex: 10,
    endIndex: 16,
  });

  assert.deepEqual(range, { startIndex: 10, endIndex: 16 });
});

test('getPatternSignalRange falls back to parsing the key when range metadata is missing', () => {
  const range = getPatternSignalRange({
    key: 'hs-24-30-36',
    barIndex: 40,
  });

  assert.deepEqual(range, { startIndex: 24, endIndex: 36 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/pattern-detector.test.ts`
Expected: FAIL because `getPatternSignalRange` does not exist yet.

- [ ] **Step 3: Implement signal range resolution**

```ts
export function getPatternSignalRange(...) {
  // prefer explicit startIndex/endIndex
  // otherwise parse numeric segments from the signal key
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/pattern-detector.test.ts`
Expected: PASS

### Task 2: Attach explicit pattern ranges to detections

**Files:**
- Modify: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\src\patterns\pattern-detector.ts`

- [ ] **Step 1: Update `PatternSignal`**

```ts
export interface PatternSignal {
  ...
  startIndex?: number;
  endIndex?: number;
}
```

- [ ] **Step 2: Fill range metadata when building each signal**

```ts
return {
  ...,
  barIndex: lastBar,
  startIndex: b1,
  endIndex: b2,
};
```

- [ ] **Step 3: Use real candle spans for candlestick patterns**

```ts
startIndex: lastBar - 1,
endIndex: lastBar,
```

- [ ] **Step 4: Re-run the regression test**

Run: `node --test --experimental-strip-types tests/pattern-detector.test.ts`
Expected: PASS

### Task 3: Add popup actions for move/focus and visibility confirmation

**Files:**
- Modify: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\src\patterns\pattern-popup.ts`
- Modify: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\src\chart\SimpleChart.ts`

- [ ] **Step 1: Extend popup renderer options**

```ts
type PatternPopupOptions = {
  patternVisible: boolean;
  onMoveToPattern?: () => void;
  onEnablePatternVisible?: () => void;
};
```

- [ ] **Step 2: Render popup action buttons and status text**

```ts
<button data-role="move-pattern-range">구간 이동</button>
<button data-role="enable-pattern-visible">켜고 보기</button>
```

- [ ] **Step 3: Wire popup actions in `SimpleChart`**

```ts
showPatternPopupUi(host, signal, {
  patternVisible: this.isPatternBoxesVisible(),
  onMoveToPattern: () => this.focusPatternSignalRange(signal),
  onEnablePatternVisible: () => {
    this.setPatternBoxesVisible(true);
    this.focusPatternSignalRange(signal);
  },
});
```

- [ ] **Step 4: Reuse existing focus overlay**

```ts
private focusPatternSignalRange(signal: PatternSignal): void {
  const range = getPatternSignalRange(signal);
  if (!range) return;
  this.focusRangeByIndex(range.startIndex, range.endIndex, 8, {
    showCrosshair: true,
    focusStyle: range.startIndex === range.endIndex ? 'candle' : 'range',
  });
}
```

### Task 4: Verify integration and type safety

**Files:**
- Modify: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\src\patterns\pattern-detector.ts`
- Modify: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\src\patterns\pattern-popup.ts`
- Modify: `C:\Users\blue7\OneDrive\바탕 화면\my-chart-lib\src\chart\SimpleChart.ts`

- [ ] **Step 1: Run regression test**

Run: `node --test --experimental-strip-types tests/pattern-detector.test.ts`
Expected: PASS

- [ ] **Step 2: Run full build verification**

Run: `npm run build`
Expected: TypeScript compile and Vite build succeed without new errors.

- [ ] **Step 3: Inspect changed files for consistency**

Check:
- popup status matches `patternBoxesVisible`
- move action centers and highlights the range
- visibility enable action updates UI state and event dispatch

