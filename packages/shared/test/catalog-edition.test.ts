import { describe, expect, it } from 'vitest';
import {
  compareEditions,
  editionMatchKey,
  parseEdition,
  releaseGroupMatchKey,
  releaseYear,
  type EditionFacts,
} from '../src/catalog-edition';
import { CatalogReleaseSchema, ReleaseGroupDetailSchema } from '../src/catalog';

describe('parseEdition', () => {
  it('separates the work title from edition markers and keeps a readable label', () => {
    expect(parseEdition('Abbey Road (Remastered 2009)')).toEqual({
      workTitle: 'Abbey Road',
      baseTitle: 'abbey road',
      tokens: ['2009', 'remaster'],
      label: 'Remastered 2009',
    });
    expect(parseEdition('Bohemian Rhapsody - 2011 Remaster').tokens).toEqual(['2011', 'remaster']);
    expect(parseEdition('Nevermind (Super Deluxe Edition)').label).toBe('Super Deluxe Edition');
    expect(parseEdition('In Rainbows').tokens).toEqual([]);
    expect(parseEdition('In Rainbows').label).toBeNull();
  });

  it('drops credits, store formats and explicit/clean, keeps non-edition qualifiers', () => {
    expect(parseEdition('Get Lucky (feat. Pharrell Williams)').workTitle).toBe('Get Lucky');
    expect(parseEdition('Reckoner - Single').baseTitle).toBe('reckoner');
    expect(parseEdition('Blonde (Explicit)').tokens).toEqual([]);
    expect(parseEdition('In Rainbows (Disk 2)').baseTitle).toBe('in rainbows disk 2');
    expect(parseEdition('(Remastered)').baseTitle).toBe('remastered');
  });

  it('reads edition markers from a MusicBrainz disambiguation, ignoring other comments', () => {
    expect(parseEdition('Abbey Road', '2019 anniversary edition').tokens).toEqual([
      '2019',
      'anniversary',
    ]);
    expect(parseEdition('Abbey Road', '2019 anniversary edition').label).toBe(
      '2019 anniversary edition'
    );
    // Not an edition marker: never part of the merge key, but still the best label available.
    expect(parseEdition('Abbey Road', 'cardboard sleeve').tokens).toEqual([]);
    expect(parseEdition('Abbey Road', 'cardboard sleeve').label).toBe('cardboard sleeve');
  });
});

describe('edition keys', () => {
  it('equal only for the same edition', () => {
    const key = (title: string) => editionMatchKey(title, 'The Beatles');
    expect(key('Abbey Road (2009 Remaster)')).toBe(key('Abbey Road - Remastered 2009'));
    expect(key('Abbey Road (Remastered 2009)')).not.toBe(key('Abbey Road'));
    expect(key('Abbey Road (Remastered 2009)')).not.toBe(key('Abbey Road (Remastered 2019)'));
    expect(key('Abbey Road (Deluxe Edition)')).toBe(key('Abbey Road [Deluxe Version]'));
    expect(key('Abbey Road (Deluxe Edition)')).not.toBe(key('Abbey Road (Super Deluxe Edition)'));
    expect(key('Abbey Road (Live)')).not.toBe(key('Abbey Road'));
    expect(key('Abbey Road (Mono)')).not.toBe(key('Abbey Road (Stereo)'));
    expect(key('Abbey Road (Explicit)')).toBe(key('Abbey Road (Clean)'));
  });

  it('groups every edition under the same work key', () => {
    expect(releaseGroupMatchKey('Abbey Road (Super Deluxe Edition)', 'The Beatles')).toBe(
      releaseGroupMatchKey('Abbey Road', 'Beatles')
    );
  });

  it('never groups another recording with the original (re-recordings, live, versions)', () => {
    const work = (title: string) => releaseGroupMatchKey(title, 'Artist');
    for (const other of [
      "Fearless (Taylor's Version)",
      'Fearless (Taylor’s Version) [Deluxe]',
      'Fearless (Re-Recorded)',
      'Fearless (Live)',
      'Fearless (Live at Wembley)',
      'Fearless - Live at Wembley Stadium',
      'Fearless (Acoustic Version)',
      'Fearless (Instrumental Version)',
      'Fearless (Remix Edition)',
      'Fearless (Sped Up Version)',
      'Fearless (with the London Symphony Orchestra)',
    ]) {
      expect(work(other), other).not.toBe(work('Fearless'));
      expect(editionMatchKey(other, 'Artist'), other).not.toBe(
        editionMatchKey('Fearless', 'Artist')
      );
    }
    // Editions of the re-recording group together, apart from the original.
    expect(work("Fearless (Taylor's Version) [Deluxe]")).toBe(work("Fearless (Taylor's Version)"));
    expect(parseEdition("Fearless (Taylor's Version) [Deluxe]").label).toBe('Deluxe');
  });
});

