import { z } from 'zod';
import type { UpstreamClient } from '../../../lib/upstream';
import { httpsUrl } from './shared';
import { isMbid } from './musicbrainz.provider';

/**
 * Cover Art Archive (https://musicbrainz.org/doc/Cover_Art_Archive/API): artwork keyed by
 * MusicBrainz release / release-group MBID. `GET /release/{mbid}` returns the image list (404 when
 * there is none); thumbnails come in 250/500/1200 px.
 */
export const COVER_ART_ARCHIVE_API = 'https://coverartarchive.org';

const ImageListSchema = z.object({
  images: z.array(
    z.object({
      front: z.boolean().nullish(),
      types: z.array(z.string()).nullish(),
      image: z.string(),
      thumbnails: z
        .object({
          '250': z.string().nullish(),
          '500': z.string().nullish(),
          '1200': z.string().nullish(),
          small: z.string().nullish(),
          large: z.string().nullish(),
        })
        .nullish(),
    })
  ),
});

export interface CoverArt {
  /** Large image for display (1200 px thumbnail, else the original). */
  url: string;
  /** Small JPEG for the dominant-color sampler. */
  thumbnailUrl: string | null;
}

export class CoverArtArchiveProvider {
  constructor(private readonly http: UpstreamClient) {}

  async getFrontCover(
    mbid: string,
    kind: 'release' | 'release-group' = 'release'
  ): Promise<CoverArt | null> {
    if (!isMbid(mbid)) return null;
    const body = await this.http.getJson(
      `${COVER_ART_ARCHIVE_API}/${kind}/${mbid}`,
      ImageListSchema,
      {
        ttlSeconds: 7 * 24 * 3600,
        notFoundTtlSeconds: 24 * 3600,
      }
    );
    if (!body) return null;
    const front =
      body.images.find((img) => img.front === true) ??
      body.images.find((img) => img.types?.includes('Front'));
    if (!front) return null;
    const url = httpsUrl(front.thumbnails?.['1200']) ?? httpsUrl(front.image);
    if (!url) return null;
    return {
      url,
      thumbnailUrl: httpsUrl(front.thumbnails?.['250']) ?? httpsUrl(front.thumbnails?.small),
    };
  }
}
