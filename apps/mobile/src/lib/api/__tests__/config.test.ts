import { API_URL, resolveApiUrl } from '..';

describe('resolveApiUrl', () => {
  it('resolves a root-relative path against the API base', () => {
    expect(resolveApiUrl('/api/catalog/tracks/abc/preview')).toBe(
      `${API_URL}/api/catalog/tracks/abc/preview`
    );
  });

  it('leaves absolute and protocol-relative URLs untouched', () => {
    expect(resolveApiUrl('https://audio-ssl.itunes.apple.com/a.m4a')).toBe(
      'https://audio-ssl.itunes.apple.com/a.m4a'
    );
    expect(resolveApiUrl('//cdn.test/a.mp3')).toBe('//cdn.test/a.mp3');
  });
});
