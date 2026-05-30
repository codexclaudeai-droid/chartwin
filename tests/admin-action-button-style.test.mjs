import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('admin edit and delete action buttons stay compact', () => {
  assert.match(css, /body:not\(:has\(\.landing-page\)\) \.admin-page \.button\.compact,/);
  assert.match(css, /body:not\(:has\(\.landing-page\)\) \.admin-symbols-row-actions \.button,/);
  assert.match(css, /body:not\(:has\(\.landing-page\)\) #admin-support \.admin-support-thread-actions \.button/);
  assert.match(css, /min-height:\s*28px;/);
  assert.match(css, /padding:\s*0 10px;/);
  assert.match(css, /font-size:\s*0\.72rem;/);
  assert.match(css, /#admin-support \.admin-support-thread-actions \{\s*min-width:\s*0;/s);
});
