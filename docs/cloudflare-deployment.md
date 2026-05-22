# Cloudflare deployment baseline

This repository uses Cloudflare Pages as the primary deployment target for both Codex app sessions and cloud-mode work.

## Source of truth

- Build output: `dist`
- Cloudflare config: `wrangler.jsonc`
- Production project: `chartwin`

## Commands

- Local app build: `npm run build`
- Cloudflare preview: `npm run preview:cloudflare`
- Cloudflare deploy: `npm run deploy:cloudflare`
- Cloudflare production deploy from `main`: `npm run deploy:cloudflare:prod`

## Notes

- `netlify.toml` is retained only as a legacy reference from the pre-Cloudflare setup.
- Local gateway traffic still uses `http://127.0.0.1:8787` on localhost and same-origin requests in deployed environments.
