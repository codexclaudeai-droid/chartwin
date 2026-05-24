# Cloudflare deployment baseline

This repository uses Cloudflare Pages as the primary deployment target for both Codex app sessions and cloud-mode work.

## Source of truth

- Build output: `dist`
- Cloudflare config: `wrangler.jsonc`
- Production project: `chartwin`
- Required Pages Functions binding: `CANDLES_KV`

## Commands

- Local app build: `npm run build`
- Cloudflare preview: `npm run preview:cloudflare`
- Cloudflare deploy: `npm run deploy:cloudflare`
- Cloudflare production deploy from `main`: `npm run deploy:cloudflare:prod`

## Notes

- `netlify.toml` is retained only as a legacy reference from the pre-Cloudflare setup.
- Local gateway traffic still uses `http://127.0.0.1:8787` on localhost and same-origin requests in deployed environments.
- The webhook candle API depends on a Cloudflare Pages KV namespace binding named `CANDLES_KV` in production. If this binding is missing, `/candles?...&debug=1` returns `ok:false`, `message:"CANDLES_KV binding missing"`, and stored webhook candles cannot be rendered.
- Configure the binding in Cloudflare Dashboard: Pages > `chartwin` > Settings > Functions > KV namespace bindings > Production. Use variable name `CANDLES_KV` and select the namespace that stores candle keys such as `index:NQ1!:1m` and `commodity:XAUUSD:1m`.
