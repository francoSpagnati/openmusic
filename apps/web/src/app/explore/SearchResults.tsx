'use client';

import React from 'react';
import Link from 'next/link';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Button, EmptyState, ErrorState, Skeleton, Spinner } from '../../components/ui';
import { CoverArt } from '../../components/discovery/CoverArt';
import { PreviewPlayButton } from '../../components/discovery/PreviewPlayButton';
import { toPlayingTrack } from '../../components/discovery/ReleasePreviewButton';
import {
  CATALOG_SOURCE_LABEL,
  formatTrackDuration,
  plural,
} from '../../components/discovery/format';
import { groupEditions } from '../../components/discovery/editions';
import type { SearchState } from './useCatalogSearch';
import { ReleaseGrid, ReleaseGridSkeleton } from './ReleaseGrid';

export function SearchResults({
  query,
  state,
  onRetry,
  onClear,
  onLoadMore,
}: {
  query: string;
  state: SearchState;
  onRetry: () => void;
  onClear: () => void;
  onLoadMore: () => void;
}) {
  if (state.status === 'error') {
    return (
      <ErrorState
        title="La ricerca si è interrotta"
        description="Il catalogo non ha risposto. Controlla la connessione e riprova."
        onRetry={onRetry}
      />
    );
  }

  const result =
    state.status === 'ready' ? state.result : state.status === 'loading' ? state.previous : null;

  if (!result) {
    return (
      <div aria-busy="true" className="space-y-6">
        <span className="sr-only">Ricerca in corso…</span>
        <ReleaseGridSkeleton count={4} />
        <Skeleton shape="text" lines={3} />
      </div>
    );
  }

  const total = result.releases.length + result.tracks.length;
  // Editions of the same album are folded into one card (ADR-012); count albums, not editions.
  const albumCount = groupEditions(result.releases).length;
  // Local catalog answered, Deezer/iTunes still searching.
  const searchingExternal = state.status === 'ready' && state.phase === 'local';
  const done = state.status === 'ready' && state.phase === 'complete';
  const external = result.sources.filter((source) => source !== 'LOCAL');

  return (
    <div className="space-y-12" aria-busy={state.status === 'loading' || searchingExternal}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p role="status" className="text-sm text-fg-muted">
          {state.status === 'loading'
            ? 'Aggiorno i risultati…'
            : `${plural(total, 'risultato', 'risultati')} per “${query.trim()}”`}
        </p>
        {searchingExternal ? (
          <p className="inline-flex items-center gap-2 text-xs text-fg-subtle">
            <Spinner size="sm" label={null} />
            Cerco anche su Deezer e iTunes…
          </p>
        ) : (
          external.length > 0 && (
            <p className="text-xs text-fg-subtle">
              Copertine e metadati da{' '}
              {external.map((source) => CATALOG_SOURCE_LABEL[source]).join(', ')}
            </p>
          )
        )}
      </div>

      {total === 0 && searchingExternal && <ReleaseGridSkeleton count={4} />}

      {total === 0 && done && (
        <EmptyState
          icon={<MagnifyingGlass />}
          title="Nessun disco su questo scaffale"
          description="Prova con il nome dell’artista, un titolo più corto o controlla l’ortografia."
          action={
            <button
              type="button"
              onClick={onClear}
              className="om-link rounded-sm text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              Torna a sfogliare il catalogo
            </button>
          }
        />
      )}

      {result.releases.length > 0 && (
        <section aria-labelledby="search-releases" className="space-y-5">
          <h2 id="search-releases" className="om-headline text-2xl text-fg">
            Dischi · {albumCount}
          </h2>
          <ReleaseGrid releases={result.releases} label="Dischi trovati" foldEditions />
        </section>
      )}

      {result.tracks.length > 0 && (
        <section aria-labelledby="search-tracks" className="space-y-5">
          <h2 id="search-tracks" className="om-headline text-2xl text-fg">
            Brani · {result.tracks.length}
          </h2>
          <ul className="border-t border-line">
            {result.tracks.map((track) => (
              <li
                key={track.id}
                className="flex items-center gap-3 border-b border-line px-1 py-2.5 transition-colors duration-fast hover:bg-fg/[0.03] sm:gap-4 sm:px-2"
              >
                <CoverArt
                  src={track.coverUrl}
                  alt=""
                  sizes="40px"
                  framed
                  className="h-10 w-10 shrink-0 rounded-xs"
                />
                <div className="min-w-0 flex-1">
                  {track.releaseId ? (
                    <Link
                      href={`/releases/${track.releaseId}#track-${track.id}`}
                      className="block truncate rounded-xs text-[0.9375rem] text-fg underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      {track.title}
                    </Link>
                  ) : (
                    <p className="truncate text-[0.9375rem] text-fg">{track.title}</p>
                  )}
                  <p className="truncate text-sm text-fg-muted">{track.artistName}</p>
                </div>
                <span className="hidden font-mono text-sm tabular-nums text-fg-muted sm:inline">
                  {formatTrackDuration(track.durationMs)}
                </span>
                <PreviewPlayButton
                  track={toPlayingTrack(track)}
                  size="sm"
                  variant="subtle"
                  shape="round"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.status === 'ready' && state.result.hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            variant="outline"
            loading={state.loadingMore}
            loadingLabel="Cerco altri risultati…"
            onClick={onLoadMore}
          >
            Altri risultati
          </Button>
          {state.loadMoreFailed && (
            <p role="alert" className="text-sm text-rotten">
              Non sono riuscito a caricarne altri. Riprova.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
