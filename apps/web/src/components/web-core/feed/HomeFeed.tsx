'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Globe, UsersThree } from '@phosphor-icons/react';
import type { Post } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, EmptyState, ErrorState, Tabs, buttonClasses } from '@/components/ui';
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

      {/* Reading column: one measure (~42rem) however wide the screen gets. */}
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[42rem]">
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
                className="[&>[role=tablist]]:sticky [&>[role=tablist]]:top-[3.5rem] [&>[role=tablist]]:z-raised [&>[role=tablist]]:bg-canvas [&>[role=tablist]]:px-4 sm:[&>[role=tablist]]:px-6 lg:[&>[role=tablist]]:top-0"
                panelClassName="pt-0"
                items={[
                  {
                    id: 'following',
                    label: 'Seguiti',
                    icon: <UsersThree aria-hidden="true" />,
                    content: body,
                  },
                  {
                    id: 'global',
                    label: 'Tutti',
                    icon: <Globe aria-hidden="true" />,
                    content: body,
                  },
                ]}
              />
            </>
          ) : (
            <>
              {status === 'anonymous' && <WelcomeCard />}
              <h2 className="border-b border-line px-4 pb-3 pt-6 text-sm font-medium text-fg-muted sm:px-6">
                Dal bancone di OpenMusic
              </h2>
              {body}
            </>
          )}
        </div>
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
      <div className="px-4 py-10 sm:px-6">
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
      <div className="om-enter space-y-10 px-4 py-10 sm:px-6">
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
        <section aria-labelledby="feed-follow" className="border-t border-line pt-8">
          <h3 id="feed-follow" className="om-headline mb-5 text-xl text-fg">
            Chi seguire
          </h3>
          <WhoToFollow limit={5} onFollowChange={feed.reload} />
        </section>
      </div>
    ) : (
      <div className="om-enter px-4 py-10 sm:px-6">
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
        className="om-stagger"
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
        endLabel="Lato B finito: sei in pari."
      />
    </div>
  );
}

function WelcomeCard() {
  return (
    <section
      aria-labelledby="welcome-title"
      className="om-enter border-b border-line px-4 pb-10 pt-12 sm:px-6"
    >
      <h2 id="welcome-title" className="om-headline text-display-sm text-fg">
        Cosa gira sul piatto dei tuoi amici?
      </h2>
      <p className="om-deck mt-3 max-w-narrow text-fg-muted">
        Crea un account per seguire chi ha gusti affini, pubblicare i tuoi ascolti e votare i
        dischi.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/auth?mode=register" className={buttonClasses({ size: 'lg' })}>
          Crea un account
        </Link>
        <Link href="/auth" className={buttonClasses({ variant: 'ghost', size: 'lg' })}>
          Accedi
        </Link>
      </div>
    </section>
  );
}
