type OriginCheckedRequest = {
  headers: Pick<Headers, 'get'>;
  url: string;
};

export function isSameOriginMutationRequest(request: OriginCheckedRequest): boolean {
  const requestOrigin = normalizeLoopbackOrigin(getUrlOrigin(request.url));
  if (!requestOrigin) return false;

  const origin = request.headers.get('origin');
  if (origin) {
    return normalizeLoopbackOrigin(getUrlOrigin(origin)) === requestOrigin;
  }

  const referer = request.headers.get('referer');
  if (referer) {
    return normalizeLoopbackOrigin(getUrlOrigin(referer)) === requestOrigin;
  }

  return true;
}

export function assertSameOriginMutationRequest(request: OriginCheckedRequest): void {
  if (!isSameOriginMutationRequest(request)) {
    throw new Error('Cross-site request blocked');
  }
}

function getUrlOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeLoopbackOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') {
      url.hostname = 'localhost';
      return url.origin;
    }
    return url.origin;
  } catch {
    return origin;
  }
}
