import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_ENV_FILES = ['.env.local', '.env'];

export function parseEnvFile(content) {
  const values = {};
  String(content || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return;
      const key = match[1];
      const value = stripInlineComment(match[2].trim());
      values[key] = unquoteEnvValue(value);
    });
  return values;
}

export function loadLocalEnvFiles({
  cwd = process.cwd(),
  env = process.env,
  files = DEFAULT_ENV_FILES,
} = {}) {
  const loadedFiles = [];
  for (const file of files) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    const values = parseEnvFile(readFileSync(path, 'utf8'));
    Object.entries(values).forEach(([key, value]) => {
      if (env[key] == null || env[key] === '') {
        env[key] = value;
      }
    });
    loadedFiles.push(path);
  }
  return { loadedFiles };
}

function stripInlineComment(value) {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    if (char === '"' && !inSingle) inDouble = !inDouble;
    if (char === '#' && !inSingle && !inDouble && /\s/.test(value[index - 1] || '')) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  }
  return value;
}

loadLocalEnvFiles();
