'use client';

import React, { useEffect, useId, useState } from 'react';
import { Disc, MagnifyingGlass, X } from '@phosphor-icons/react';
import type { CatalogRelease } from '@openmusic/shared';
import { api } from '@/lib/api';
import { IconButton, Spinner, cn, controlClasses } from '@/components/ui';
import { CoverArt } from '@/components/discovery/CoverArt';
import { errorMessage, isUuid, yearOf } from '../format';

export interface PickedRelease {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  releaseDate: string | null;
}

const DEBOUNCE_MS = 300;

/**
 * Attach a disc to a post: search the catalogue and pick one result. Only releases stored in
 * OpenMusic (UUID ids) can be attached; external search hits are not selectable.
 */
export function ReleasePicker({
  value,
  onChange,
  disabled,
}: {
  value: PickedRelease | null;
  onChange: (release: PickedRelease | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const statusId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogRelease[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setState('idle');
      return;
    }
    let cancelled = false;
    setState('loading');
    const timer = window.setTimeout(() => {
      api.catalog
        .search(q)
        .then((res) => {
          if (cancelled) return;
          setResults(res.releases.filter((r) => isUuid(r.id)).slice(0, 6));
          setState('done');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(errorMessage(err, 'Ricerca non disponibile al momento.'));
          setState('error');
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    const year = yearOf(value.releaseDate);
    return (
      <div className="flex items-center gap-3 rounded-md border border-line bg-sunken p-2 pr-1">
        <Cover src={value.coverUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{value.title}</p>
          <p className="truncate text-xs text-ink-secondary">
            {value.artistName}
            {year && <span className="font-mono tabular-nums"> · {year}</span>}
          </p>
        </div>
        <IconButton
          label={`Rimuovi ${value.title}`}
          icon={<X weight="bold" />}
          size="sm"
          onClick={() => onChange(null)}
          disabled={disabled}
        />
      </div>
    );
  }

  const statusText =
    state === 'loading'
      ? 'Ricerca in corso…'
      : state === 'error'
        ? error
        : state === 'done'
          ? results.length === 0
            ? 'Nessun disco trovato nel catalogo OpenMusic.'
            : `${results.length} ${results.length === 1 ? 'disco trovato' : 'dischi trovati'}`
          : '';

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        Allega un disco <span className="font-normal text-ink-muted">(facoltativo)</span>
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted"
        >
          {state === 'loading' ? <Spinner size="sm" label={null} /> : <MagnifyingGlass />}
        </span>
        <input
          id={inputId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Titolo o artista, es. In Rainbows"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter picks the first result instead of submitting the post.
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = results[0];
              if (first) onChange(toPicked(first));
            }
          }}
          aria-describedby={statusId}
          disabled={disabled}
          className={cn(controlClasses, 'h-10 pl-10 text-base sm:text-sm')}
        />
      </div>
      <p
        id={statusId}
        role="status"
        className={cn(
          'text-xs',
          state === 'error' ? 'text-rotten' : 'text-ink-muted',
          !statusText && 'sr-only'
        )}
      >
        {statusText}
      </p>
      {results.length > 0 && (
        <ul
          aria-label="Risultati"
          className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-elevated"
        >
          {results.map((release) => {
            const year = yearOf(release.releaseDate ?? null);
            return (
              <li key={release.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(toPicked(release));
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-3 p-2 text-left hover:bg-surface focus-visible:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <Cover src={release.coverUrl ?? null} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {release.title}
                    </span>
                    <span className="block truncate text-xs text-ink-secondary">
                      {release.artistName}
                      {year && <span className="font-mono tabular-nums"> · {year}</span>}
                    </span>
                  </span>
                  <span className="sr-only">Allega</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function toPicked(release: CatalogRelease): PickedRelease {
  return {
    id: release.id,
    title: release.title,
    artistName: release.artistName,
    coverUrl: release.coverUrl ?? null,
    releaseDate: release.releaseDate ?? null,
  };
}

function Cover({ src }: { src: string | null }) {
  return src ? (
    <CoverArt
      src={src}
      alt=""
      sizes="40px"
      className="h-10 w-10 shrink-0 rounded-xs ring-1 ring-line"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xs bg-surface text-ink-muted ring-1 ring-line"
    >
      <Disc />
    </span>
  );
}
