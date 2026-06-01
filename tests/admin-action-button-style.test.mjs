import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const actionIcons = fs.readFileSync(new URL('../app/shared/action-icons.tsx', import.meta.url), 'utf8');

test('admin edit and delete action buttons stay compact', () => {
  assert.match(css, /\.action-icon-button\s*\{/);
  assert.match(css, /\.action-icon-button\.add/);
  assert.match(css, /\.action-icon-button\.edit:hover/);
  assert.match(css, /\.action-icon-button\.delete/);
  assert.match(css, /\.action-icon-button\.delete:hover/);
  assert.match(css, /height:\s*32px;/);
  assert.match(css, /width:\s*32px;/);
  assert.match(css, /#admin-support \.admin-support-thread-actions \{\s*min-width:\s*0;/s);
  assert.match(actionIcons, /lucide-square-pen/);
  assert.match(actionIcons, /M12 3H5a2 2 0 0 0-2 2v14/);
  assert.match(actionIcons, /lucide-circle-x/);
  assert.match(actionIcons, /<circle cx="12" cy="12" r="10"/);
  assert.match(actionIcons, /lucide-circle-plus/);
  assert.match(actionIcons, /M8 12h8/);
  assert.match(actionIcons, /M12 8v8/);
});
