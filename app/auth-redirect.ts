export function getSafeRedirectPath(searchParams: URLSearchParams): string | null {
  const redirect = searchParams.get('redirect');
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) return null;
  return redirect;
}

export function navigateToSafeRedirect(searchParams: URLSearchParams): boolean {
  const redirect = getSafeRedirectPath(searchParams);
  if (!redirect) return false;
  window.location.assign(redirect);
  return true;
}
