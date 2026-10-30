/**
 * Deezer 30s previews are signed CDN URLs (`...mp3?hdnea=exp=<unix>~acl=...~hmac=...`) that
 * answer 403 about 15 minutes after they were issued. Clients therefore never receive them: the
 * API hands out `/api/catalog/tracks/<id>/preview`, which redirects to a fresh URL on demand.
 */
const SIGNED_EXP = /[?&]hdnea=exp=(\d+)/;

/** Seconds since epoch at which a Deezer signed URL stops working; null for any other URL. */
export function deezerPreviewExpiry(url: string): number | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (host !== 'dzcdn.net' && !host.endsWith('.dzcdn.net')) return null;
  const exp = SIGNED_EXP.exec(url)?.[1];
  return exp ? Number(exp) : null;
}

/** Root-relative path of the redirecting preview endpoint of a track. */
export function trackPreviewPath(trackId: string): string {
  return `/api/catalog/tracks/${trackId}/preview`;
}

/** Stored preview URL -> what the API exposes: expiring Deezer URLs become the endpoint path. */
export function publicPreviewUrl(trackId: string, previewUrl: string | null): string | null {
  if (!previewUrl) return null;
  return deezerPreviewExpiry(previewUrl) === null ? previewUrl : trackPreviewPath(trackId);
}
