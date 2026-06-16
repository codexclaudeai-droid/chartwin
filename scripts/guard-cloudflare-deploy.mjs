import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);

function getArgValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

function fail(violations) {
  console.error('Blocked Cloudflare deploy from chart engine repo:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

if (args.includes('--deny-prod-deploy')) {
  fail(['production Cloudflare deploy is disabled from this repository']);
}

const cwd = process.cwd();
const configPath = path.resolve(cwd, getArgValue('--config', process.env.WRANGLER_CONFIG_PATH || 'wrangler.jsonc'));
const packagePath = path.resolve(cwd, getArgValue('--package', 'package.json'));
const configSource = fs.readFileSync(configPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const scripts = packageJson.scripts || {};

const violations = [];
const forbiddenConfigPatterns = [
  [/^\s*"name"\s*:\s*"chartwin"/m, 'wrangler config targets the production chartwin Worker name'],
  [/"main"\s*:/, 'wrangler config contains a Worker entrypoint'],
  [/"assets"\s*:/, 'wrangler config contains Workers static asset binding'],
  [/"routes"\s*:/, 'wrangler config contains custom domain routes'],
  [/"workers_dev"\s*:/, 'wrangler config can publish to workers.dev'],
  [/tradingcore\.co/i, 'wrangler config references tradingcore.co production domains'],
  [/CHART_SERVICE_/i, 'wrangler config contains full-stack CHART_SERVICE variables'],
  [/DATA_GATEWAY_URL/i, 'wrangler config contains production data gateway wiring'],
  [/"hyperdrive"\s*:/, 'wrangler config contains production Hyperdrive binding'],
  [/"send_email"\s*:/, 'wrangler config contains production email binding'],
];

for (const [pattern, message] of forbiddenConfigPatterns) {
  if (pattern.test(configSource)) {
    violations.push(message);
  }
}

if (!/"pages_build_output_dir"\s*:\s*"\.\/dist"/.test(configSource)) {
  violations.push('wrangler config must be a Pages config with pages_build_output_dir="./dist"');
}

for (const [name, script] of Object.entries(scripts)) {
  if (!/^deploy:cloudflare/.test(name) && name !== 'preview:cloudflare') continue;

  if (/\bwrangler\s+deploy\b/.test(script)) {
    violations.push(`${name} runs bare wrangler deploy`);
  }

  if (/--project-name\s+(?:chartwin|tradingcore)\b/.test(script)) {
    violations.push(`${name} targets the old tradingcore Pages project`);
  }

  if (name === 'deploy:cloudflare:prod' && /\bwrangler\s+(pages\s+)?deploy\b/.test(script)) {
    violations.push(`${name} must not deploy from this chart engine repo`);
  }
}

if (violations.length > 0) {
  fail(violations);
}

console.log('Cloudflare deploy guard passed: chart engine repo is isolated from production Worker targets.');
