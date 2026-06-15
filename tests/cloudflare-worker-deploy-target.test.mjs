import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

test("cloudflare deploy aliases target the Worker, not Pages", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const scripts = packageJson.scripts ?? {};

  assert.equal(
    scripts["deploy:cloudflare"],
    "npm run service:cloudflare:deploy",
  );
  assert.equal(
    scripts["deploy:cloudflare:prod"],
    "npm run service:cloudflare:deploy",
  );
  assert.equal(
    scripts["deploy:cloudflare:pages"],
    "node scripts/prevent-cloudflare-pages-deploy.mjs",
  );
  assert.equal(
    scripts["deploy:cloudflare:pages:prod"],
    "node scripts/prevent-cloudflare-pages-deploy.mjs",
  );
});

test("tracked deployment entrypoints do not run wrangler pages deploy", async () => {
  const files = [
    "package.json",
    ".github/workflows/cloudflare-deploy.yml",
  ];

  for (const file of files) {
    const content = await readFile(file, "utf8");

    assert.doesNotMatch(
      content,
      /\bwrangler\s+pages\s+deploy\b/,
      `${file} must not deploy to Cloudflare Pages`,
    );
  }
});
