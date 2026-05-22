# Chart Modularization Rules

This document records the preferred module boundaries for chart work so future sessions continue the same structure instead of inventing parallel patterns.

## Core Rule

Keep `src/chart/SimpleChart.ts` as the coordinator. It may own chart state, call helpers, and apply side effects, but new calculation, rendering, hit-test, factory, and interaction logic should live in focused modules.

Before adding code to `SimpleChart.ts`, first check whether an existing module category already fits.

## Module Boundaries

- Indicator calculations belong in `src/chart/indicators`.
- Indicator canvas drawing belongs in `src/chart/renderers/*-renderer.ts`.
- Main chart, background, axes, crosshair, overlays, and subpanel drawing belong in `src/chart/renderers`.
- Drawing shape rendering belongs in `src/chart/drawings/*-renderer.ts`.
- Drawing state operations belong in `src/chart/drawings/drawing-state.ts`.
- Drawing hit-test and transform logic belong in `src/chart/drawings/drawing-hit-test.ts` and `src/chart/drawings/drawing-transform.ts`.
- Drawing creation logic belongs in `src/chart/drawings/factories`.
- Mouse, touch, wheel, cursor, pan, drag, and hit-decision logic belongs in `src/chart/interaction`.
- UI popup or modal DOM side effects may remain in `SimpleChart.ts` until a dedicated UI module is introduced.

## Naming Conventions

- Use `calculate*` for pure indicator calculations.
- Use `render*` for canvas drawing functions.
- Use `resolve*` for decision helpers that return a typed result without side effects.
- Use `create*Drawing` for drawing factory functions.
- Use `*Interaction` for mouse/touch/wheel helpers.
- Use `*HitTest` or `*Normalizer` for pointer hit and selection correction helpers.

## Side-Effect Rule

Helpers should prefer pure inputs and outputs.

Allowed in helpers:
- Coordinate math.
- Scale/range calculations.
- Hit-test decisions.
- Object creation.
- Typed result objects such as `{ type: 'range' }` or `{ status: 'created' }`.

Keep in `SimpleChart.ts` unless there is a dedicated owner module:
- DOM mutation.
- Popup/modal open and close.
- `this.draw()` and `this.requestOverlayDraw()`.
- Mutating chart-level state.
- Calling callbacks registered by the app.

## Drawing Rules

- New final drawing shapes should be created through `src/chart/drawings/factories`.
- Draft updates should use `src/chart/drawings/drawing-draft-update.ts`.
- Draft completion should use `finishDrawingDraft`.
- If a drawing has both desktop and touch creation paths, both paths should call the same factory.
- Renderer modules should not create or mutate drawing state.

## Interaction Rules

- Cursor decisions should go through `chart-cursor-resolver.ts`.
- Wheel zoom/pan should go through `wheel-interaction.ts`.
- Axis drag calculations should go through `axis-drag-interaction.ts`.
- Chart pan calculations should go through `chart-pan-interaction.ts`.
- Position drawing hit correction should go through `position-drawing-hit-normalizer.ts`.
- Repeated circular hit checks should use `pointer-hit-test.ts`.

## Indicator Rules

- Add a new indicator in two parts when possible: calculation under `indicators`, rendering under `renderers`.
- Keep indicator-specific background rendering in renderer modules, not in `SimpleChart.ts`.
- Shared subpanel math belongs in subpanel utilities/render context modules.
- Avoid adding new indicator-specific branches directly to large render loops unless they only delegate to a module.

## Verification Rule

After each modularization step, run:

```powershell
npm.cmd run build
node --test tests\*.test.mjs
```

The Vite chunk-size warning is acceptable. TypeScript errors or test failures must be fixed before continuing.

## When To Pause

Pause and ask before changing behavior in these cases:

- A refactor would change touch behavior compared with mouse behavior.
- A helper would need to own DOM lifecycle or popup state.
- Existing user changes conflict with the current edit.
- A module boundary is unclear and would require creating a new category.
