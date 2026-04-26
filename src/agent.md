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