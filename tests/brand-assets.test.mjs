import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function readText(path) {
  return fs.readFileSync(new URL(path, root), 'utf8');
}

function readPngSize(path) {
  const buffer = fs.readFileSync(new URL(path, root));
  assert.equal(buffer.slice(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG file`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('brand metadata uses dedicated high resolution sharing artwork', () => {
  const layout = readText('app/layout.tsx');

  assert.match(layout, /metadataBase:\s*new URL\(siteUrl\)/);
  assert.match(layout, /openGraph:\s*{[\s\S]*images:/);
  assert.match(layout, /twitter:\s*{[\s\S]*images:/);
  assert.match(layout, /\/og-image\.png/);

  assert.deepEqual(readPngSize('public/og-image.png'), { width: 1200, height: 630 });
});

test('installable app icons include crisp large raster sizes', () => {
  const manifest = JSON.parse(readText('public/site.webmanifest'));
  const iconSources = manifest.icons.map((icon) => icon.src);

  assert.ok(iconSources.includes('/android-chrome-192x192.png'));
  assert.ok(iconSources.includes('/android-chrome-512x512.png'));
  assert.deepEqual(readPngSize('public/android-chrome-192x192.png'), { width: 192, height: 192 });
  assert.deepEqual(readPngSize('public/android-chrome-512x512.png'), { width: 512, height: 512 });
  assert.deepEqual(readPngSize('public/apple-touch-icon.png'), { width: 180, height: 180 });
});
