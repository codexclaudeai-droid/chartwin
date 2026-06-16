# Cloudflare deployment baseline

This repository uses Cloudflare Workers as the primary deployment target for both Codex app sessions and cloud-mode work.

## Source of truth

- Worker name: `chartwin`
- Worker entrypoint: `worker/index.js`
- Static asset directory: `dist`
- Default Worker URL: `https://chartwin.<account-subdomain>.workers.dev`
- Cloudflare config: `wrangler.jsonc`
- Required Worker bindings: `ASSETS`, `CANDLES_KV`, `HYPERDRIVE`, `EMAIL`

## Commands

- Local app build: `npm run build`
- Cloudflare preview: `npm run preview:cloudflare`
- Cloudflare deploy: `npm run deploy:cloudflare`
- Cloudflare production deploy from `main`: `npm run deploy:cloudflare:prod`

## Notes

- `wrangler deploy` updates the existing `chartwin` Worker and its bound routes/domains. The local `wrangler.jsonc` now carries the production custom domains, cron trigger, and non-secret bindings so deployments do not wipe dashboard-only Worker settings.
- `netlify.toml` is retained only as a legacy reference from the pre-Cloudflare setup.
- Local gateway traffic still uses `http://127.0.0.1:8787` on localhost and same-origin requests in deployed environments.
- The candle APIs continue to reuse the existing route modules under `functions/*`; `worker/index.js` is a thin Workers fetch wrapper around those handlers.
- The webhook candle API depends on a Worker KV namespace binding named `CANDLES_KV`. If this binding is missing, `/candles?...&debug=1` returns `ok:false`, `message:"CANDLES_KV binding missing"`, and stored webhook candles cannot be rendered.
- Configure the binding in Cloudflare Dashboard: Workers & Pages > `chartwin` > Settings > Bindings. Use variable name `CANDLES_KV` and select the namespace that stores candle keys such as `index:NQ1!:1m` and `commodity:XAUUSD:1m`.
