'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { GenreList, ReleasePage } from '@openmusic/shared';
import { Button, EmptyState, ErrorState, IconButton, Input } from '../../components/ui';
import { useDebouncedValue } from '../../components/discovery/useDebouncedValue';
import { plural } from '../../components/discovery/format';
import { GenreFilter, SortToggle } from './BrowseFilters';
import { ReleaseGrid, ReleaseGridSkeleton } from './ReleaseGrid';
import { SearchResults } from './SearchResults';
import { exploreQueryString, type ExploreParams, type ExploreSort } from './params';
import { useBrowseReleases } from './useBrowseReleases';
import { useCatalogSearch } from './useCatalogSearch';

interface ExploreClientProps {
  initialParams: ExploreParams;
  initialGenres: GenreList | null;
  initialPage: ReleasePage | null;
}

export function ExploreClient({ initialParams, initialGenres, initialPage }: ExploreClientProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState(initialParams.q);
  const [genre, setGenre] = useState<string | null>(initialParams.genre);
  const [sort, setSort] = useState<ExploreSort>(initialParams.sort);
  const debouncedQuery = useDebouncedValue(query, 300);

  const search = useCatalogSearch(debouncedQuery);
  const browse = useBrowseReleases(genre, sort, {
    page: initialPage,
    genre: initialParams.genre,
    sort: initialParams.sort,
  });

  // Keep the URL shareable without a history entry per keystroke or a server round-trip
  // (Next 14 syncs native replaceState with its router).
  useEffect(() => {
    const next = `${pathname}${exploreQueryString({ q: debouncedQuery, genre, sort })}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [debouncedQuery, genre, sort, pathname]);

  const searching = query.trim().length > 0;
  const genres = initialGenres ?? [];

  return (
    <div className="space-y-8">
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
        <Input
          label="Cerca nel catalogo"
          hideLabel
          type="search"
          name="q"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={100}
          placeholder="Cerca un album, un brano o un artista…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              setQuery('');
            }
          }}
          leadingIcon={<MagnifyingGlass />}
          className="pr-12"
        />
        {query && (
          <IconButton
            label="Cancella la ricerca"
            icon={<X />}
            size="sm"
            variant="ghost"
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
          />
        )}
      </form>

      {searching ? (
        <SearchResults
          query={debouncedQuery || query}
          state={search}
          onRetry={search.retry}
          onClear={() => setQuery('')}
          onLoadMore={() => void search.loadMore()}
        />
      ) : (
        <section aria-labelledby="browse-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="browse-heading" className="om-headline text-2xl text-ink">
                {genre ?? 'Tutto il catalogo'}
              </h2>
              <p
                className="mt-1 font-mono text-xs tabular-nums text-ink-secondary"
                aria-live="polite"
              >
                {browse.status === 'ready'
                  ? `${plural(browse.items.length, 'disco', 'dischi')}${browse.nextCursor ? ' finora' : ''}`
                  : browse.status === 'loading'
                    ? 'Sfoglio lo scaffale…'
                    : ''}
              </p>
            </div>
            <SortToggle value={sort} onChange={setSort} />
          </div>

          {genres.length > 0 && <GenreFilter genres={genres} value={genre} onChange={setGenre} />}

          {browse.status === 'loading' && browse.items.length === 0 && <ReleaseGridSkeleton />}

          {browse.status === 'error' && (
            <ErrorState
              title="Lo scaffale non si apre"
              description="Non riusciamo a caricare il catalogo in questo momento."
              onRetry={browse.retry}
            />
          )}

          {browse.status !== 'error' && browse.items.length > 0 && (
            <div
              className={browse.status === 'loading' ? 'opacity-60 transition-opacity' : undefined}
            >
              <ReleaseGrid
                releases={browse.items}
                label={genre ? `Dischi di ${genre}` : 'Dischi del catalogo'}
              />
            </div>
          )}

          {browse.status === 'ready' && browse.items.length === 0 && (
            <EmptyState
              title="Nessun disco in questo genere"
              description="Il catalogo cresce con ogni ricerca: prova un altro genere o cerca un artista."
              action={
                <Button variant="outline" onClick={() => setGenre(null)}>
                  Mostra tutti i generi
                </Button>
              }
            />
          )}

          {browse.status === 'ready' && browse.nextCursor && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                variant="secondary"
                loading={browse.loadingMore}
                loadingLabel="Carico altri dischi…"
                onClick={() => void browse.loadMore()}
              >
                Altri dischi
              </Button>
              {browse.loadMoreFailed && (
                <p role="alert" className="text-sm text-rotten">
                  Non sono riuscito a caricarne altri. Riprova.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
