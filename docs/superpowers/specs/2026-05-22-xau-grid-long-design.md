# XAU Grid Long JS Strategy Design

## Summary

Add a new chart-only strategy module that ports the Pine Script "XAU Grid - Long Indicator" into the existing JavaScript strategy system. The strategy will emit standard chart signals (`1`, `0`, `-1`) while internally simulating grid slot ownership so we can later support external bot/webhook integration without rewriting the core engine.

## Goals

- Add a new standalone strategy file under `src/strategy/strategies/`.
- Match the Pine strategy's fixed-range long grid behavior closely enough for chart signal analysis.
- Keep runtime state rich enough to support future bot integration metadata.
- Avoid Pine's external alert mismatch problem by separating chart signal output from internal event tracking.

## Non-Goals

- No webhook delivery in this phase.
- No 3Commas-specific execution logic in this phase.
- No large UI/report redesign beyond making the strategy selectable and usable.

## Architecture

The implementation will use two layers:

1. A reusable grid runtime simulator that processes the full candle close series and returns:
   - per-bar chart signals
   - per-bar event metadata
   - current virtual slot ownership state
   - average entry, deployed capital, and open position metrics
2. A strategy definition wrapper that plugs the simulator into the existing `sourceCode`-based strategy execution model and returns only `-1`, `0`, or `1` for each bar.

This keeps the chart integration simple while preserving future bot-ready metadata inside the runtime result.

## Files

- New: `src/strategy/strategies/xau-grid-long-runtime.ts`
- New: `src/strategy/strategies/xau-grid-long-js.ts`
- Update: `src/strategy/strategies/index.ts`
- New or update tests around runtime behavior and strategy registration

## Runtime Behavior

### Inputs

The strategy runtime will support configurable parameters aligned with the Pine script:

- `highPrice`
- `lowPrice`
- `nLevels`
- `gridMode` (`geometric` or `arithmetic`)
- `investment`

### Grid Model

- Precompute grid levels between `highPrice` and `lowPrice`.
- Track ownership for each slot level in an internal boolean array.
- Use equal notional allocation per level: `investment / nLevels`.
- Maintain:
  - `totalCost`
  - `totalQty`
  - `avgEntry`
  - `ownedCount`

### Event Rules

BUY event:
- Trigger when close crosses down through an empty slot level.
- Mark that slot owned.
- Increase total cost and quantity.

SELL event:
- Trigger when close crosses up through the level immediately above an owned slot.
- Release that slot.
- Decrease total cost and quantity.

### Multi-Level Cross Improvement

If one bar crosses multiple levels:

- The runtime will process all crossed levels to keep virtual state accurate.
- The chart signal output for that bar will collapse to one direction:
  - `1` if the bar created one or more buy events and no sell events
  - `-1` if the bar created one or more sell events and no buy events
  - if both directions appear in one bar, prefer the net final event direction and keep the full crossed-level list in metadata

This improves chart compatibility while preserving future execution detail.

## Metadata Design

The runtime result should preserve per-bar metadata for future expansion, including:

- `eventType`
- `buyLevels`
- `sellLevels`
- `ownedCount`
- `avgEntry`
- `deployedCapital`
- `openQty`
- `openPnl`
- `botPayloadHint`

`botPayloadHint` is only preparatory metadata in this phase and will not be sent anywhere.

## Strategy Wrapper

The strategy definition will:

- expose chart-friendly defaults
- call the runtime once per series using a cache key
- return `result.signals[index] || 0`

The wrapper should follow the same pattern already used by `grid-martingale-js.ts`.

## Testing

We will add targeted runtime tests for:

- level generation in arithmetic and geometric modes
- single buy event on downward cross
- single sell event on upward cross above an owned slot
- multiple level crossings in one bar
- avg entry and ownership count updates
- zero signal on bars with no crossing

We will also verify the strategy is exported and selectable from the shared strategy index.

## Risks

- Existing strategy reports are signal-centric, so rich grid metadata may not surface in the UI yet.
- Pine and JS behavior can differ slightly if edge handling around equal-price boundaries is inconsistent.
- Large jumps across many levels in one bar require careful ordering to keep state deterministic.

## Implementation Notes

- Use the current codebase pattern of keeping reusable simulation logic outside the inline strategy source string.
- Keep the initial integration chart-only, but structure runtime output so later webhook mapping is straightforward.
- Prefer deterministic close-to-close logic first; intrabar touch logic is out of scope for this phase.
