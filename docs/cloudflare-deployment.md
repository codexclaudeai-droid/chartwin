# Cloudflare deployment safety

This repository is the chart engine development surface. It must not deploy to the
production `chartwin` Worker or any `tradingcore.co` route.

## Source of truth

- Production full-stack Worker: managed outside this repository.
- Chart engine Cloudflare target: Pages project `chart-engine-dev`.
- Legacy Cloudflare Pages project: `tradingcore` (`chartwin.pages.dev`).
  Its Git auto deploys must stay disabled.
- Build output: `dist`.
- Cloudflare config: `wrangler.jsonc`.
- Deploy guard: `scripts/guard-cloudflare-deploy.mjs`.
- Pages build guard: `scripts/guard-cloudflare-pages-build.mjs`.

## Commands

- Local app build: `npm run build`
- Cloudflare Pages preview: `npm run preview:cloudflare`
- Cloudflare Pages development deploy: `npm run deploy:cloudflare`
- Production Cloudflare deploy: intentionally blocked by `npm run deploy:cloudflare:prod`

## Guardrails

- `wrangler deploy` is not allowed from this repository.
- `wrangler.jsonc` must stay a Pages config with `pages_build_output_dir`.
- The config must not contain Worker-only fields such as `main`, `assets`,
  `routes`, or `workers_dev`.
- The config must not reference `chartwin`, `tradingcore.co`,
  `CHART_SERVICE_*`, `DATA_GATEWAY_URL`, `hyperdrive`, or `send_email`.
- `npm run deploy:cloudflare` runs the guard before `wrangler pages deploy`.
- Cloudflare Pages Git builds for `chartwin.pages.dev` are blocked during
  `prebuild` and Vite config loading.
- Manual `wrangler pages deploy ... --project-name tradingcore` is blocked.

If the production full-stack Worker needs deployment, use the full-stack
repository or its Cloudflare pipeline. Do not use this chart engine workspace.
