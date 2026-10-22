import { normalizeBarcode, normalizeCatalogArtist, normalizeCatalogText } from './catalog-match';

/**
 * Editions (ADR-012). A release group is the album as a work ("Abbey Road"); a release is one
 * specific edition of it (the 1969 LP, the "2009 Remaster", the "Super Deluxe Edition"). Two
 * provider releases are stored in ONE row only when they are the same edition; remasters,
 * deluxe/expanded/anniversary/live/mono reissues stay separate rows linked to the same group.
 *
 * Edition markers are read from title qualifiers — "(...)", "[...]" and " - ..." suffixes — and
 * from a MusicBrainz disambiguation comment. Explicit/clean are NOT edition markers: the explicit
 * and the clean version of the same edition may share a row (ADR-012).
 */

/** A qualifier is an edition marker when it contains one of these words. */
const EDITION_WORD =
  /\b(?:remaster(?:ed|s)?|deluxe|expanded|anniversary|edition|live|mono|stereo|reissue[ds]?|bonus|version|explicit|clean|super)\b/;

/**
 * Credits are not editions: "(feat. X)" is dropped from the title altogether. "(with X)" is NOT
 * treated as a credit: "Album (with the London Symphony Orchestra)" is another recording.
 */
const FEATURING = /\b(?:feat|ft|featuring)\b/;

/**
 * Qualifiers that name a different RECORDING, not an edition: a live album, a re-recording
 * ("Taylor's Version"), an acoustic/instrumental/remix/sped-up version. MusicBrainz files these
 * as separate release groups, so they stay in the base title and never join the original's
 * group (ADR-012).
 */
const DISTINCT_WORK =
  /\b(?:live|unplugged|acoustic|instrumentals?|remix(?:es|ed)?|re ?recorded|re ?recording|taylors version|sped up|slowed|demos?)\b/;

/** Store-format suffixes (iTunes "Reckoner - Single") are dropped: the release type says it. */
const FORMAT_SUFFIX = /^(?:single|ep|lp|album)$/;

/** Words that do not distinguish editions ("Deluxe" == "Deluxe Edition" == "Deluxe Version"). */
const STOPWORDS = new Set([
  'edition',
  'version',
  'the',
  'a',
  'an',
  'and',
  'explicit',
  'clean',
  'album',
  'lp',
  'cd',
  'digital',
]);

const TOKEN_ALIASES: Record<string, string> = {
  remastered: 'remaster',
  remasters: 'remaster',
  reissued: 'reissue',
  reissues: 'reissue',
  tracks: 'track',
};

export interface EditionInfo {
  /** Display title of the work: the title without edition/credit qualifiers, original casing. */
  workTitle: string;
  /** Normalized title without edition qualifiers: identifies the work (release group). */
  baseTitle: string;
  /** Sorted, de-duplicated normalized edition tokens; empty = the plain/original edition. */
  tokens: string[];
  /** Human label for the edition ("2011 Remaster", "Super Deluxe Edition"), null for plain. */
  label: string | null;
}

interface Segment {
  raw: string;
  normalized: string;
}

function editionTokens(normalized: string): string[] {
  return normalized
    .split(' ')
    .map((word) => TOKEN_ALIASES[word] ?? word)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word));
}

/** Splits "Title (A) [B] - C" into the bare title and its qualifier segments. */
function splitQualifiers(title: string): { bare: string; segments: Segment[] } {
  const segments: Segment[] = [];
  let bare = title.replace(/\s*[([]([^)\]]*)[)\]]/g, (_match, inner: string) => {
    segments.push({ raw: inner.trim(), normalized: normalizeCatalogText(inner) });
    return ' ';
  });
  const dash = /\s+[-–—]\s+([^-–—]+)$/.exec(bare);
  if (dash?.[1]) {
    const normalized = normalizeCatalogText(dash[1]);
    // Only short suffixes that look like qualifiers: "Song - Live at X" is part of a title.
    if (
      FORMAT_SUFFIX.test(normalized) ||
      (EDITION_WORD.test(normalized) &&
        !DISTINCT_WORK.test(normalized) &&
        normalized.split(' ').length <= 6)
    ) {
      segments.push({ raw: dash[1].trim(), normalized });
      bare = bare.slice(0, dash.index);
    }
  }
  return { bare, segments };
}

/**
 * Parses a title (and optionally a MusicBrainz disambiguation) into its work title and edition
 * markers. Qualifiers that are neither credits nor edition markers ("(Disk 2)", "(OKNOTOK)"), and
 * those that name another recording ("(Live)", "(Taylor's Version)"), stay in the base title, so
 * they keep distinct works apart.
 */
