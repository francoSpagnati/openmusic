/**
 * "adesso", "5 min fa", "3 h fa", "2 g fa", else a short date. Hand-rolled because Hermes does not
 * ship `Intl.RelativeTimeFormat` on every platform.
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'adesso';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min fa`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h fa`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} g fa`;
  const d = new Date(then);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** 215000 -> "3:35" */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
