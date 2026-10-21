import type { AudioPreviewResult } from '@openmusic/shared';
import type { CatalogProviders } from './providers';

const NONE: AudioPreviewResult = { previewUrl: null, source: 'NONE', durationSeconds: 30 };

export class AudioPreviewResolverService {
  constructor(
    private readonly providers: Pick<CatalogProviders, 'deezer' | 'itunes'>,
    /** CATALOG_EXTERNAL_ENABLED: when false no preview is looked up (no outbound calls). */
    private readonly options: { externalEnabled: boolean } = { externalEnabled: true }
  ) {}

  /**
   * ADR-003: Risolutore a cascata per anteprime audio da 30s.
   * 1. Deezer (per ISRC se presente, altrimenti ricerca "artist + track") -> MP3 30s
   * 2. Fallback su iTunes Search API -> AAC 30s
   * Le risposte passano dalla cache Redis e dal rate limiting dei provider.
   */
  async resolvePreview(title: string, artist: string, isrc?: string): Promise<AudioPreviewResult> {
    if (!this.options.externalEnabled) return NONE;
    try {
      const byIsrc = isrc ? await this.providers.deezer.getTrackByIsrc(isrc) : null;
      const track =
        byIsrc ??
        (
          await this.providers.deezer.searchTracks(`artist:"${artist}" track:"${title}"`, {
            limit: 1,
            offset: 0,
          })
        ).items[0];
      if (track?.previewUrl) {
        return { previewUrl: track.previewUrl, source: 'DEEZER', durationSeconds: 30 };
      }
    } catch {
      // Fallback successivo
    }

    try {
      const [song] = (await this.providers.itunes.searchTracks(`${artist} ${title}`, 1)).items;
      if (song?.previewUrl) {
        return { previewUrl: song.previewUrl, source: 'ITUNES', durationSeconds: 30 };
      }
    } catch {
      // Nessuna anteprima disponibile
    }

    return NONE;
  }
}
