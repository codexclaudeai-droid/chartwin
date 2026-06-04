import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const subject = readArgValue('--subject') ?? 'mailto:support@tradingcore.co';
const shouldWriteEnvLocal = args.has('--write-env-local');
const envLocalPath = path.resolve('.env.local');

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

const webPushPublicKey = base64UrlEncode(Buffer.concat([
  Buffer.from([0x04]),
  base64UrlDecode(publicJwk.x),
  base64UrlDecode(publicJwk.y),
]));
const webPushPrivateKey = privateJwk.d;

if (shouldWriteEnvLocal) {
  writeEnvLocal({
    WEB_PUSH_PUBLIC_KEY: webPushPublicKey,
    WEB_PUSH_PRIVATE_KEY: webPushPrivateKey,
    WEB_PUSH_SUBJECT: subject,
  });
  console.log(`Wrote Web Push VAPID keys to ${envLocalPath}`);
  console.log('Do not commit .env.local.');
} else {
  console.log('WEB_PUSH_PUBLIC_KEY=' + webPushPublicKey);
  console.log('WEB_PUSH_PRIVATE_KEY=' + webPushPrivateKey);
  console.log('WEB_PUSH_SUBJECT=' + subject);
}

function readArgValue(name) {
  const directPrefix = `${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(directPrefix)) return arg.slice(directPrefix.length);
  }
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return null;
}

function writeEnvLocal(nextValues) {
  const existing = fs.existsSync(envLocalPath)
    ? fs.readFileSync(envLocalPath, 'utf8')
    : '';
  const lines = existing.split(/\r?\n/).filter((line) => {
    const key = line.split('=')[0];
    return !Object.prototype.hasOwnProperty.call(nextValues, key);
  });

  if (lines.length > 0 && lines.at(-1) !== '') lines.push('');
  for (const [key, value] of Object.entries(nextValues)) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envLocalPath, `${lines.join('\n').replace(/\n+$/u, '')}\n`);
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
