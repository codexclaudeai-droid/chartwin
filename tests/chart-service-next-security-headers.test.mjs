import assert from 'node:assert/strict';
import test from 'node:test';

test('next service applies baseline security headers to every route', async () => {
  const config = (await import('../next.config.mjs')).default;

  assert.equal(typeof config.headers, 'function');
  const headerRules = await config.headers();
  const globalRule = headerRules.find((rule) => rule.source === '/:path*');
  assert.ok(globalRule);

  const headers = new Map(globalRule.headers.map((header) => [header.key, header.value]));

  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.match(headers.get('Permissions-Policy') || '', /camera=\(\)/);
  assert.match(headers.get('Permissions-Policy') || '', /microphone=\(\)/);
  assert.match(headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
  assert.match(headers.get('Content-Security-Policy') || '', /object-src 'none'/);
});

test('next service hides the framework powered-by header', async () => {
  const config = (await import('../next.config.mjs')).default;

  assert.equal(config.poweredByHeader, false);
});
