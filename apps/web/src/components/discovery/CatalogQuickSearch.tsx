'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import type { CatalogRelease } from '@openmusic/shared';
import { api } from '../../lib/api';
import { Input, cn } from '../ui';
import { CoverArt } from './CoverArt';
import { releaseYear } from './format';
import { useDebouncedValue } from './useDebouncedValue';

const QUICK_LIMIT = 5;

/**
 * Global catalog search (desktop sidebar, mobile menu). Typing shows up to five matches from the
 * local catalog at once (no external calls, so it is instant and cheap); Enter, or the last row,
 * opens the full search on /explore, which also brings in Deezer/iTunes results.
 */
export function CatalogQuickSearch({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 250);
  const [results, setResults] = useState<{ q: string; items: CatalogRelease[] } | null>(null);

  // A new page: start clean (the menu/sidebar persists across navigations).
  useEffect(() => {
    setQuery('');
    setResults(null);
  }, [pathname]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    api.catalog
      .search({ q: debounced, type: 'releases', limit: QUICK_LIMIT, external: 'false' })
      .then((r) => {
        if (!cancelled) setResults({ q: debounced, items: r.releases });
      })
      .catch(() => {
        if (!cancelled) setResults({ q: debounced, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const q = query.trim();
  const exploreHref = `/explore?q=${encodeURIComponent(q)}`;
  const open = q.length >= 2 && results !== null && results.q === debounced;

  return (
    <form
      role="search"
      aria-label="Catalogo"
      className={cn('relative', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (q) router.push(exploreHref);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && query) {
          event.preventDefault();
          setQuery('');
        }
      }}
    >
      <Input
        label="Cerca dischi e brani"
        hideLabel
        type="search"
        name="q"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        placeholder="Cerca dischi e brani…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leadingIcon={<MagnifyingGlass />}
        aria-controls={open ? listId : undefined}
      />
      {open && (
        <div className="mt-2 overflow-hidden rounded-md border border-line bg-surface shadow-om-md">
          <p role="status" className="sr-only">
            {results.items.length === 0
              ? 'Nessun disco nel catalogo locale: premi Invio per cercare ovunque.'
              : `${results.items.length} dischi nel catalogo`}
          </p>
          {results.items.length > 0 && (
            <ul id={listId} aria-label="Dischi trovati" className="divide-y divide-line">
              {results.items.map((release) => {
                const year = releaseYear(release.releaseDate);
                return (
                  <li key={release.id}>
                    <Link
                      href={`/releases/${release.id}`}
                      className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-fg/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                    >
                      <CoverArt
                        src={release.coverUrl}
                        placeholderColor={release.dominantColor}
                        alt=""
                        sizes="32px"
                        className="h-8 w-8 shrink-0 rounded-xs"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">
                          {release.title}
                        </span>
                        <span className="block truncate text-xs text-fg-muted">
                          {release.artistName}
                          {year ? ` · ${year}` : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href={exploreHref}
            className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-2 text-sm font-semibold text-accent first:border-t-0 hover:bg-fg/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <span className="truncate">Cerca “{q}” ovunque</span>
            <ArrowRight aria-hidden="true" weight="bold" className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      )}
    </form>
  );
}
