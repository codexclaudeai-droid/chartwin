import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tooltipBadgeSource = fs.readFileSync(new URL('../src/ui/workspace/tooltip-badge.ts', import.meta.url), 'utf8');

test('right-placed tooltip badges compensate for the arrow width so the tip can touch the boundary', () => {
  assert.match(
    tooltipBadgeSource,
    /const resolvedOffset = typeof offset === 'function' \? offset\(rect\) : offset;/,
  );
  assert.match(
    tooltipBadgeSource,
    /left = placement === 'right'[\s\S]*rect\.right \+ resolvedOffset \+ 4/,
  );
});

test('tooltip arrows center on the hovered icon for every placement axis', () => {
  assert.match(
    tooltipBadgeSource,
    /rect\.top \+ \(rect\.height \/ 2\)\) - top - 4/,
  );
  assert.match(
    tooltipBadgeSource,
    /rect\.left \+ \(rect\.width \/ 2\)\) - left - 4/,
  );
});
