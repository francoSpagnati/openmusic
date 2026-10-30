import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  clearPreloadedSource,
  preload,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import {
  previewResolver,
  type PreviewResolver,
  type PreviewTrack,
  type ResolvedPreview,
} from './preview';

/** What a play button shows for one track. */
export type PreviewState = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable' | 'error';

interface Current {
  key: string;
  phase: 'resolving' | 'ready' | 'unavailable' | 'error';
  source: ResolvedPreview['source'] | null;
}

export interface PreviewPlayerApi {
  /** Key (track id) of the track loaded in the player, if any. */
  currentKey: string | null;
  stateOf(trackId: string): PreviewState;
  /** Where the current clip comes from (Deezer, iTunes, ...). */
  currentSource: ResolvedPreview['source'] | null;
  /** 0..1 progress of the current clip. */
  progress: number;
  play(track: PreviewTrack): Promise<void>;
  /** Play, pause or resume `track`. */
  toggle(track: PreviewTrack): void;
  pause(): void;
  stop(): void;
  /** Resolve and buffer these clips ahead of time; evicts clips buffered for older windows. */
  prebuffer(tracks: PreviewTrack[]): void;
}

const PreviewPlayerContext = createContext<PreviewPlayerApi | null>(null);

/** Seconds of audio buffered ahead for the next clips: a 30s preview loads almost entirely. */
const PREBUFFER_SECONDS = 15;

let audioModeSet = false;

function ensureAudioMode(): void {
  if (audioModeSet) return;
  audioModeSet = true;
  // Previews must be audible with the ring/silent switch on (iOS); stop in background.
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {
    audioModeSet = false;
  });
}

export interface PreviewPlayerProviderProps {
  children: React.ReactNode;
  /** Loop the clip (Reels) instead of stopping at the end. */
  loop?: boolean;
  /** Injected in tests. */
  resolver?: PreviewResolver;
}

/**
 * One expo-audio player per screen for 30s previews. Stops when the screen loses focus or the app
 * goes to the background; a newer `play()` always wins over a slower, older one.
 */
export function PreviewPlayerProvider({
  children,
  loop = false,
  resolver = previewResolver,
}: PreviewPlayerProviderProps) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<Current | null>(null);
  const requestId = useRef(0);
  const buffered = useRef(new Set<string>());
  const playingUrl = useRef<string | null>(null);

  useEffect(() => {
    player.loop = loop;
  }, [player, loop]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const stop = useCallback(() => {
    requestId.current += 1;
    player.pause();
    setCurrent(null);
  }, [player]);

  const play = useCallback(
    async (track: PreviewTrack) => {
      ensureAudioMode();
      const id = ++requestId.current;
      player.pause();
      setCurrent({ key: track.id, phase: 'resolving', source: null });
      try {
        const preview = await resolver.resolve(track);
        if (id !== requestId.current) return;
        if (!preview.url) {
          setCurrent({ key: track.id, phase: 'unavailable', source: preview.source });
          return;
        }
        playingUrl.current = preview.url;
        player.replace({ uri: preview.url });
        player.play();
        setCurrent({ key: track.id, phase: 'ready', source: preview.source });
      } catch {
        if (id === requestId.current) setCurrent({ key: track.id, phase: 'error', source: null });
      }
    },
    [player, resolver]
  );

  const stateOf = useCallback(
    (trackId: string): PreviewState => {
      if (!current || current.key !== trackId) return 'idle';
      switch (current.phase) {
        case 'resolving':
          return 'loading';
        case 'unavailable':
          return 'unavailable';
        case 'error':
          return 'error';
        case 'ready':
          // A dead link (expired URL, offline) surfaces as the button's retry state.
          if (status.playbackState === 'error') return 'error';
          if (status.playing) return 'playing';
          return status.isBuffering || !status.isLoaded ? 'loading' : 'paused';
      }
    },
    [current, status.playing, status.playbackState, status.isBuffering, status.isLoaded]
  );

  const toggle = useCallback(
    (track: PreviewTrack) => {
      const state = stateOf(track.id);
      if (state === 'playing' || state === 'loading') {
        if (state === 'loading' && current?.phase === 'resolving') stop();
        else pause();
        return;
      }
      if (state === 'paused') {
        if (status.duration > 0 && status.currentTime >= status.duration - 0.25) {
          void player.seekTo(0);
        }
        player.play();
        return;
      }
      void play(track);
    },
    [stateOf, current, stop, pause, play, player, status.duration, status.currentTime]
  );

  const prebuffer = useCallback(
    (tracks: PreviewTrack[]) => {
      // Free clips buffered for reels the listener already scrolled past (never the playing one).
      const keep = new Set<string>();
      if (playingUrl.current) keep.add(playingUrl.current);
      for (const track of tracks) {
        const known = resolver.peek(track);
        if (known?.url) keep.add(known.url);
      }
      for (const url of Array.from(buffered.current)) {
        if (keep.has(url)) continue;
        buffered.current.delete(url);
        clearPreloadedSource({ uri: url }).catch(() => undefined);
      }

      for (const track of tracks) {
        resolver
          .resolve(track)
          .then(({ url }) => {
            if (!url || buffered.current.has(url)) return;
            buffered.current.add(url);
            preload({ uri: url }, { preferredForwardBufferDuration: PREBUFFER_SECONDS }).catch(
              () => {
                buffered.current.delete(url);
              }
            );
          })
          .catch(() => undefined);
      }
    },
    [resolver]
  );

  // Leaving the screen or the app stops the clip.
  useFocusEffect(
    useCallback(() => {
      return () => stop();
    }, [stop])
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  const value = useMemo<PreviewPlayerApi>(
    () => ({
      currentKey: current?.key ?? null,
      currentSource: current?.source ?? null,
      stateOf,
      progress: current?.phase === 'ready' ? progress : 0,
      play,
      toggle,
      pause,
      stop,
      prebuffer,
    }),
    [current, stateOf, progress, play, toggle, pause, stop, prebuffer]
  );

  return <PreviewPlayerContext.Provider value={value}>{children}</PreviewPlayerContext.Provider>;
}

export function usePreviewPlayer(): PreviewPlayerApi {
  const ctx = useContext(PreviewPlayerContext);
  if (!ctx) throw new Error('usePreviewPlayer must be used inside <PreviewPlayerProvider>');
  return ctx;
}
