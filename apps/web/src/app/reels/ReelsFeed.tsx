'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Compass, Waveform } from '@phosphor-icons/react';
import type { DiscoveryReelItem } from '@openmusic/shared';
import { api } from '../../lib/api';
import { useAudioPlayer, type PlayingTrack } from '../../context/AudioPlayerContext';
import {
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  buttonClasses,
  useToast,
} from '../../components/ui';
import { toPlayingTrack } from '../../components/discovery/ReleasePreviewButton';
import { ReelSlide } from './ReelSlide';
import { useActiveSnapIndex } from './useActiveSnapIndex';

type FeedState =
  { status: 'loading' } | { status: 'ready'; items: DiscoveryReelItem[] } | { status: 'error' };

const NO_ITEMS: DiscoveryReelItem[] = [];

/** How many reels ahead get their preview resolved and buffered. */
const LOOKAHEAD = 2;

const reelTrack = (item: DiscoveryReelItem): PlayingTrack =>
  toPlayingTrack(item.track, { coverUrl: item.release.coverUrl, releaseId: item.release.id });

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Vertical, snap-scrolling feed of 30s previews (ARIA feed pattern). The first play needs a tap
 * (browser autoplay rules); after that each reel starts when it snaps into place, and the next
 * reels are pre-buffered so playback starts without a gap.
 */
export function ReelsFeed() {
  const [feed, setFeed] = useState<FeedState>({ status: 'loading' });
  const [token, setToken] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notify } = useToast();
  const { currentTrack, status, playTrack, preload } = useAudioPlayer();

  useEffect(() => {
    let cancelled = false;
    setFeed({ status: 'loading' });
    api.discovery
      .reels()
      .then((res) => !cancelled && setFeed({ status: 'ready', items: res.items }))
      .catch(() => !cancelled && setFeed({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const items = feed.status === 'ready' ? feed.items : NO_ITEMS;
  // +1: the closing "end of side B" card is a snap target too.
  const active = useActiveSnapIndex(
    containerRef,
    feed.status === 'ready' ? items.length + 1 : 0,
    feed
  );
  const player = useRef({ currentTrack, playTrack });
  player.current = { currentTrack, playTrack };

  // Pre-buffer the current reel and the next ones.
  useEffect(() => {
    for (let i = active; i <= Math.min(items.length - 1, active + LOOKAHEAD); i++) {
      const item = items[i];
      if (item) preload(reelTrack(item));
    }
  }, [active, items, preload]);

  // Once the listener opted in, the snapped reel plays by itself.
  useEffect(() => {
    const item = items[active];
    if (!autoplay || !item) return;
    // Read the player through a ref: react to the reel changing, not to every player update.
    const { currentTrack: playingNow, playTrack: play } = player.current;
    if (playingNow?.id !== item.track.id) play(reelTrack(item));
  }, [active, autoplay, items]);

  // Closing the player bar turns autoplay off again.
  useEffect(() => {
    if (status === 'idle') setAutoplay(false);
  }, [status]);

  const scrollTo = useCallback((index: number) => {
    const root = containerRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-snap-index="${index}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const fromControl = (event.target as HTMLElement).closest('button, a, input');
    const next = ['ArrowDown', 'PageDown', 'j'].includes(event.key);
    const prev = ['ArrowUp', 'PageUp', 'k'].includes(event.key);
    if (next || prev) {
      event.preventDefault();
      scrollTo(Math.max(0, Math.min(items.length, active + (next ? 1 : -1))));
    } else if (event.key === ' ' && !fromControl) {
      event.preventDefault();
      const item = items[active];
      if (item) {
        setAutoplay(true);
        playTrack(reelTrack(item));
      }
    }
  };

  const share = async (item: DiscoveryReelItem) => {
    const url = `${window.location.origin}/releases/${item.release.id}`;
    const title = `${item.release.title} di ${item.release.artistName}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Ascolta ${item.track.title} su OpenMusic`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify({ title: 'Link copiato', description: title, tone: 'success' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      notify({ title: 'Non riesco a condividere', description: url, tone: 'error' });
    }
  };

  if (feed.status === 'loading') {
    return (
      <div
        aria-busy="true"
        className="flex h-full flex-col items-center gap-5 pb-24 sm:justify-center"
      >
        <span className="sr-only">Caricamento dei reels…</span>
        <Skeleton
          shape="cover"
          className="w-full max-w-[min(100%,48dvh)] sm:max-w-[min(100%,52dvh)]"
        />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  if (feed.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <ErrorState
          title="I reels non sono partiti"
          description="Il server non ha risposto. Controlla la connessione e riprova."
          onRetry={() => setToken((t) => t + 1)}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <EmptyState
          title="Nessun brano da far girare"
          description="Il catalogo è ancora vuoto. Cerca un artista: ogni ricerca aggiunge dischi."
          action={
            <Link href="/explore" className={buttonClasses()}>
              Esplora il catalogo
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        role="feed"
        aria-label="Reels: anteprime da 30 secondi. Frecce o J e K per scorrere, spazio per ascoltare."
        aria-busy={false}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain focus-visible:outline-none [scrollbar-width:none]"
      >
        {items.map((item, index) => (
          <ReelSlide
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            active={index === active}
            near={Math.abs(index - active) <= 1}
            onPlay={() => {
              setAutoplay(true);
              playTrack(reelTrack(item));
            }}
            onShare={() => void share(item)}
            hint={
              index === 0 && !autoplay
                ? 'Premi play una volta: poi ogni reel parte da solo.'
                : undefined
            }
          />
        ))}
        <article
          data-snap-index={items.length}
          tabIndex={-1}
          aria-posinset={items.length + 1}
          aria-setsize={items.length + 1}
          aria-labelledby="reels-end-title"
          className="flex h-full snap-start flex-col items-center justify-center gap-4 px-6 pb-24 text-center focus-visible:outline-none"
        >
          <span aria-hidden="true" className="om-grooves h-20 w-20 opacity-80" />
          <h2 id="reels-end-title" className="om-headline text-3xl text-fg">
            Fine del lato B
          </h2>
          <p className="max-w-sm text-fg-muted">
            Hai ascoltato tutti i reels per ora. Gira il disco o vai a cercare il prossimo da solo.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setToken((t) => t + 1);
                containerRef.current?.scrollTo({ top: 0 });
              }}
              className={buttonClasses({ variant: 'outline' })}
            >
              <Waveform aria-hidden="true" /> Ricomincia
            </button>
            <Link href="/explore" className={buttonClasses()}>
              <Compass aria-hidden="true" /> Esplora il catalogo
            </Link>
          </div>
        </article>
      </div>

      {/* Desktop steppers; on touch the swipe is the control */}
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <IconButton
          label="Reel precedente"
          icon={<ArrowUp />}
          variant="subtle"
          shape="round"
          disabled={active === 0}
          onClick={() => scrollTo(active - 1)}
        />
        <IconButton
          label="Reel successivo"
          icon={<ArrowDown />}
          variant="subtle"
          shape="round"
          disabled={active >= items.length}
          onClick={() => scrollTo(active + 1)}
        />
      </div>
    </div>
  );
}
