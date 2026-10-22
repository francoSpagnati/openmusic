import { parseEdition, type CatalogRelease } from '@openmusic/shared';

/**
 * Editions (ADR-012) as the UI shows them. A release is one edition of a release group (the album
 * as a work); `editionLabel === null` means the plain edition or one with no edition marker.
 */

/** Chip text for an edition: its label, or "Edizione standard" for the plain one. */
export function editionName(label: string | null | undefined): string {
  return label ?? 'Edizione standard';
}

/**
 * Title without edition qualifiers when the edition label is shown next to it, so "Random Access
 * Memories (10th Anniversary Edition)" is not followed by a chip that says the same thing.
 */
export function workTitle(release: Pick<CatalogRelease, 'title' | 'editionLabel'>): string {
  if (!release.editionLabel) return release.title;
  return parseEdition(release.title).workTitle || release.title;
}

// MusicBrainz pseudo-countries: worldwide, Europe, unknown.
const SPECIAL_COUNTRIES: Record<string, string | null> = { XW: 'Mondo', XE: 'Europa', XU: null };

let regionNames: Intl.DisplayNames | null | undefined;

/** "IT" → "Italia", "XW" → "Mondo"; null for unknown or malformed codes. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (upper in SPECIAL_COUNTRIES) return SPECIAL_COUNTRIES[upper] ?? null;
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['it-IT'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(upper) ?? upper;
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

export interface GroupedRelease {
  /** The best-ranked edition of the work in the list (the one the API ranked first). */
  release: CatalogRelease;
  /** Every edition of the same work in the list, `release` included, in list order. */
  editions: CatalogRelease[];
}

/**
 * Folds editions of the same work into one entry (search results), keeping the API ranking: the
 * entry sits where its first edition was. Releases without a group stay on their own.
 */
export function groupEditions(releases: readonly CatalogRelease[]): GroupedRelease[] {
  const out: GroupedRelease[] = [];
  const byGroup = new Map<string, GroupedRelease>();
  for (const release of releases) {
    const groupId = release.group?.id;
    const existing = groupId ? byGroup.get(groupId) : undefined;
    if (existing) {
      existing.editions.push(release);
      continue;
    }
    const entry: GroupedRelease = { release, editions: [release] };
    out.push(entry);
    if (groupId) byGroup.set(groupId, entry);
  }
  return out;
}
