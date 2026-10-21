import type { VideoCategory } from '@openmusic/shared';

export const VIDEO_CATEGORIES: Array<{ value: VideoCategory; label: string; plural: string }> = [
  { value: 'ESSAY', label: 'Video-saggio', plural: 'Video-saggi' },
  { value: 'REVIEW', label: 'Video-recensione', plural: 'Recensioni' },
  { value: 'INTERVIEW', label: 'Intervista', plural: 'Interviste' },
  { value: 'LIVE_SESSION', label: 'Live session', plural: 'Live session' },
];

export const CATEGORY_LABEL = Object.fromEntries(
  VIDEO_CATEGORIES.map((c) => [c.value, c.label])
) as Record<VideoCategory, string>;

/** Host shown next to external links ("youtube.com"), or null for a malformed URL. */
export function videoHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^(www|m)\./, '');
  } catch {
    return null;
  }
}

/** YouTube serves a predictable thumbnail; used when the publisher did not provide one. */
export function fallbackThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com')
      id =
        u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? null;
    return id && /^[\w-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}
