import type { AudioPreviewResult } from '@openmusic/shared';
import { upstreamFetch } from '../../lib/upstream';

export class AudioPreviewResolverService {
  /**
   * ADR-003: Risolutore a cascata per anteprime audio da 30s.
   * 1. Cerca su Deezer API (tramite ISRC se presente, oppure "artist track") -> MP3 30s gratuito
   * 2. Fallback su Apple Music / iTunes Search API -> AAC 30s gratuito
   */
  async resolvePreview(title: string, artist: string, isrc?: string): Promise<AudioPreviewResult> {
    // 1. Tentativo con Deezer API
    try {
      const deezerUrl = isrc
        ? `https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`
        : `https://api.deezer.com/search?q=${encodeURIComponent(`artist:"${artist}" track:"${title}"`)}&limit=1`;

      const response = await upstreamFetch(deezerUrl, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          preview?: string;
          data?: Array<{ preview?: string }>;
        };

        const preview = isrc ? data.preview : data.data?.[0]?.preview;

        if (preview && typeof preview === 'string' && preview.startsWith('http')) {
          return {
            previewUrl: preview,
            source: 'DEEZER',
            durationSeconds: 30,
          };
        }
      }
    } catch {
      // Ignora e passa al fallback successivo
    }

    // 2. Fallback con iTunes Search API
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        `${artist} ${title}`
      )}&entity=song&limit=1`;

      const response = await upstreamFetch(itunesUrl, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          resultCount: number;
          results?: Array<{ previewUrl?: string }>;
        };

        const itunesPreview = data.results?.[0]?.previewUrl;
        if (
          itunesPreview &&
          typeof itunesPreview === 'string' &&
          itunesPreview.startsWith('http')
        ) {
          return {
            previewUrl: itunesPreview,
            source: 'ITUNES',
            durationSeconds: 30,
          };
        }
      }
    } catch {
      // Fallback terminato senza successo
    }

    return {
      previewUrl: null,
      source: 'NONE',
      durationSeconds: 30,
    };
  }
}
