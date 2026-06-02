import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import zlib from 'node:zlib';

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

function readVisiblePngPixelCount(path) {
  const buffer = fs.readFileSync(new URL(path, root));
  assert.equal(buffer.slice(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG file`);

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  assert.equal(bitDepth, 8, `${path} must use 8-bit PNG channels`);
  assert.equal(colorType, 6, `${path} must use RGBA PNG pixels`);

  const idatChunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    if (type === 'IDAT') idatChunks.push(buffer.slice(dataStart, dataStart + length));
    offset = dataStart + length + 4;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  let inputOffset = 0;
  let visible = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[inputOffset + x];
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value;

      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else {
        throw new Error(`${path} uses unsupported PNG filter ${filter}`);
      }

      current[x] = value & 0xff;
    }

    for (let x = 3; x < stride; x += bytesPerPixel) {
      if (current[x] > 0) visible += 1;
    }

    previous.set(current);
    inputOffset += stride;
  }

  return visible;
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

test('brand raster icons contain visible pixels', () => {
  for (const path of [
    'public/favicon-16x16.png',
    'public/favicon-32x32.png',
    'public/apple-touch-icon.png',
    'public/android-chrome-192x192.png',
    'public/android-chrome-512x512.png',
  ]) {
    assert.ok(readVisiblePngPixelCount(path) > 0, `${path} must not be fully transparent`);
  }
});
