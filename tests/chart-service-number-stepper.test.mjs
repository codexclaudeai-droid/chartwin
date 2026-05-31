import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

const adminPanelPaths = listTsxFiles(new URL('../app/admin', import.meta.url));

test('admin number inputs use the shared chevron number stepper', () => {
  const rawNumberInputs = adminPanelPaths
    .flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return source.includes('type="number"') ? [path] : [];
    });
  const pointSource = readFileSync(new URL('../app/admin/admin-point-settings-panel.tsx', import.meta.url), 'utf8');
  const trialPolicySource = readFileSync(new URL('../app/admin/admin-trial-policy-panel.tsx', import.meta.url), 'utf8');
  const salesSource = readFileSync(new URL('../app/admin/admin-sales-panel.tsx', import.meta.url), 'utf8');
  const userSource = readFileSync(new URL('../app/admin/user-admin-panel.tsx', import.meta.url), 'utf8');
  const stepperSource = readFileSync(new URL('../app/shared/number-stepper.tsx', import.meta.url), 'utf8');

  assert.deepEqual(rawNumberInputs, []);
  for (const source of [pointSource, trialPolicySource, salesSource, userSource]) {
    assert.match(source, /NumberStepper/);
  }
  assert.match(stepperSource, /ChevronUpIcon/);
  assert.match(stepperSource, /ChevronDownIcon/);
  assert.match(stepperSource, /allowEmpty/);
  assert.match(stepperSource, /placeholder/);
  assert.match(stepperSource, /required/);
});

function listTsxFiles(directoryUrl) {
  const directory = fileURLToPath(directoryUrl);
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) return [];
      return path.endsWith('.tsx') ? [path] : [];
    });
}
