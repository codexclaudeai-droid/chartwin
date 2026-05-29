# Cloudflare deployment baseline

This repository now has two Cloudflare deployment tracks:

- Legacy Vite chart-only Pages deployment.
- Integrated Next.js chart-service deployment for landing, auth, subscriptions, admin pages, API routes, and the embedded chart runtime.

## Source of truth

- Legacy chart-only build output: `dist`
- Integrated Next/OpenNext build output: `.open-next`
- Integrated Cloudflare config: `wrangler.jsonc`
- Production project: `chartwin`

## Legacy chart-only commands

- Local app build: `npm run build`
- Cloudflare preview: `npm run preview:cloudflare`
- Cloudflare deploy: `npm run deploy:cloudflare`
- Cloudflare production deploy from `main`: `npm run deploy:cloudflare:prod`

These commands deploy the Vite `dist` bundle only. They do not deploy Next.js API routes or server-rendered chart-service pages.

## Integrated Next.js commands

- Local Next build: `npm run service:build`
- OpenNext Cloudflare build: `npm run service:cloudflare:build`
- Local Cloudflare Worker preview: `npm run preview:cloudflare:next`
- Cloudflare Worker deploy: `npm run deploy:cloudflare:next`

Run the release gates before production deployment:

```powershell
npm.cmd run service:launch-check
npm.cmd run service:postgres:gate
```

After deployment:

```powershell
$env:CHART_SERVICE_BASE_URL='https://YOUR_DOMAIN'
npm.cmd run service:postdeploy:smoke
```

## Notes

- `netlify.toml` is retained only as a legacy reference from the pre-Cloudflare setup.
- Local gateway traffic still uses `http://127.0.0.1:8787` on localhost and same-origin requests in deployed environments.
- OpenNext warns that Windows is not fully supported. If `service:cloudflare:build` exits on Windows after the Next build, rerun the same command in WSL or Linux CI with Node.js installed.
- Production Postgres on Cloudflare should be verified with the runtime DB connection path before release. Hyperdrive or Cloudflare Workers TCP socket compatibility may be required for the `pg` driver path.
