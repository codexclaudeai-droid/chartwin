const DEV_PATH_SUFFIX = '/dev.html';

export type AppVariant = 'beta' | 'dev';

export function getAppVariant(): AppVariant {
  if (typeof window === 'undefined') return 'beta';
  const metaVariant = document
    .querySelector('meta[name="app-variant"]')
    ?.getAttribute('content')
    ?.trim()
    .toLowerCase();
  if (metaVariant === 'dev' || metaVariant === 'beta') {
    return metaVariant;
  }
  const pathname = String(window.location.pathname || '').toLowerCase();
  return pathname.endsWith(DEV_PATH_SUFFIX) || pathname.endsWith('dev.html') ? 'dev' : 'beta';
}

export function isDevAppVariant(): boolean {
  return getAppVariant() === 'dev';
}

export function isBetaAppVariant(): boolean {
  return getAppVariant() === 'beta';
}
