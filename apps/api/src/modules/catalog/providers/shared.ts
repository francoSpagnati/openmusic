import type { ReleaseType } from '@openmusic/shared';

/** Upgrades `http://` artwork links (Cover Art Archive still returns some) to https. */
export function httpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('https://')) return value;
  if (value.startsWith('http://')) return `https://${value.slice('http://'.length)}`;
  return null;
}

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (MusicBrainz partial dates); anything else becomes null. */
export function isoDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value);
  if (!match || match[1] === '0000') return null;
  return [match[1], match[2], match[3]].filter(Boolean).join('-');
}

/** Title Case for genre tags ("alternative rock" -> "Alternative Rock", keeps "R&B", "IDM"). */
export function genreLabel(tag: string): string {
  return tag
    .trim()
    .split(/\s+/)
    .map((word) =>
      word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

export function releaseTypeFrom(value: string | null | undefined): ReleaseType {
  switch ((value ?? '').toLowerCase()) {
    case 'single':
      return 'SINGLE';
    case 'ep':
      return 'EP';
    default:
      return 'ALBUM';
  }
}

/** Escapes a value for a quoted Lucene phrase (MusicBrainz search syntax). */
export function lucenePhrase(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`;
}
