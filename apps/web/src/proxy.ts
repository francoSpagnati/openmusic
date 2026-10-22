import { NextResponse, type NextRequest } from 'next/server';

/**
 * Old catalog search ids (`/releases/deezer-alb-302127`, `/releases/deezer-trk-3135556`) are not
 * release ids any more: answer with a real HTTP redirect to the external resolver, which imports
 * the album and redirects to its internal UUID. (The release page keeps an in-render fallback.)
 */
export function proxy(request: NextRequest) {
  const legacy = /^\/releases\/deezer-(alb|trk)-(\d{1,20})\/?$/.exec(request.nextUrl.pathname);
  if (!legacy) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/releases/external/deezer/${legacy[2]}`;
  url.search = legacy[1] === 'trk' ? '?type=track' : '';
  return NextResponse.redirect(url, 308);
}

export const config = { matcher: '/releases/:path*' };