export function parseEdition(title: string, disambiguation?: string | null): EditionInfo {
  const { bare, segments } = splitQualifiers(title);
  const kept: string[] = [bare];
  const keptRaw: string[] = [bare.trim()];
  const tokens = new Set<string>();
  const labels: string[] = [];

  for (const segment of segments) {
    if (FORMAT_SUFFIX.test(segment.normalized)) continue;
    if (FEATURING.test(segment.normalized) && !EDITION_WORD.test(segment.normalized)) continue;
    if (!EDITION_WORD.test(segment.normalized) || DISTINCT_WORK.test(segment.normalized)) {
      kept.push(segment.raw);
      keptRaw.push(`(${segment.raw})`);
      continue;
    }
    const words = editionTokens(segment.normalized);
    for (const word of words) tokens.add(word);
    if (words.length > 0) labels.push(segment.raw);
  }

  if (disambiguation) {
    const normalized = normalizeCatalogText(disambiguation);
    if (EDITION_WORD.test(normalized)) {
      const words = editionTokens(normalized);
      for (const word of words) tokens.add(word);
      if (words.length > 0 && labels.length === 0) labels.push(disambiguation.trim());
    }
    // MusicBrainz writes a disambiguation precisely to tell editions apart ("discbox",
    // "cardboard sleeve"): shown as the label even when it is not an edition marker.
    if (labels.length === 0 && disambiguation.trim().length > 0) labels.push(disambiguation.trim());
  }

  const baseTitle = normalizeCatalogText(kept.join(' '));
  const workTitle = keptRaw.join(' ').replace(/\s+/g, ' ').trim();
  return {
    workTitle: workTitle.length > 0 && baseTitle.length > 0 ? workTitle : title.trim(),
    // A title made only of a qualifier ("(Remastered)") must not collapse to an empty key.
    baseTitle: baseTitle.length > 0 ? baseTitle : normalizeCatalogText(title),
    tokens: [...tokens].sort(),
    label: labels.length > 0 ? labels.join(' · ') : null,
  };
}

/** `"<artist>|<base title>"`: the key of the work, used to link editions to a release group. */
export function releaseGroupMatchKey(title: string, artistName: string): string {
  return `${normalizeCatalogArtist(artistName)}|${parseEdition(title).baseTitle}`;
}

/**
 * `"<artist>|<base title>#<edition tokens>"`: equal only for the same edition. Explicit/clean do
 * not count; "2009 Remaster" == "Remastered 2009"; "Deluxe" != "Super Deluxe".
 */
export function editionMatchKey(
  title: string,
  artistName: string,
  disambiguation?: string | null
): string {
  const info = parseEdition(title, disambiguation);
  return `${normalizeCatalogArtist(artistName)}|${info.baseTitle}#${info.tokens.join(' ')}`;
}

/** Facts about one edition, from a provider result or a stored row. */
export interface EditionFacts {
  title: string;
  artistName: string;
  disambiguation?: string | null;
  upc?: string | null;
  musicbrainzId?: string | null;
  musicbrainzReleaseGroupId?: string | null;
  deezerId?: string | null;
  itunesId?: string | null;
  year?: number | null;
  trackCount?: number | null;
}

/**
 * - `identical`: a shared identifier (provider id, barcode, MusicBrainz release id).
 * - `same-edition`: no shared id, but same artist, same title including edition markers, same
 *   year and same track count, and no conflicting identifier.
 * - `compatible`: like `same-edition` but the year or the track count is unknown on one side;
 *   callers merge it only when it is unambiguous (a single candidate).
 * - `different`: anything else.
 */
export type EditionComparison = 'identical' | 'same-edition' | 'compatible' | 'different';

function bothKnownAndDiffer<T>(a: T | null | undefined, b: T | null | undefined): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && a !== b;
}

function bothKnownAndEqual<T>(a: T | null | undefined, b: T | null | undefined): boolean {
  return a !== null && a !== undefined && a === b;
}

export function compareEditions(a: EditionFacts, b: EditionFacts): EditionComparison {
  const upcA = normalizeBarcode(a.upc);
  const upcB = normalizeBarcode(b.upc);
  if (
    bothKnownAndEqual(a.deezerId, b.deezerId) ||
    bothKnownAndEqual(a.itunesId, b.itunesId) ||
    bothKnownAndEqual(a.musicbrainzId, b.musicbrainzId) ||
    bothKnownAndEqual(upcA, upcB)
  ) {
    return 'identical';
  }
  if (
    bothKnownAndDiffer(upcA, upcB) ||
    bothKnownAndDiffer(a.musicbrainzId, b.musicbrainzId) ||
    bothKnownAndDiffer(a.deezerId, b.deezerId) ||
    bothKnownAndDiffer(a.itunesId, b.itunesId) ||
    bothKnownAndDiffer(a.musicbrainzReleaseGroupId, b.musicbrainzReleaseGroupId) ||
    bothKnownAndDiffer(a.year, b.year) ||
    bothKnownAndDiffer(a.trackCount, b.trackCount)
  ) {
    return 'different';
  }
  if (
    editionMatchKey(a.title, a.artistName, a.disambiguation) !==
    editionMatchKey(b.title, b.artistName, b.disambiguation)
  ) {
    return 'different';
  }
  const complete = (f: EditionFacts) =>
    f.year !== null && f.year !== undefined && f.trackCount !== null && f.trackCount !== undefined;
  return complete(a) && complete(b) ? 'same-edition' : 'compatible';
}

/** UTC year of a date (or of an ISO `YYYY[-MM[-DD]]` string); null when unknown. */
export function releaseYear(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getUTCFullYear();
  }
  const match = /^(\d{4})/.exec(value);
  return match?.[1] ? Number(match[1]) : null;
}
