import { describe, expect, it } from 'vitest';
import { AudioPreviewResultSchema, CatalogReleaseSchema } from '../src/catalog';

describe('CatalogReleaseSchema', () => {
  const base = { id: 'r1', title: 'In Rainbows', artistName: 'Radiohead' };

  it('applies ADR-001 defaults for missing aggregates', () => {
    const parsed = CatalogReleaseSchema.parse(base);
    expect(parsed.releaseType).toBe('ALBUM');
    expect(parsed.dominantColor).toBe('#26262B');
    expect(parsed.genres).toEqual([]);
    expect(parsed.audienceCount).toBe(0);
    expect(parsed.criticCount).toBe(0);
  });

  it('rejects malformed dominant colors', () => {
    expect(CatalogReleaseSchema.safeParse({ ...base, dominantColor: 'orange' }).success).toBe(
      false
    );
    expect(CatalogReleaseSchema.safeParse({ ...base, dominantColor: '#D97736' }).success).toBe(
      true
    );
  });

  it('bounds fresh percentages to 0..100', () => {
    expect(CatalogReleaseSchema.safeParse({ ...base, audienceFreshPct: 101 }).success).toBe(false);
    expect(CatalogReleaseSchema.safeParse({ ...base, criticFreshPct: -1 }).success).toBe(false);
  });
});

describe('AudioPreviewResultSchema', () => {
  it('defaults preview duration to 30 seconds', () => {
    const parsed = AudioPreviewResultSchema.parse({ previewUrl: null, source: 'NONE' });
    expect(parsed.durationSeconds).toBe(30);
  });
});
