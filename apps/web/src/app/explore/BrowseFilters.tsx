'use client';

import React from 'react';
import type { GenreList } from '@openmusic/shared';
import { cn } from '../../components/ui';
import type { ExploreSort } from './params';

const chip =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-fast ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function GenreFilter({
  genres,
  value,
  onChange,
}: {
  genres: GenreList;
  value: string | null;
  onChange: (genre: string | null) => void;
}) {
  const options: Array<{ name: string | null; label: string; count?: number }> = [
    { name: null, label: 'Tutti i generi' },
    ...genres.map((g) => ({ name: g.name, label: g.name, count: g.releaseCount })),
  ];
  return (
    <div
      role="group"
      aria-label="Filtra per genere"
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      <div className="flex w-max gap-2">
        {options.map((option) => {
          const active = option.name === value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.name)}
              className={cn(
                chip,
                active
                  ? 'border-fg bg-fg font-medium text-canvas'
                  : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
              )}
            >
              {option.label}
              {option.count !== undefined && (
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    active ? 'text-canvas/75' : 'text-fg-subtle'
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SORTS: Array<{ value: ExploreSort; label: string }> = [
  { value: 'popular', label: 'Più recensiti' },
  { value: 'recent', label: 'Più recenti' },
];

export function SortToggle({
  value,
  onChange,
}: {
  value: ExploreSort;
  onChange: (sort: ExploreSort) => void;
}) {
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">Ordina i dischi</legend>
      <span aria-hidden="true" className="hidden text-sm text-fg-subtle sm:inline">
        Ordina
      </span>
      <div className="inline-flex rounded-md bg-sunken p-0.5">
        {SORTS.map((option) => (
          <label
            key={option.value}
            className={cn(
              'relative cursor-pointer rounded-[5px] px-3 py-1.5 text-sm transition-colors duration-fast',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
              value === option.value
                ? 'bg-surface-raised font-medium text-fg shadow-hairline'
                : 'text-fg-muted hover:text-fg'
            )}
          >
            <input
              type="radio"
              name="explore-sort"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
