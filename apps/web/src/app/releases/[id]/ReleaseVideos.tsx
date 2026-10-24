import React from 'react';
import type { MusicVideoItem } from '@openmusic/shared';
import { VideoCard } from '../../videos/VideoCard';

/** Video essays and interviews linked to this release; hidden when there are none. */
export function ReleaseVideos({ videos }: { videos: MusicVideoItem[] }) {
  if (videos.length === 0) return null;
  return (
    <section aria-labelledby="release-videos-heading" className="space-y-6">
      <h2 id="release-videos-heading" className="om-headline text-3xl text-fg">
        Approfondimenti video
      </h2>
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
        {videos.map((video) => (
          <li key={video.id}>
            <VideoCard video={video} showReleaseLink={false} />
          </li>
        ))}
      </ul>
    </section>
  );
}
