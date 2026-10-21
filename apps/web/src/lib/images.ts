import { IMAGE_REMOTE_PATTERNS } from '../../image-hosts.mjs';

/** Next.js hostname glob -> RegExp (`*` = one label, `**` = one or more labels). */
function hostnameRegExp(glob: string): RegExp {
  const source = glob
    .split('.')
    .map((label) =>
      label === '**'
        ? '[a-z0-9-]+(?:\\.[a-z0-9-]+)*'
        : label === '*'
          ? '[a-z0-9-]+'
          : label.replace(/[-]/g, '\\-')
    )
    .join('\\.');
  return new RegExp(`^${source}$`, 'i');
}

/** Path glob (`/images/**`) -> RegExp. */
function pathnameRegExp(glob: string): RegExp {
  const source = glob
    .split('/')
    .map((segment) => (segment === '**' ? '.*' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${source.replace(/\/\.\*$/, '(?:/.*)?')}$`);
}

const MATCHERS = IMAGE_REMOTE_PATTERNS.map((pattern) => ({
  protocol: `${pattern.protocol}:`,
  host: hostnameRegExp(pattern.hostname),
  path: pathnameRegExp(pattern.pathname),
}));

/**
 * True when `/_next/image` may optimize this URL (same allowlist as `next.config.mjs`).
 * Other URLs must be rendered with `unoptimized`, or Next refuses them.
 */
export function isOptimizableImage(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return MATCHERS.some(
    (m) => m.protocol === url.protocol && m.host.test(url.hostname) && m.path.test(url.pathname)
  );
}
