/**
 * Returns `url` only when it is an absolute http(s) link, otherwise null. Use it for every
 * user-supplied `href`: the API validates new links, but rows written before that check (or by
 * other clients) must never render a `javascript:` / `data:` link.
 */
export function externalHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * A post-login destination taken from `?next=`: only same-origin paths are allowed. Rejects
 * `//host` and `/\host` (browsers normalise `\` to `/`, so both are protocol-relative URLs) and
 * anything that resolves to another origin.
 */
export function safeRelativePath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || /^\/[/\\]/.test(next) || /[\u0000-\u001f]/.test(next)) {
    return '/';
  }
  const base = 'http://openmusic.invalid';
  try {
    const resolved = new URL(next, base);
    return resolved.origin === base
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : '/';
  } catch {
    return '/';
  }
}
