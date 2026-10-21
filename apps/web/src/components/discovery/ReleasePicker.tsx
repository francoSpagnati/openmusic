'use client';

import React, { useEffect, useId, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { CatalogRelease } from '@openmusic/shared';
import { api } from '../../lib/api';
import { IconButton, Input, Spinner } from '../ui';
import { CoverArt } from './CoverArt';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Optional link to a catalog release: type to search, pick from the list. Uses buttons in a
 * listbox-like list (no ARIA combobox) so it works the same with keyboard, touch and AT.
 */
export function ReleasePicker({
  value,
  onChange,
  disabled,
}: {
  value: CatalogRelease | null;
  onChange: (release: CatalogRelease | null) => void;
  disabled?: boolean;
}) {
  const statusId = useId();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const [results, setResults] = useState<CatalogRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const q = debounced.trim();
    if (!q || value) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api.catalog
      .search(q)
      .then((res) => !cancelled && setResults(res.releases.slice(0, 6)))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, value]);

  if (value) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">Disco collegato</p>
        <div className="flex items-center gap-3 rounded-md border border-line-strong bg-sunken p-2">
          <CoverArt
            src={value.coverUrl}
            alt=""
            sizes="40px"
            className="h-10 w-10 shrink-0 rounded-xs"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{value.title}</span>
            <span className="block truncate text-xs text-ink-secondary">{value.artistName}</span>
          </span>
          <IconButton
            label="Scollega il disco"
            icon={<X />}
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        label="Disco collegato"
        hint="Facoltativo: il video comparirà anche nella scheda del disco."
        type="search"
        autoComplete="off"
        placeholder="Cerca titolo o artista…"
        leadingIcon={<MagnifyingGlass />}
        value={query}
        disabled={disabled}
        aria-describedby={statusId}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p id={statusId} role="status" className="text-xs text-ink-muted">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="xs" label={null} /> Cerco nel catalogo…
          </span>
        ) : failed ? (
          'Ricerca non riuscita: riprova.'
        ) : debounced.trim() && results.length === 0 ? (
          'Nessun disco trovato.'
        ) : results.length > 0 ? (
          `${results.length} dischi trovati`
        ) : null}
      </p>
      {results.length > 0 && (
        <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line bg-sunken">
          {results.map((release) => (
            <li key={release.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(release);
                  setQuery('');
                }}
                className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <CoverArt
                  src={release.coverUrl}
                  alt=""
                  sizes="32px"
                  className="h-8 w-8 shrink-0 rounded-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{release.title}</span>
                  <span className="block truncate text-xs text-ink-secondary">
                    {release.artistName}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
