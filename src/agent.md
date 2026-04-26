# AGENTS.md

## Project Identity
This project is a TradingView-style chart library for web.
The goal is not just visual similarity, but high usability, predictable interactions, and smooth performance.

## Core Product Goals
- Prioritize user convenience and interaction consistency over visual decoration.
- Match TradingView UX as closely as practical.
- Focus on zoom/pan feel, time scale behavior, price scale behavior, crosshair responsiveness, and toolbar usability.
- Keep the chart intuitive for beginners and efficient for advanced users.

## Engineering Principles
- Do not perform large refactors unless explicitly requested.
- Minimize scope of changes.
- Preserve existing public APIs unless necessary.
- Prefer modular, testable code.
- Separate rendering, input handling, scale logic, and UI controls.
- Avoid unnecessary dependencies.
- Optimize for large datasets and smooth interactions.

## UI/UX Principles
- Minimal visual noise, high information density.
- Clear hover / active / selected states.
- Stable and predictable zoom/pan interactions.
- Time scale and price scale must remain readable at all zoom levels.
- Toolbars should be compact but discoverable.
- Important actions should require minimal clicks.
- Support responsive layouts and keyboard accessibility when practical.

## Time Scale Rules
- Time scale labels must adapt based on visible range and zoom level, not only selected timeframe.
- Labels must not overlap.
- Promote label granularity naturally: second -> minute -> hour -> day -> month -> year.
- Emphasize boundary changes (day/month/year transitions).
- Keep tick generation and formatting logic separate.

## Crosshair Rules
- Crosshair must feel responsive and smooth.
- Update overlay layers without forcing full chart rerender.
- Show time label on time scale and price label on price scale.
- Surface OHLC info clearly.

## Output Format Required
When implementing a task, always respond with:
1. Problem understanding
2. Design approach
3. Files to change
4. Code changes
5. Acceptance criteria check
6. Risks / side effects
7. Next recommended task

## Guardrails
- Do not rewrite unrelated files.
- Do not silently change design patterns across the codebase.
- If a task is too large, propose a smaller scoped implementation first.
- If there is ambiguity, preserve current behavior and add extension points instead.

## Architecture (Post-Refactor — 2026-04-26)

`src/main.ts` is now a 2-line entry point. **Never add code directly to `src/main.ts`.**

### Module Map

| File | Responsibility |
|------|----------------|
| `src/main.ts` | Entry point only — imports `./app/init` |
| `src/chart/SimpleChart.ts` | Full `SimpleChart` class (~8,200 lines) — all chart rendering, event handling, drawing tools, indicators |
| `src/app/init.ts` | App bootstrap — mobile CSS, pane creation, feed management, event wiring |
| `src/utils/format.ts` | `formatKUnit`, `formatThousandAdaptive` |
| `src/utils/currency.ts` | `getUsdtToDisplayRate` — async USDT conversion |
| `src/utils/market-session.ts` | `canonicalizeUiSymbol`, `isNasdaqFuturesLikeSymbol`, `isCmeEquityFuturesOpen`, `getChicagoWeekdayHourMinute` |
| `src/utils/gap-smoothing.ts` | `GapMode` type, `applyGapSmoothing`, `loadGapMode`, `loadPatternAnalysisScope`, `loadPatternAlertEnabled` |

### Rules for New Code
- Chart rendering logic → `src/chart/SimpleChart.ts`
- New utility functions → appropriate file in `src/utils/`
- New app-level initialization or UI wiring → `src/app/init.ts`
- New utility modules go in `src/utils/<name>.ts` and are imported by consumers
- Shared constants used across modules must be `export const` at the top of their owning file
- Cross-module imports use relative paths (e.g., `../utils/format`, `../chart/SimpleChart`)