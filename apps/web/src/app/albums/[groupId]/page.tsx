import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import type { GroupScores, ReleaseGroupType } from '@openmusic/shared';
import { EmptyState } from '../../../components/ui';
import { CoverArt } from '../../../components/discovery/CoverArt';
import { ScoreFigure } from '../../../components/discovery/ScoreFigure';
import { DiscoveryShell } from '../../../components/discovery/DiscoveryShell';
import { EditionList } from '../../../components/discovery/EditionShelf';
import { ambientTint } from '../../../components/discovery/ambientTint';
import { formatStars, plural } from '../../../components/discovery/format';
import { EditionsSyncNotice } from './EditionsSyncNotice';
import { getReleaseGroup } from './data';

interface Props {
  params: Promise<{ groupId: string }>;
}

// Scores change with every review and editions arrive from background syncs.
export const dynamic = 'force-dynamic';

const GROUP_TYPE_LABEL: Record<ReleaseGroupType, string> = {
  ALBUM: 'Album',
  EP: 'EP',
  SINGLE: 'Singolo',
  LIVE: 'Live',
  COMPILATION: 'Raccolta',
  OTHER: 'Altro',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params;
  const group = await getReleaseGroup(groupId);
  if (!group) notFound();
  const title = `${group.title} di ${group.artistName}: tutte le edizioni`;
  const description = `${plural(group.editions.length, 'edizione', 'edizioni')} di ${group.title} con i voti di ognuna e il voto complessivo di critica e pubblico.`;
  return {
    title,
    description,
    alternates: { canonical: `/albums/${group.id}` },
    openGraph: {
      title,
      description,
      type: 'music.album',
      images: group.coverUrl ? [{ url: group.coverUrl, alt: `Copertina di ${group.title}` }] : [],
    },
  };
}

function Average({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <p className="text-sm text-fg-muted">
      media <span className="font-mono tabular-nums text-fg">{formatStars(value)}</span>
      <span className="font-mono tabular-nums">/5</span>
    </p>
  );
}

/** Group-level scores: every edition's reviews, one vote per person (ADR-012). */
function AggregatedScores({ scores }: { scores: GroupScores }) {
  return (
    <section aria-labelledby="group-scores" className="space-y-5">
      <h2 id="group-scores" className="om-eyebrow">
        Voto complessivo · tutte le edizioni
      </h2>
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-0">
        <div className="space-y-3 sm:pr-8">
          <p className="text-sm font-medium text-fg-muted">Critica accreditata</p>
          <ScoreFigure
            kind="critic"
            percentage={scores.criticCount > 0 ? scores.criticFreshPct : null}
            count={scores.criticCount}
          />
          <Average value={scores.criticAvg} />
        </div>
        <div className="space-y-3 border-line sm:border-l sm:pl-8">
          <p className="text-sm font-medium text-fg-muted">Pubblico</p>
          <ScoreFigure
            kind="audience"
            percentage={scores.audienceCount > 0 ? scores.audienceFreshPct : null}
            count={scores.audienceCount}
          />
          <Average value={scores.audienceAvg} />
        </div>
      </div>
      <p className="max-w-prose text-xs text-fg-subtle">
        Somma le recensioni di tutte le edizioni contando ogni persona una volta sola (la sua
        recensione più recente). I voti di ogni singola edizione sono nell’elenco qui sotto.
      </p>
    </section>
  );
}

