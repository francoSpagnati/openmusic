import { isApiError } from '@/lib/api';

/** Name to show for a user: display name when set, otherwise the handle. */
export function displayNameOf(user: { displayName: string | null; username: string }): string {
  return user.displayName?.trim() || user.username;
}

/** Canonical public profile URL (usernames are unique and lowercase). */
export function profileHref(user: { username: string }): string {
  return `/profile/${encodeURIComponent(user.username)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const relativeFormatter = new Intl.RelativeTimeFormat('it', { numeric: 'auto', style: 'short' });
const absoluteFormatter = new Intl.DateTimeFormat('it', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const dayFormatter = new Intl.DateTimeFormat('it', { day: 'numeric', month: 'short' });
const monthYearFormatter = new Intl.DateTimeFormat('it', { month: 'long', year: 'numeric' });
const compactFormatter = new Intl.NumberFormat('it', { notation: 'compact' });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 60 * 60 * 24],
];

/** "3 min fa", "ieri", or a short date after a week. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'adesso';
  if (abs >= 60 * 60 * 24 * 7) return dayFormatter.format(date);
  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  let size = 60;
  for (const [u, s] of UNITS) {
    if (abs >= s) {
      unit = u;
      size = s;
    }
  }
  return relativeFormatter.format(Math.round(seconds / size), unit);
}

export function absoluteTime(iso: string): string {
  return absoluteFormatter.format(new Date(iso));
}

export function monthYear(iso: string): string {
  return monthYearFormatter.format(new Date(iso));
}

export function yearOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const year = new Date(iso).getFullYear();
  return Number.isNaN(year) ? null : String(year);
}

export function compactNumber(value: number): string {
  return compactFormatter.format(value);
}

/**
 * Human message for a failed call. API messages are already written for people (Italian, no
 * codes); network failures get a recovery hint.
 */
export function errorMessage(
  error: unknown,
  fallback = 'Qualcosa è andato storto. Riprova.'
): string {
  if (isApiError(error)) {
    if (error.status === 0)
      return 'Non riusciamo a raggiungere OpenMusic. Controlla la connessione.';
    if (error.code === 'INVALID_RESPONSE' || error.status >= 500) return fallback;
    return error.message || fallback;
  }
  return fallback;
}
