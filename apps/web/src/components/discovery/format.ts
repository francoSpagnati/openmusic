import type { ReleaseType } from '@openmusic/shared';

/** `m:ss` from seconds (player clock). */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** `m:ss` from milliseconds (track durations). */
export function formatTrackDuration(ms: number): string {
  return formatClock(ms / 1000);
}

/** `h:mm:ss` or `m:ss` from seconds (video durations). */
export function formatLongDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const rest = totalSeconds % 3600;
  return h > 0 ? `${h}:${formatClock(rest).padStart(5, '0')}` : formatClock(rest);
}

/** Four-digit year from an ISO date, or null. */
export function releaseYear(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const year = new Date(iso).getUTCFullYear();
  return Number.isNaN(year) ? null : year;
}

const DATE_FORMAT = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

const RELATIVE = new Intl.RelativeTimeFormat('it-IT', { numeric: 'auto' });

/** "3 giorni fa", falling back to a full date after a month. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff)) return '';
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return RELATIVE.format(days, 'day');
  return formatDate(iso);
}

export const RELEASE_TYPE_LABEL: Record<ReleaseType, string> = {
  ALBUM: 'LP',
  EP: 'EP',
  SINGLE: 'Singolo',
};

/** Catalogue-spine eyebrow: "LP · 2007 · Art Rock". */
export function releaseEyebrow(release: {
  releaseType: ReleaseType;
  releaseDate?: string | null;
  genres: string[];
}): string {
  const parts: string[] = [RELEASE_TYPE_LABEL[release.releaseType]];
  const year = releaseYear(release.releaseDate);
  if (year) parts.push(String(year));
  if (release.genres[0]) parts.push(release.genres[0]);
  return parts.join(' · ');
}

/** Italian plural helper: plural(3, 'recensione', 'recensioni'). */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * ADR-001 10..100 rating → 0.5..5 stars. Same maths as `starsFromRating` in the (client-only)
 * RatingStars module, usable from Server Components.
 */
export function ratingToStars(rating: number): number {
  return Math.round(rating / 10) / 2;
}

/** "3,5" (Italian decimal comma). */
export function formatStars(stars: number): string {
  return stars.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
