/**
 * Normalization used to recognise the same release / recording across databases (Deezer, iTunes,
 * MusicBrainz, the local seed) when no shared identifier (ISRC, UPC, MBID) is available.
 *
 * Deliberately conservative: it removes only edition qualifiers that never change the musical
 * content ("Remastered 2011", "Deluxe Edition", "Explicit"), so "OK Computer" and
 * "OK Computer OKNOTOK 1997 2017" stay distinct.
 */

const EDITION_QUALIFIER =
  /\s*[([](?:[^)\]]*\b(?:remaster(?:ed)?|deluxe|expanded|edition|explicit|clean|bonus track|anniversary|version|mono|stereo|feat|ft|featuring)\b[^)\]]*)[)\]]/gi;

const DASH_QUALIFIER =
  /\s+-\s+(?:\d{4}\s+)?(?:remaster(?:ed)?(?:\s+\d{4})?|single|ep|deluxe(?:\s+edition)?|explicit)\s*$/i;

/** Lowercase, accent-free, punctuation-free text with single spaces. */
export function normalizeCatalogText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Title without edition qualifiers ("In Rainbows (Deluxe Edition)" -> "in rainbows"). */
export function normalizeCatalogTitle(title: string): string {
  const stripped = title.replace(EDITION_QUALIFIER, '').replace(DASH_QUALIFIER, '');
  const normalized = normalizeCatalogText(stripped);
  // A title made only of a qualifier ("(Remastered)") must not collapse to an empty key.
  return normalized.length > 0 ? normalized : normalizeCatalogText(title);
}

/** Primary artist only: "Daft Punk feat. Pharrell Williams" -> "daft punk". */
export function normalizeCatalogArtist(artist: string): string {
  // Commas are not separators: "Tyler, The Creator", "Earth, Wind & Fire".
  const primary = artist.split(/\s+[([]?(?:feat\.?|ft\.?|featuring)\s+/i)[0] ?? artist;
  const normalized = normalizeCatalogText(primary).replace(/^the /, '');
  return normalized.length > 0 ? normalized : normalizeCatalogText(artist);
}

/** Dedupe key for a release or a recording: `"<artist>|<title>"`. */
export function catalogMatchKey(title: string, artistName: string): string {
  return `${normalizeCatalogArtist(artistName)}|${normalizeCatalogTitle(title)}`;
}

/** ISRC in canonical form (uppercase, no dashes/spaces) or null when malformed. */
export function normalizeIsrc(value: string | null | undefined): string | null {
  if (!value) return null;
  const isrc = value.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : null;
}

/**
 * UPC/EAN barcode without leading zeros padding differences: Deezer returns 12-13 digit UPCs,
 * MusicBrainz EAN-13 with a leading 0 for UPC-A. Comparison uses the value without leading zeros.
 */
export function normalizeBarcode(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  const trimmed = digits.replace(/^0+/, '');
  return trimmed.length > 0 ? trimmed : null;
}
