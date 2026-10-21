'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Globe, UsersThree } from '@phosphor-icons/react';
import type { Post } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, EmptyState, ErrorState, Tabs, buttonClasses } from '@/components/ui';
import { CreatePostBox } from '@/components/CreatePostBox';
import { RightSidebar } from '@/components/RightSidebar';
import { Sidebar } from '@/components/Sidebar';
import { SocialPostCard } from '@/components/SocialPostCard';
import { StoriesListeningBar } from '@/components/StoriesListeningBar';
import { LoadMore } from '../LoadMore';
import { WhoToFollow } from '../WhoToFollow';
import { errorMessage } from '../format';
import { usePagedList, type PagedList } from '../usePagedList';
import { FeedSkeleton } from './PostSkeleton';

type Scope = 'following' | 'global';

/** Home: the people you follow (default) or everyone; anonymous visitors see everyone. */
export function HomeFeed() {
  const { status, user } = useAuth();
  const authenticated = status === 'authenticated';
  const [scope, setScope] = useState<Scope>('following');
  const effectiveScope: Scope = authenticated ? scope : 'global';
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const feed = usePagedList<Post>(
    status === 'loading' ? null : `feed:${effectiveScope}:${user?.id ?? 'anon'}`,
    (cursor) => api.feed.list({ scope: effectiveScope, cursor, limit: 10 })
  );

  const addPost = (post: Post) => feed.setItems((items) => [post, ...items]);
  const removePost = (id: string) => feed.setItems((items) => items.filter((p) => p.id !== id));

  function openComposer() {
    const el = composerRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
  }

  const body = (
    <FeedBody
      feed={feed}
      scope={effectiveScope}
      onRemoved={removePost}
      onShowGlobal={() => setScope('global')}
    />
  );

  return (
    <div className="mx-auto flex max-w-7xl justify-center">
      <Sidebar onOpenCreatePost={authenticated ? openComposer : undefined} />

      <div className="min-w-0 flex-1 border-line lg:border-r">
        <h1 className="sr-only">Il tuo feed</h1>
        <StoriesListeningBar />
        {authenticated ? (
          <>
            <CreatePostBox ref={composerRef} onPostCreated={addPost} onPostRemoved={removePost} />
            <Tabs
              label="Quale feed"
              value={scope}
              onValueChange={(id) => setScope(id === 'global' ? 'global' : 'following')}
              // Keep only the tab strip sticky under the mobile navbar while the feed scrolls.
              className="[&>[role=tablist]]:sticky [&>[role=tablist]]:top-[3.75rem] [&>[role=tablist]]:z-raised [&>[role=tablist]]:bg-canvas [&>[role=tablist]]:px-4 sm:[&>[role=tablist]]:px-5 lg:[&>[role=tablist]]:top-0"
              panelClassName="pt-0"
              items={[
                {
                  id: 'following',
                  label: 'Seguiti',
                  icon: <UsersThree aria-hidden="true" />,
                  content: body,
                },
                { id: 'global', label: 'Tutti', icon: <Globe aria-hidden="true" />, content: body },
              ]}
            />
          </>
        ) : (
          <>
            {status === 'anonymous' && <WelcomeCard />}
            <h2 className="om-eyebrow border-b border-line px-4 py-3 sm:px-5">
              Dal bancone di OpenMusic
            </h2>
            {body}
          </>
        )}
      </div>

      <RightSidebar />
    </div>
  );
}

function FeedBody({
  feed,
  scope,
  onRemoved,
  onShowGlobal,
}: {
  feed: PagedList<Post>;
  scope: Scope;
  onRemoved: (id: string) => void;
  onShowGlobal: () => void;
}) {
  if (feed.status === 'idle' || (feed.status === 'loading' && feed.items.length === 0)) {
    return <FeedSkeleton />;
  }

  if (feed.status === 'error') {
    return (
      <div className="p-4 sm:p-5">
        <ErrorState
          title="Il feed non si è caricato"
          description={errorMessage(feed.error, 'La puntina è saltata. Riprova tra un attimo.')}
          onRetry={feed.reload}
        />
      </div>
    );
  }

  if (feed.items.length === 0) {
    return scope === 'following' ? (
      <div className="space-y-6 p-4 sm:p-5">
        <EmptyState
          title="Il giradischi è silenzioso"
          description="Qui compaiono i post delle persone che segui e i tuoi. Inizia seguendo qualcuno dal gusto affine."
          action={
            <Button
              variant="secondary"
              onClick={onShowGlobal}
              leadingIcon={<Globe aria-hidden="true" />}
            >
              Guarda cosa condividono tutti
            </Button>
          }
        />
        <Card variant="surface">
          <h3 className="om-eyebrow mb-4">Chi seguire</h3>
          <WhoToFollow limit={5} onFollowChange={feed.reload} />
        </Card>
      </div>
    ) : (
      <div className="p-4 sm:p-5">
        <EmptyState
          title="Nessun post, per ora"
          description="Il negozio ha appena aperto. Sii il primo a raccontare un disco."
        />
      </div>
    );
  }

  return (
    <div aria-busy={feed.status === 'loading'}>
      <ul
        aria-label={
          scope === 'following' ? 'Post delle persone che segui' : 'Post di tutta la community'
        }
      >
        {feed.items.map((post) => (
          <li key={post.id}>
            <SocialPostCard post={post} onRemoved={onRemoved} />
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={feed.hasMore}
        loading={feed.loadingMore}
        error={feed.moreError}
        onLoadMore={feed.loadMore}
        label="Carica altri post"
        endLabel="Lato B finito · sei in pari"
      />
    </div>
  );
}

function WelcomeCard() {
  return (
    <section aria-labelledby="welcome-title" className="border-b border-line px-4 py-8 sm:px-5">
      <p className="om-eyebrow">Benvenuto · Ingresso libero</p>
      <h2 id="welcome-title" className="om-headline mt-2 text-display-sm text-ink">
        Cosa gira sul piatto dei tuoi amici?
      </h2>
      <p className="om-deck mt-2 max-w-prose text-ink-secondary">
        Crea un account per seguire chi ha gusti affini, pubblicare i tuoi ascolti e votare i
        dischi.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/auth?mode=register" className={buttonClasses({ size: 'lg' })}>
          Crea un account
        </Link>
        <Link href="/auth" className={buttonClasses({ variant: 'outline', size: 'lg' })}>
          Accedi
        </Link>
      </div>
    </section>
  );
}
