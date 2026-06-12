import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('binance direct feed repairs sleep and reconnect gaps from recent history before drawing live ticks', () => {
  const source = fs.readFileSync(new URL('../src/data/binance-live-feed.ts', import.meta.url), 'utf8');

  assert.match(source, /const syncRecentHistory = async \(\): Promise<boolean> =>/);
  assert.match(source, /window\.addEventListener\('focus', handleResumeSync\)/);
  assert.match(source, /window\.addEventListener\('online', handleResumeSync\)/);
  assert.match(source, /window\.addEventListener\('pageshow', handleResumeSync\)/);
  assert.match(source, /document\.addEventListener\('visibilitychange', handleVisibilitySync\)/);
  assert.match(source, /await syncRecentHistory\(\)/);
  assert.match(source, /const merged = Array\.from\(byTime\.values\(\)\)[\s\S]*?chart\.setData\(merged\)/);
  assert.match(
    source,
    /if \(bucketTimeSec > last\.time \+ bucketSec\) \{\s*void syncRecentHistory\(\);\s*return;\s*\}/,
  );
  assert.doesNotMatch(
    source,
    /for \(let sec = last\.time \+ bucketSec; sec < bucketTimeSec; sec \+= bucketSec\) \{\s*chart\.addNewCandle/,
  );
});
