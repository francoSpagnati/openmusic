import { describe, expect, it } from 'vitest';
import {
  catalogMatchKey,
  normalizeBarcode,
  normalizeCatalogTitle,
  normalizeIsrc,
} from '../src/catalog-match';
import { CatalogResolveQuerySchema, CatalogSearchQuerySchema } from '../src/catalog';

describe('catalogMatchKey', () => {
  it('ignores case, accents, curly quotes and edition qualifiers', () => {
    expect(catalogMatchKey('Wesley’s Theory', 'Kendrick Lamar')).toBe(
      catalogMatchKey("Wesley's Theory", 'kendrick lamar')
    );
    expect(catalogMatchKey('Non è per sempre', 'Afterhours')).toBe('afterhours|non e per sempre');
    expect(catalogMatchKey('In Rainbows (Deluxe Edition)', 'Radiohead')).toBe(
      catalogMatchKey('In Rainbows', 'Radiohead')
    );
    expect(normalizeCatalogTitle('Abbey Road (Remastered 2019)')).toBe('abbey road');
    expect(normalizeCatalogTitle('Bohemian Rhapsody - Remastered 2011')).toBe('bohemian rhapsody');
    expect(normalizeCatalogTitle('Blonde - Single')).toBe('blonde');
    expect(normalizeCatalogTitle('Get Lucky (feat. Pharrell Williams)')).toBe('get lucky');
  });

  it('keeps titles that only differ by real content distinct', () => {
    expect(catalogMatchKey('OK Computer', 'Radiohead')).not.toBe(
      catalogMatchKey('OK Computer OKNOTOK 1997 2017', 'Radiohead')
    );
  });

  it('uses the primary artist and drops a leading "The"', () => {
    expect(catalogMatchKey('Get Lucky', 'Daft Punk feat. Pharrell Williams')).toBe(
      catalogMatchKey('Get Lucky', 'Daft Punk')
    );
    expect(catalogMatchKey('Abbey Road', 'The Beatles')).toBe(
      catalogMatchKey('Abbey Road', 'Beatles')
    );
  });

  it('never collapses a qualifier-only title to an empty key', () => {
    expect(normalizeCatalogTitle('(Remastered)')).toBe('remastered');
  });
});

describe('identifier normalization', () => {
  it('canonicalizes ISRCs and rejects malformed ones', () => {
    expect(normalizeIsrc('gb-sxx-07-00113')).toBe('GBSXX0700113');
    expect(normalizeIsrc('nope')).toBeNull();
    expect(normalizeIsrc(null)).toBeNull();
  });

  it('compares UPC-A and EAN-13 barcodes equally', () => {
    expect(normalizeBarcode('0634904032463')).toBe(normalizeBarcode('634904032463'));
    expect(normalizeBarcode('12')).toBeNull();
  });
});

describe('catalog query schemas', () => {
  it('applies search defaults and parses the external flag', () => {
    expect(CatalogSearchQuerySchema.parse({ q: ' radiohead ' })).toEqual({
      q: 'radiohead',
      type: 'all',
      page: 1,
      limit: 10,
      external: true,
    });
    expect(CatalogSearchQuerySchema.parse({ q: 'x', external: 'false' }).external).toBe(false);
    expect(CatalogSearchQuerySchema.safeParse({ q: 'x', limit: '100' }).success).toBe(false);
  });

  it('validates resolve ids', () => {
    expect(CatalogResolveQuerySchema.parse({ provider: 'deezer', id: '302127' }).type).toBe(
      'release'
    );
    expect(CatalogResolveQuerySchema.safeParse({ provider: 'deezer', id: '../x' }).success).toBe(
      false
    );
    expect(CatalogResolveQuerySchema.safeParse({ provider: 'spotify', id: '1' }).success).toBe(
      false
    );
  });
});
