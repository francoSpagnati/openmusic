'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plus, VideoCamera } from '@phosphor-icons/react';
import type { MusicVideoItem, VideoCategory } from '@openmusic/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, EmptyState, ErrorState, Skeleton, cn } from '../../components/ui';
import { plural } from '../../components/discovery/format';
import { PublishVideoDialog } from './PublishVideoDialog';
import { VideoCard } from './VideoCard';
import { VIDEO_CATEGORIES } from './videoMeta';

const PUBLISHER_ROLES = new Set(['CRITIC', 'MODERATOR', 'ADMIN']);

type FeedState =
  | { status: 'loading'; videos: MusicVideoItem[] }
  | { status: 'ready'; videos: MusicVideoItem[] }
  | { status: 'error'; videos: MusicVideoItem[] };

export function VideosClient({ initialVideos }: { initialVideos: MusicVideoItem[] | null }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<VideoCategory | null>(null);
  const [feed, setFeed] = useState<FeedState>(
    initialVideos ? { status: 'ready', videos: initialVideos } : { status: 'error', videos: [] }
  );
  const [token, setToken] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const firstRun = useRef(initialVideos !== null);
  const canPublish = user ? PUBLISHER_ROLES.has(user.role) : false;

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let cancelled = false;
    setFeed((f) => ({ status: 'loading', videos: f.videos }));
    api.videos
      .feed(category ?? undefined)
      .then((videos) => !cancelled && setFeed({ status: 'ready', videos }))
      .catch(() => !cancelled && setFeed((f) => ({ status: 'error', videos: f.videos })));
    return () => {
      cancelled = true;
    };
  }, [category, token]);

  const filters: Array<{ value: VideoCategory | null; label: string }> = [
    { value: null, label: 'Tutti' },
    ...VIDEO_CATEGORIES.map((c) => ({ value: c.value, label: c.plural })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div
          role="group"
          aria-label="Filtra per tipo di video"
          className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <div className="flex w-max gap-2">
            {filters.map((f) => {
              const active = f.value === category;
              return (
                <button
                  key={f.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(f.value)}
                  className={cn(
                    'h-9 rounded-full border px-3.5 text-sm transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    active
                      ? 'border-fg bg-fg font-medium text-canvas'
                      : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        {canPublish && (
          <Button
            size="sm"
            leadingIcon={<Plus weight="bold" />}
            onClick={() => setPublishing(true)}
          >
            Pubblica un video
          </Button>
        )}
      </div>

      <p role="status" className="text-sm text-fg-subtle">
        {feed.status === 'loading'
          ? 'Carico i video…'
          : feed.status === 'ready'
            ? plural(feed.videos.length, 'video', 'video')
            : ''}
      </p>

      {feed.status === 'error' ? (
        <ErrorState
          title="I video non sono arrivati"
          description="Il server non ha risposto. Riprova tra un attimo."
          onRetry={() => setToken((t) => t + 1)}
        />
      ) : feed.status === 'loading' && feed.videos.length === 0 ? (
        <div aria-busy="true" className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full" />
              <div className="space-y-2">
                <Skeleton shape="text" lines={2} />
              </div>
            </div>
          ))}
        </div>
      ) : feed.videos.length === 0 ? (
        <EmptyState
          icon={<VideoCamera />}
          title={category ? 'Nessun video in questa categoria' : 'La videoteca è ancora vuota'}
          description={
            canPublish
              ? 'Pubblica il primo approfondimento: comparirà anche nella scheda del disco collegato.'
              : 'La critica accreditata sta selezionando i primi approfondimenti. Torna presto.'
          }
          action={
            category ? (
              <Button variant="outline" onClick={() => setCategory(null)}>
                Mostra tutti i video
              </Button>
            ) : canPublish ? (
              <Button onClick={() => setPublishing(true)}>Pubblica un video</Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className={cn(
            'om-stagger grid gap-x-6 gap-y-10 transition-opacity duration-base sm:grid-cols-2 xl:grid-cols-3',
            feed.status === 'loading' && 'opacity-60'
          )}
        >
          {feed.videos.map((video, i) => (
            <li key={video.id}>
              <VideoCard video={video} priority={i < 2} />
            </li>
          ))}
        </ul>
      )}

      {canPublish && (
        <PublishVideoDialog
          open={publishing}
          onClose={() => setPublishing(false)}
          onPublished={(video) => {
            if (category === null || category === video.category) {
              setFeed((f) => ({ status: 'ready', videos: [video, ...f.videos] }));
            }
          }}
        />
      )}
    </div>
  );
}
