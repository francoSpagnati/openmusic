'use client';

import React, { useId, useState } from 'react';
import { CheckCircle, MagnifyingGlass } from '@phosphor-icons/react';
import type { CatalogTrack } from '@openmusic/shared';
import { api } from '@/lib/api';
import { ErrorState, Input, Skeleton, Spinner, cn } from '@/components/ui';
import { CoverArt } from '@/components/discovery/CoverArt';
import { PreviewPlayButton } from '@/components/discovery/PreviewPlayButton';
import { formatTrackDuration } from '@/components/discovery/format';
import { useDebouncedValue } from '@/components/discovery/useDebouncedValue';
import { errorMessage } from '@/components/web-core/format';
import { useApiResource } from '@/components/web-core/useApiResource';
import { catalogToPlayingTrack } from './track';

const MIN_QUERY = 2;

/**
 * Catalog track search with a native radio list: arrow keys move between results, Space/click
 * selects, and each row has its own preview button.
 */
export function TrackSearch({
  value,
  onChange,
  autoFocus,
}: {
  value: CatalogTrack | null;
  onChange: (track: CatalogTrack) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 300);
  const ready = debounced.length >= MIN_QUERY;
  const search = useApiResource(ready ? `tracks:${debounced}` : null, () =>
    api.catalog.search(debounced).then((r) => r.tracks)
  );
  const groupName = useId();
  const typing = query.trim() !== debounced;
  const tracks = search.data ?? [];
  // Keep the chosen track visible even when a new search no longer returns it.
  const list = value && !tracks.some((t) => t.id === value.id) ? [value, ...tracks] : tracks;

  return (
    <div className="space-y-3">
      <Input
        label="Cerca un brano"
        hideLabel
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Titolo o artista…"
        leadingIcon={<MagnifyingGlass />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter inside the dialog form must not submit before a track is chosen.
          if (e.key === 'Enter') e.preventDefault();
        }}
      />

      <p role="status" className="sr-only">
        {search.status === 'loading'
          ? 'Ricerca in corso'
          : search.status === 'success' && ready
            ? `${tracks.length} brani trovati`
            : ''}
      </p>

      <div className="max-h-72 min-h-[7rem] overflow-y-auto rounded-md border border-line bg-sunken p-1.5">
        {search.status === 'error' ? (
          <ErrorState
            variant="inline"
            title="Il catalogo non risponde"
            description={errorMessage(search.error)}
            onRetry={search.reload}
          />
        ) : list.length > 0 ? (
          <fieldset aria-busy={search.status === 'loading' || typing}>
            <legend className="sr-only">Risultati: scegli il brano da consigliare</legend>
            <ul className="space-y-1">
              {list.map((track) => (
                <TrackOption
                  key={track.id}
                  track={track}
                  name={groupName}
                  checked={value?.id === track.id}
                  onSelect={() => onChange(track)}
                />
              ))}
            </ul>
          </fieldset>
        ) : search.status === 'loading' || (typing && query.trim().length >= MIN_QUERY) ? (
          <div aria-hidden="true" className="space-y-2 p-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton shape="rect" className="h-10 w-10 rounded-xs" />
                <Skeleton shape="text" lines={2} />
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-ink-muted">
            {ready
              ? `Nessun brano per “${debounced}”. Prova con l’artista.`
              : 'Scrivi almeno due lettere: cerchiamo nel catalogo e su Deezer.'}
          </p>
        )}
      </div>
      {search.status === 'loading' && list.length > 0 && (
        <Spinner size="sm" label="Aggiorno i risultati" />
      )}
    </div>
  );
}

function TrackOption({
  track,
  name,
  checked,
  onSelect,
}: {
  track: CatalogTrack;
  name: string;
  checked: boolean;
  onSelect: () => void;
}) {
  const inputId = useId();
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-sm pr-1.5 transition-colors duration-fast',
        checked ? 'bg-accent/15 ring-1 ring-accent/60' : 'hover:bg-elevated'
      )}
    >
      <input
        id={inputId}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-sm p-1.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus"
      >
        <CoverArt
          src={track.coverUrl}
          alt=""
          sizes="40px"
          className="h-10 w-10 shrink-0 rounded-xs"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{track.title}</span>
          <span className="block truncate text-xs text-ink-secondary">
            {track.artistName}
            <span className="font-mono tabular-nums text-ink-muted">
              {' '}
              · {formatTrackDuration(track.durationMs)}
            </span>
          </span>
        </span>
        {checked && (
          <CheckCircle aria-hidden="true" weight="fill" className="h-5 w-5 shrink-0 text-accent" />
        )}
      </label>
      <PreviewPlayButton size="sm" variant="ghost" track={catalogToPlayingTrack(track)} />
    </li>
  );
}