export default async function AlbumPage({ params }: Props) {
  const { groupId } = await params;
  const group = await getReleaseGroup(groupId);
  if (!group) notFound();

  const tint = ambientTint(group.dominantColor, 0.25);
  const style = tint ? ({ '--release-tint': tint } as React.CSSProperties) : undefined;
  const musicbrainz =
    group.externalIds.musicbrainz && /^[A-Za-z0-9-]{1,64}$/.test(group.externalIds.musicbrainz)
      ? group.externalIds.musicbrainz
      : null;
  const editionCount = group.editions.length;

  return (
    <DiscoveryShell className="space-y-16 pt-0 lg:pt-0">
      <header
        style={style}
        className="relative -mx-4 px-4 pb-4 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:bg-[linear-gradient(180deg,var(--release-tint,transparent),transparent_70%)]"
      >
        <Link
          href="/explore"
          className="mb-8 inline-flex items-center gap-1.5 rounded-sm text-sm text-fg-muted transition-colors duration-fast hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Torna al catalogo
        </Link>

        <div className="grid gap-8 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="relative mx-auto w-full max-w-[20rem] self-start md:mx-0">
            <CoverArt
              src={group.coverUrl}
              placeholderColor={group.dominantColor}
              alt={`Copertina di ${group.title} di ${group.artistName}`}
              sizes="(min-width: 1024px) 320px, (min-width: 768px) 256px, 80vw"
              priority
              framed
              className="aspect-square w-full rounded-md"
            />
          </div>

          <div className="min-w-0 space-y-7">
            <div className="space-y-3">
              <p className="om-eyebrow">
                {GROUP_TYPE_LABEL[group.primaryType]}
                {group.firstYear && (
                  <>
                    , prima uscita nel{' '}
                    <span className="font-mono tabular-nums">{group.firstYear}</span>
                  </>
                )}
              </p>
              <h1 className="om-headline text-balance text-display-md text-fg lg:text-display-lg">
                {group.title}
              </h1>
              <p className="om-deck text-xl sm:text-2xl">{group.artistName}</p>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="text-fg">
                {plural(editionCount, 'edizione', 'edizioni')} nel catalogo
              </span>
              {group.genres.length > 0 && (
                <ul aria-label="Generi" className="flex flex-wrap gap-x-4 gap-y-1">
                  {group.genres.map((genre) => (
                    <li key={genre}>
                      <Link
                        href={`/explore?genre=${encodeURIComponent(genre)}`}
                        className="rounded-sm text-fg-muted underline decoration-line-strong/60 underline-offset-4 transition-colors duration-fast hover:text-fg hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        {genre}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <hr className="om-rule" />
            <AggregatedScores scores={group.scores} />

            {musicbrainz && (
              <p className="text-xs text-fg-subtle">
                Edizioni verificate su{' '}
                <a
                  href={`https://musicbrainz.org/release-group/${musicbrainz}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  MusicBrainz
                  <ArrowSquareOut aria-hidden="true" className="h-3 w-3" />
                  <span className="sr-only"> (si apre in una nuova scheda)</span>
                </a>
              </p>
            )}
          </div>
        </div>
      </header>

      <section aria-labelledby="group-editions" className="space-y-5">
        <div className="space-y-2">
          <h2 id="group-editions" className="om-headline text-3xl text-fg">
            Edizioni
          </h2>
          <p className="max-w-prose text-sm text-fg-muted">
            Dalla più vecchia alla più recente. Remaster, deluxe e ristampe restano dischi separati:
            ognuno ha tracklist, recensioni e voti propri.
          </p>
        </div>
        {group.editionsSyncing && <EditionsSyncNotice />}
        {editionCount > 0 ? (
          <EditionList editions={group.editions} label={`Edizioni di ${group.title}`} />
        ) : (
          <EmptyState
            size="compact"
            title="Ancora nessuna edizione nel catalogo"
            description={
              group.editionsSyncing
                ? 'Le stiamo importando adesso: ricarica la pagina tra qualche secondo.'
                : 'Cerca il disco nel catalogo per importarne un’edizione.'
            }
            action={
              <Link
                href={`/explore?q=${encodeURIComponent(`${group.artistName} ${group.title}`)}`}
                className="om-link text-sm"
              >
                Cerca nel catalogo
              </Link>
            }
          />
        )}
      </section>
    </DiscoveryShell>
  );
}
