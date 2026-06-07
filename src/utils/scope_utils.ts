export function normalizeScope(value: string): string {
  const trimmedValue = value.trim().toLowerCase();
  if (!trimmedValue) {
    return '';
  }

  const withoutWildcard = trimmedValue.replace(/^\*\./, '');

  try {
    const candidate = withoutWildcard.includes('://')
      ? withoutWildcard
      : `https://${withoutWildcard}`;
    return new URL(candidate).hostname.replace(/^\.+|\.+$/g, '');
  } catch {
    return withoutWildcard
      .split('/')[0]
      .replace(/:\d+$/, '')
      .replace(/^\.+|\.+$/g, '');
  }
}

export function matchesHostBoundary(host: string, scopes: string[]): boolean {
  const normalizedHost = normalizeScope(host);
  return scopes.some((scope) => {
    const normalizedScope = normalizeScope(scope);
    return Boolean(normalizedScope) &&
      (normalizedHost === normalizedScope || normalizedHost.endsWith(`.${normalizedScope}`));
  });
}

export function isHostInScopes(host: string, scopes: string[]): boolean {
  return scopes.length === 0 || matchesHostBoundary(host, scopes);
}

export function isHostAllowed(host: string, scopes: string[], outOfScopes: string[]): boolean {
  return !matchesHostBoundary(host, outOfScopes) && isHostInScopes(host, scopes);
}
