// @ts-check
/**
 * Image hosts that the Next.js image optimizer (`/_next/image`) is allowed to fetch.
 *
 * Only the CDNs the catalog actually stores covers on, plus the hosts used by the seed data.
 * Anything else is rendered by the browser directly (`unoptimized`), so the web server is never
 * an open image proxy. Shared by `next.config.mjs` and `src/lib/images.ts`; keep it plain JS.
 *
 * Hostname globs follow Next.js: `*` = exactly one subdomain label, `**` = any number of them.
 *
 * @type {ReadonlyArray<{ protocol: 'https'; hostname: string; pathname: string }>}
 */
export const IMAGE_REMOTE_PATTERNS = [
  // Deezer covers / artist pictures: cdn-images.dzcdn.net, e-cdns-images.dzcdn.net.
  { protocol: 'https', hostname: '*.dzcdn.net', pathname: '/images/**' },
  // Apple iTunes Search artwork: is1-ssl.mzstatic.com ... is5-ssl.mzstatic.com.
  { protocol: 'https', hostname: '*.mzstatic.com', pathname: '/image/**' },
  // Cover Art Archive: coverartarchive.org redirects to archive.org / ia*.us.archive.org.
  { protocol: 'https', hostname: 'coverartarchive.org', pathname: '/**' },
  { protocol: 'https', hostname: 'archive.org', pathname: '/download/**' },
  { protocol: 'https', hostname: '**.archive.org', pathname: '/**' },
  // Seed covers and avatars.
  { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
  // YouTube thumbnails for curated videos without their own thumbnail.
  { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' },
];