describe('compareEditions', () => {
  const weezerBlue: EditionFacts = {
    title: 'Weezer',
    artistName: 'Weezer',
    year: 1994,
    trackCount: 10,
  };

  it('same title, different year = different albums (Weezer)', () => {
    expect(compareEditions(weezerBlue, { ...weezerBlue, year: 2001 })).toBe('different');
    expect(compareEditions(weezerBlue, { ...weezerBlue, trackCount: 12 })).toBe('different');
  });

  it('same title, year and track count with no conflicting id = same edition', () => {
    expect(compareEditions(weezerBlue, { ...weezerBlue, deezerId: '1' })).toBe('same-edition');
    expect(compareEditions(weezerBlue, { ...weezerBlue, year: null })).toBe('compatible');
  });

  it('identifiers win, and conflicting identifiers always separate', () => {
    expect(
      compareEditions(
        { ...weezerBlue, upc: '0602498836566' },
        { ...weezerBlue, year: 2001, upc: '602498836566' }
      )
    ).toBe('identical');
    expect(
      compareEditions(
        { ...weezerBlue, upc: '111111111111' },
        { ...weezerBlue, upc: '222222222222' }
      )
    ).toBe('different');
    expect(
      compareEditions({ ...weezerBlue, deezerId: '1' }, { ...weezerBlue, deezerId: '2' })
    ).toBe('different');
    expect(
      compareEditions(
        { ...weezerBlue, musicbrainzId: 'a' },
        { ...weezerBlue, title: 'Something else', musicbrainzId: 'a' }
      )
    ).toBe('identical');
  });

  it('remaster vs original never merge, explicit vs clean may', () => {
    const original = { title: 'Abbey Road', artistName: 'The Beatles', year: 2009, trackCount: 17 };
    expect(compareEditions(original, { ...original, title: 'Abbey Road (Remastered)' })).toBe(
      'different'
    );
    expect(compareEditions(original, { ...original, title: 'Abbey Road (Explicit)' })).toBe(
      'same-edition'
    );
  });
});

describe('releaseYear', () => {
  it('reads years from dates and partial ISO strings', () => {
    expect(releaseYear('1994-05-10')).toBe(1994);
    expect(releaseYear('2001')).toBe(2001);
    expect(releaseYear(new Date('2008-06-03T00:00:00Z'))).toBe(2008);
    expect(releaseYear(null)).toBeNull();
  });
});

describe('edition contracts', () => {
  it('accepts releases with and without group data', () => {
    const base = { id: 'r1', title: 'Weezer', artistName: 'Weezer' };
    expect(CatalogReleaseSchema.parse(base).group).toBeUndefined();
    const parsed = CatalogReleaseSchema.parse({
      ...base,
      editionLabel: 'Deluxe Edition',
      group: { id: 'g1', title: 'Weezer', firstYear: 1994 },
      otherEditions: [],
    });
    expect(parsed.group?.firstYear).toBe(1994);
  });

  it('validates the release group payload', () => {
    const scores = {
      audienceAvg: null,
      audienceFreshPct: null,
      audienceCount: 0,
      criticAvg: null,
      criticFreshPct: null,
      criticCount: 0,
    };
    const group = ReleaseGroupDetailSchema.parse({
      id: 'g1',
      title: 'Weezer',
      artistName: 'Weezer',
      primaryType: 'ALBUM',
      firstYear: 1994,
      coverUrl: null,
      externalIds: { musicbrainz: null },
      scores,
      editions: [],
      editionsSyncing: false,
    });
    expect(group.dominantColor).toBe('#26262B');
  });
});
