'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { UserSummary } from '@openmusic/shared';
import { api } from '@/lib/api';
import { Avatar, Dialog, ErrorState, Input, Skeleton } from '@/components/ui';
import { useDebouncedValue } from '@/components/discovery/useDebouncedValue';
import { displayNameOf, errorMessage } from '@/components/web-core/format';
import { useApiResource } from '@/components/web-core/useApiResource';
import { chatHref } from './chatFormat';

/** Start a conversation: the people you follow by default, anyone through search. */
export function NewChatDialog({
  open,
  onClose,
  viewerId,
}: {
  open: boolean;
  onClose: () => void;
  viewerId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 250);
  const people = useApiResource<UserSummary[]>(
    open ? (q ? `people:search:${q}` : `people:following:${viewerId}`) : null,
    () =>
      (q ? api.users.search({ q, limit: 20 }) : api.users.following(viewerId, { limit: 30 })).then(
        (page) => page.items.filter((u) => u.id !== viewerId)
      )
  );

  function choose(user: UserSummary) {
    onClose();
    setQuery('');
    router.push(chatHref(user.id));
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nuova conversazione" size="sm">
      <div className="space-y-3">
        <Input
          label="Cerca persone"
          hideLabel
          type="search"
          autoComplete="off"
          placeholder="Nome o @username…"
          leadingIcon={<MagnifyingGlass />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <h3 className="om-eyebrow">{q ? 'Risultati' : 'Persone che segui'}</h3>
        <div
          className="max-h-80 min-h-[8rem] overflow-y-auto"
          aria-busy={people.status === 'loading'}
        >
          {people.status === 'error' ? (
            <ErrorState
              variant="inline"
              title="Non riusciamo a cercare ora"
              description={errorMessage(people.error)}
              onRetry={people.reload}
            />
          ) : people.data === null ? (
            <div className="space-y-3 py-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton shape="circle" className="h-8 w-8" />
                  <Skeleton shape="text" lines={1} />
                </div>
              ))}
            </div>
          ) : people.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              {q
                ? `Nessuno corrisponde a “${q}”.`
                : 'Non segui ancora nessuno: cerca qualcuno per nome.'}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {people.data.map((user) => {
                const name = displayNameOf(user);
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => choose(user)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <Avatar name={name} src={user.avatarUrl} size="sm" decorative />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {name}
                        </span>
                        <span className="block truncate font-mono text-xs text-ink-muted">
                          @{user.username}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
