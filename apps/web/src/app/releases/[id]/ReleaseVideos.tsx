import React from 'react';
import { VideoCamera } from '@phosphor-icons/react/dist/ssr';
import type { MusicVideoItem } from '@openmusic/shared';
import { VideoCard } from '../../videos/VideoCard';

/** Video essays and interviews linked to this release; hidden when there are none. */
export function ReleaseVideos({ videos }: { videos: MusicVideoItem[] }) {
  if (videos.length === 0) return null;
  return (
    <section aria-labelledby="release-videos-heading" className="space-y-4">
      <h2
        id="release-videos-heading"
        className="om-headline flex items-center gap-2 text-2xl text-ink"
      >
        <VideoCamera aria-hidden="true" weight="duotone" className="h-6 w-6 text-accent" />
        Approfondimenti video
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {videos.map((video) => (
          <li key={video.id}>
            <VideoCard video={video} showReleaseLink={false} />
          </li>
        ))}
      </ul>
    </section>
  );
}
