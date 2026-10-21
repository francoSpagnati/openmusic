'use client';

import React from 'react';
import { Check } from '@phosphor-icons/react';
import { api } from '@/lib/api';
import { Skeleton, cn } from '@/components/ui';
import { useApiResource } from '../useApiResource';

/** Used when the catalogue is empty or unreachable, so onboarding never blocks on it. */
const FALLBACK_GENRES = [
  'Art Rock',
  'Post-Punk',
  'Shoegaze',
  'Elettronica',
  'Jazz',
  'Hip-Hop',
  'Ambient',
  'Folk',
  'Soul',
  'Metal',
];

export const MAX_GENRES = 10;

/** Multi-select of favourite genres as toggle buttons inside a fieldset. */
export function GenrePicker({
  value,
  onChange,
  legend = 'Generi preferiti',
  hint = 'Facoltativo: ci aiuta a proporti dischi e persone affini.',
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  legend?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const genres = useApiResource('genres', () => api.catalog.genres());
  const names =
    genres.status === 'success' && genres.data && genres.data.length > 0
      ? genres.data.map((g) => g.name)
      : FALLBACK_GENRES;
  // Keep previously chosen genres visible even if the catalogue no longer lists them.
  const options = Array.from(new Set([...value, ...names])).slice(0, 24);
  const full = value.length >= MAX_GENRES;
  const hintId = React.useId();

  function toggle(genre: string) {
    onChange(value.includes(genre) ? value.filter((g) => g !== genre) : [...value, genre]);
  }

  return (
    <fieldset className="space-y-2" aria-describedby={hintId} disabled={disabled}>
      <legend className="text-sm font-semibold text-ink">
        {legend}{' '}
        <span className="font-mono text-xs font-normal text-ink-muted tabular-nums">
          {value.length}/{MAX_GENRES}
        </span>
      </legend>
      <p id={hintId} className="text-sm text-ink-muted">
        {hint}
      </p>
      {genres.status === 'loading' ? (
        <div aria-busy="true" className="flex flex-wrap gap-2">
          <span className="sr-only">Caricamento generi…</span>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {options.map((genre) => {
            const selected = value.includes(genre);
            return (
              <li key={genre}>
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={!selected && full}
                  onClick={() => toggle(genre)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-xs transition-colors duration-fast',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    selected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line-strong text-ink-secondary hover:border-ink-secondary hover:text-ink'
                  )}
                >
                  {selected && <Check aria-hidden="true" weight="bold" className="text-accent" />}
                  {genre}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
