type OriginCheckedRequest = {
  headers: Pick<Headers, 'get'>;
  url: string;
};

export function isSameOriginMutationRequest(request: OriginCheckedRequest): boolean {
  const requestOrigin = getUrlOrigin(request.url);
  if (!requestOrigin) return false;

  const origin = request.headers.get('origin');
  if (origin) {
    return getUrlOrigin(origin) === requestOrigin;
  }

  const referer = request.headers.get('referer');
  if (referer) {
    return getUrlOrigin(referer) === requestOrigin;
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
