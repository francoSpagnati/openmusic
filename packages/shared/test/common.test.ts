import { describe, expect, it } from 'vitest';
import { HttpUrlSchema, VibeTagsSchema } from '../src';

describe('HttpUrlSchema', () => {
  it('accepts http(s) links', () => {
    expect(HttpUrlSchema.parse(' https://example.com/a?b=1 ')).toBe('https://example.com/a?b=1');
    expect(HttpUrlSchema.safeParse('http://example.com').success).toBe(true);
  });

  it.each([
    'javascript:alert(1)//',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'ftp://example.com/file',
    'not a url',
  ])('rejects %s', (url) => {
    expect(HttpUrlSchema.safeParse(url).success).toBe(false);
  });
});

describe('VibeTagsSchema', () => {
  it('strips leading # and whitespace and rejects empty tags', () => {
    expect(VibeTagsSchema.parse(['#Notturno', ' ##Pioggia ', 'Estate'])).toEqual([
      'Notturno',
      'Pioggia',
      'Estate',
    ]);
    expect(VibeTagsSchema.safeParse(['#']).success).toBe(false);
    expect(VibeTagsSchema.parse(undefined)).toEqual([]);
  });
});
