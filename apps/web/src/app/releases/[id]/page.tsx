import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CatalogRelease, DualScoreDetails } from '@openmusic/shared';
import { api } from '../../../lib/api';
import { DiscoveryShell } from '../../../components/discovery/DiscoveryShell';
import { CommunityReviews } from './CommunityReviews';
import { CriticReviews } from './CriticReviews';
import { ReleaseHero } from './ReleaseHero';
import { ReleaseScoreProvider } from './ReleaseScoreContext';
import { ReleaseTracklistClient } from './ReleaseTracklistClient';
import { ReleaseVideos } from './ReleaseVideos';
import { getRelease, settled } from './data';

interface Props {
  params: { id: string };
}

// Scores and reviews change constantly; render on every request.
export const dynamic = 'force-dynamic';

function scoreOf(release: CatalogRelease): DualScoreDetails {
  return {
    releaseId: release.id,
    audienceAvg: release.audienceAvg ?? null,
    audienceFreshPct: release.audienceFreshPct ?? null,
    audienceCount: release.audienceCount,
    criticAvg: release.criticAvg ?? null,
    criticFreshPct: release.criticFreshPct ?? null,
    criticCount: release.criticCount,
  };
}

function scoreSentence(release: CatalogRelease): string {
  const parts: string[] = [];
  if (release.criticCount > 0 && release.criticFreshPct != null) {
    parts.push(`critica ${release.criticFreshPct}%`);
  }
  if (release.audienceCount > 0 && release.audienceFreshPct != null) {
    parts.push(`pubblico ${release.audienceFreshPct}%`);
  }
  return parts.length > 0 ? `Voto ${parts.join(', ')}. ` : '';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const release = await getRelease(params.id);
  // Throwing here (before streaming starts) makes unknown ids answer with a real 404 status.
  if (!release) notFound();
  const title = `${release.title} di ${release.artistName}`;
  const description = `${scoreSentence(release)}Recensioni della critica accreditata e del pubblico, tracklist e anteprime di 30 secondi di ${release.title}.`;
  return {
    title,
    description,
    alternates: { canonical: `/releases/${release.id}` },
    openGraph: {
      title,
      description,
      type: 'music.album',
      images: release.coverUrl
        ? [{ url: release.coverUrl, alt: `Copertina di ${release.title}` }]
        : [],
    },
  };
}

/** schema.org MusicAlbum with the audience rating, for rich results. */
function jsonLd(release: CatalogRelease): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: release.title,
    byArtist: { '@type': 'MusicGroup', name: release.artistName },
    genre: release.genres,
    ...(release.coverUrl ? { image: release.coverUrl } : {}),
    ...(release.releaseDate ? { datePublished: release.releaseDate.slice(0, 10) } : {}),
    numTracks: release.tracks?.length,
    ...(release.audienceCount > 0 && release.audienceAvg != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: release.audienceAvg,
            bestRating: 5,
            worstRating: 0.5,
            ratingCount: release.audienceCount,
          },
        }
      : {}),
  };
  // Escape "<" so review text can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function ReleaseDetailPage({ params }: Props) {
  const release = await getRelease(params.id);
  if (!release) notFound();

  const [critics, reviews, videos] = await Promise.allSettled([
    api.critic.reviewsForRelease(release.id),
    api.reviews.forRelease(release.id),
    api.videos.forRelease(release.id),
  ]);

  return (
    <DiscoveryShell className="space-y-10 pt-0 lg:pt-0">
      <ReleaseScoreProvider initialScore={scoreOf(release)}>
        <ReleaseHero release={release} />

        <ReleaseTracklistClient
          releaseId={release.id}
          releaseTitle={release.title}
          coverUrl={release.coverUrl}
          tracks={release.tracks ?? []}
        />

        <div className="grid gap-10 xl:grid-cols-2">
          <CriticReviews reviews={settled(critics, null)} />
          <CommunityReviews
            releaseId={release.id}
            releaseTitle={release.title}
            initialReviews={settled(reviews, null)}
          />
        </div>

        <ReleaseVideos videos={settled(videos, [])} />
      </ReleaseScoreProvider>
      {/* Last child: `space-y-*` on the shell would otherwise push the hero down by one gap. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(release) }} />
    </DiscoveryShell>
  );
}
