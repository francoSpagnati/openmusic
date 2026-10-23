import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CatalogRelease, DualScoreDetails } from '@openmusic/shared';
import { api } from '../../../lib/api';
import { DiscoveryShell } from '../../../components/discovery/DiscoveryShell';
import { EditionShelf } from '../../../components/discovery/EditionShelf';
import { CommunityReviews } from './CommunityReviews';
import { CriticReviews } from './CriticReviews';
import { ReleaseHero } from './ReleaseHero';
import { ReleaseScoreProvider } from './ReleaseScoreContext';
import { ReleaseTracklistClient } from './ReleaseTracklistClient';
import { ReleaseVideos } from './ReleaseVideos';
import { getRelease, redirectLegacyId, settled } from './data';

interface Props {
  params: Promise<{ id: string }>;
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
  const { id } = await params;
  redirectLegacyId(id);
  const release = await getRelease(id);
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
  const { id } = await params;
  redirectLegacyId(id);
  const release = await getRelease(id);
  if (!release) notFound();

  const [critics, reviews, videos] = await Promise.allSettled([
    api.critic.reviewsForRelease(release.id),
    api.reviews.forRelease(release.id),
    api.videos.forRelease(release.id),
  ]);

  return (
    <DiscoveryShell className="space-y-16 pt-0 lg:pt-0">
      <ReleaseScoreProvider initialScore={scoreOf(release)}>
        <ReleaseHero release={release} />

        <ReleaseTracklistClient
          releaseId={release.id}
          releaseTitle={release.title}
          coverUrl={release.coverUrl}
          tracks={release.tracks ?? []}
        />

        {release.otherEditions && release.otherEditions.length > 0 && (
          <section aria-labelledby="other-editions" className="space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="other-editions" className="om-headline text-3xl text-fg">
                Altre edizioni
              </h2>
              {release.group && (
                <Link
                  href={`/albums/${release.group.id}`}
                  className="om-link rounded-sm text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  Pagina dell’album
                </Link>
              )}
            </div>
            <p className="max-w-prose text-sm text-fg-muted">
              Ristampe, remaster ed edizioni ampliate dello stesso album. Ognuna ha la sua tracklist
              e i suoi voti.
            </p>
            <EditionShelf editions={release.otherEditions} label="Altre edizioni" />
          </section>
        )}

        <div className="max-w-prose space-y-16">
          <CriticReviews reviews={settled(critics, null)} />
          <hr className="om-rule" />
          <CommunityReviews
            releaseId={release.id}
            releaseTitle={release.title}
            editionLabel={release.editionLabel ?? null}
            hasOtherEditions={(release.otherEditions?.length ?? 0) > 0}
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
