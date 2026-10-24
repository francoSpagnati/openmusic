'use client';

import React, { useEffect, useId, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { UserSummary } from '@openmusic/shared';
import { api } from '@/lib/api';
import { Spinner, cn, controlClasses } from '@/components/ui';
import { FollowButton } from '../FollowButton';
import { UserIdentity } from '../UserIdentity';
import { errorMessage } from '../format';

const DEBOUNCE_MS = 300;

/** Find people by username or name; results are links with an inline follow button. */
export function PeopleSearch() {
  const inputId = useId();
  const statusId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setState('idle');
      return;
    }
    let cancelled = false;
    setState('loading');
    const timer = window.setTimeout(() => {
      api.users
        .search({ q, limit: 5 })
        .then((page) => {
          if (cancelled) return;
          setResults(page.items);
          setState('done');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(errorMessage(err, 'Ricerca non disponibile.'));
          setState('error');
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const statusText =
    state === 'error'
      ? error
      : state === 'done'
        ? results.length === 0
          ? `Nessuno trovato per “${query.trim()}”.`
          : `${results.length} ${results.length === 1 ? 'persona trovata' : 'persone trovate'}`
        : '';

  return (
    <div role="search" aria-label="Persone" className="space-y-2">
      <label htmlFor={inputId} className="sr-only">
        Cerca persone
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle"
        >
          {state === 'loading' ? <Spinner size="sm" label={null} /> : <MagnifyingGlass />}
        </span>
        <input
          id={inputId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Cerca persone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          aria-describedby={statusId}
          className={cn(controlClasses, 'h-10 pl-10 text-base sm:text-sm')}
        />
      </div>
      <p
        id={statusId}
        role="status"
        className={cn(
          'px-1 text-xs',
          state === 'error' ? 'text-rotten' : 'text-fg-subtle',
          !statusText && 'sr-only'
        )}
      >
        {statusText}
      </p>
      {results.length > 0 && (
        <ul className="om-fade space-y-3 rounded-lg border border-line bg-surface-raised p-3">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2">
              <UserIdentity user={u} size="sm" />
              <FollowButton userId={u.id} username={u.username} isFollowing={u.isFollowedByMe} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
