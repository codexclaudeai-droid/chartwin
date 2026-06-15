console.error(
  [
    "Cloudflare Pages deployment is disabled for this project.",
    "Use `npm run service:cloudflare:deploy` or `npm run deploy:cloudflare` to deploy the chartwin Worker.",
    "Expected target: https://chartwin.thankpxp.workers.dev",
  ].join("\n"),
);

process.exit(1);
