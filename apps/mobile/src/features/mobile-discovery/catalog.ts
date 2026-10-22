import { parseEdition } from '@openmusic/shared';
import type { CatalogRelease, CatalogSource, CatalogTrack } from '@openmusic/shared';

/** Human name of a catalog source, for badges ("da Deezer"). */
export function sourceLabel(source: CatalogSource): string {
  switch (source) {
    case 'LOCAL':
      return 'OpenMusic';
    case 'DEEZER':
      return 'Deezer';
    case 'ITUNES':
      return 'iTunes';
    case 'MUSICBRAINZ':
      return 'MusicBrainz';
    case 'COVER_ART_ARCHIVE':
      return 'Cover Art Archive';
  }
}

/**
 * Appends a search page, dropping items already shown: pages are independent on the API side and
 * an item imported on page 1 can come back on page 2 (see `SearchResultSchema`).
 */
export function mergeById<T extends { id: string }>(prev: readonly T[], next: readonly T[]): T[] {
  const seen = new Set(prev.map((item) => item.id));
  const out = prev.slice();
  for (const item of next) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** "ALBUM · 1997 · Parlophone" */
export function releaseMeta(
  release: Pick<CatalogRelease, 'releaseType' | 'releaseDate' | 'label'>
): string {
  const type =
    release.releaseType === 'ALBUM' ? 'Album' : release.releaseType === 'EP' ? 'EP' : 'Singolo';
  return [type, release.releaseDate?.slice(0, 4), release.label].filter(Boolean).join(' · ');
}

export interface Side {
  name: 'A' | 'B';
  tracks: CatalogTrack[];
  durationMs: number;
}

/**
 * Splits a tracklist into vinyl sides A and B. Multi-disc releases keep disc boundaries (disc 1 =
 * side A, the rest = side B); otherwise the cut is the track boundary closest to half the running
 * time, as on a pressed LP. Releases with one track (singles) have only side A.
 */
export function splitSides(tracks: readonly CatalogTrack[]): Side[] {
  const ordered = tracks
    .map((track, index) => ({ track, index }))
    .sort(
      (a, b) =>
        (a.track.discNumber ?? 1) - (b.track.discNumber ?? 1) ||
        (a.track.trackNumber ?? a.index + 1) - (b.track.trackNumber ?? b.index + 1)
    )
    .map((entry) => entry.track);
  if (ordered.length === 0) return [];
  const total = (list: CatalogTrack[]) => list.reduce((sum, t) => sum + t.durationMs, 0);
  if (ordered.length === 1) return [{ name: 'A', tracks: ordered, durationMs: total(ordered) }];

  const discs = new Set(ordered.map((t) => t.discNumber ?? 1));
  let cut: number;
  if (discs.size > 1) {
    const firstDisc = ordered[0]?.discNumber ?? 1;
    cut = ordered.findIndex((t) => (t.discNumber ?? 1) !== firstDisc);
  } else {
    const half = total(ordered) / 2;
    let running = 0;
    let best = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < ordered.length - 1; i++) {
      running += ordered[i]?.durationMs ?? 0;
      const distance = Math.abs(running - half);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i + 1;
      }
    }
    cut = best;
  }
  const a = ordered.slice(0, cut);
  const b = ordered.slice(cut);
  return [
    { name: 'A', tracks: a, durationMs: total(a) },
    { name: 'B', tracks: b, durationMs: total(b) },
  ];
}

/** 2_712_000 → "45 min", 4_000_000 → "1 h 6 min" */
export function formatRunningTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Relative luminance (WCAG) of `#RRGGBB`. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (offset: number) => {
    const c = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * How strongly to tint a header with the cover's dominant colour: dark colours can be strong on
 * the dark theme; very light ones are toned down so text on top keeps its contrast.
 */
export function tintAlpha(hex: string, scheme: 'dark' | 'light'): number {
  const l = luminance(hex);
  if (scheme === 'dark') return l > 0.5 ? 0.28 : l > 0.2 ? 0.42 : 0.6;
  return l < 0.1 ? 0.18 : 0.3;
}

/** "#Notturno, malinconico  pioggia" → ["Notturno", "malinconico", "pioggia"] (max 5, deduped). */
export function parseVibeTags(input: string, max = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.split(/[,\s]+/)) {
    const tag = raw.replace(/^#+/, '').trim().slice(0, 30);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length === max) break;
  }
  return out;
}

// -- Editions (ADR-012) -------------------------------------------------------------------------
// A release is one edition of a release group (the album as a work). `editionLabel === null`
// means the plain edition or one with no edition marker.

/** Chip text for an edition: its label, or "Edizione standard" for the plain one. */
export function editionName(label: string | null | undefined): string {
  return label ?? 'Edizione standard';
}

/** Title without edition qualifiers when the edition chip sits next to it. */
export function workTitle(release: Pick<CatalogRelease, 'title' | 'editionLabel'>): string {
  if (!release.editionLabel) return release.title;
  return parseEdition(release.title).workTitle || release.title;
}

// MusicBrainz pseudo-countries: worldwide, Europe, unknown.
const SPECIAL_COUNTRIES: Record<string, string | null> = { XW: 'Mondo', XE: 'Europa', XU: null };

/** "IT" → "Italia" where the JS engine has Intl.DisplayNames, else the code; "XW" → "Mondo". */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (upper in SPECIAL_COUNTRIES) return SPECIAL_COUNTRIES[upper] ?? null;
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  try {
    return new Intl.DisplayNames(['it-IT'], { type: 'region' }).of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/** MusicBrainz medium formats in Italian: "Digital Media" → "Digitale", '12" Vinyl' → 'Vinile 12"'. */
export function formatName(format: string | null | undefined): string | null {
  if (!format) return null;
  const vinyl = /^(\d{1,2}")\s*Vinyl$/i.exec(format);
  if (vinyl) return `Vinile ${vinyl[1]}`;
  const known: Record<string, string> = {
    'digital media': 'Digitale',
    vinyl: 'Vinile',
    cassette: 'Cassetta',
  };
  return known[format.toLowerCase()] ?? format;
}

/** Facts that tell editions apart, in catalogue-spine order: year, format, country, label. */
export function editionFacts(edition: {
  year?: number | null;
  format?: string | null;
  country?: string | null;
  label?: string | null;
}): string[] {
  return [
    edition.year ? String(edition.year) : null,
    formatName(edition.format),
    countryName(edition.country),
    edition.label ?? null,
  ].filter((part): part is string => Boolean(part));
}

/**
 * Folds editions of the same work into one entry (search results), keeping the API ranking: the
 * entry sits where its first edition was. Releases without a group stay on their own.
 */
export function groupEditions(
  releases: readonly CatalogRelease[]
): Array<{ release: CatalogRelease; editionCount: number }> {
  const out: Array<{ release: CatalogRelease; editionCount: number }> = [];
  const byGroup = new Map<string, { release: CatalogRelease; editionCount: number }>();
  for (const release of releases) {
    const groupId = release.group?.id;
    const existing = groupId ? byGroup.get(groupId) : undefined;
    if (existing) {
      existing.editionCount += 1;
      continue;
    }
    const entry = { release, editionCount: 1 };
    out.push(entry);
    if (groupId) byGroup.set(groupId, entry);
  }
  return out;
}
