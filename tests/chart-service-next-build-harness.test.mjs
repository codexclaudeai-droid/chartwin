import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('next service build harness uses a deterministic dist directory that tsconfig already includes', () => {
  const script = fs.readFileSync(new URL('../scripts/run-next-build.mjs', import.meta.url), 'utf8');
  const tsconfig = fs.readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8');

  assert.doesNotMatch(script, /randomUUID/);
  assert.match(script, /const distDir = ['"]\.tmp\/next-service-build['"]/);
  assert.match(tsconfig, /"\.tmp\/next-service-build\/types\/\*\*\/\*\.ts"/);
  assert.match(tsconfig, /"\.tmp\/next-service-build\/dev\/types\/\*\*\/\*\.ts"/);
});
