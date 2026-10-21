'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '../lib/api';

/**
 * A track the 30s preview player can play. When `previewUrl` is missing the player resolves it
 * through `GET /api/catalog/preview` (ADR-003: Deezer → iTunes) using `title`, `artist`, `isrc`.
 */
export interface PlayingTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string | null;
  previewUrl?: string | null;
  isrc?: string | null;
  releaseId?: string | null;
}

/**
 * - `resolving`: looking up the preview URL
 * - `loading`: URL known, audio buffering
 * - `unavailable`: no 30s preview exists for this track
 * - `blocked`: the browser refused to start audio without a user gesture
 */
export type PlayerStatus =
  'idle' | 'resolving' | 'loading' | 'playing' | 'paused' | 'unavailable' | 'blocked' | 'error';

interface AudioPlayerContextType {
  currentTrack: PlayingTrack | null;
  status: PlayerStatus;
  /** True while audio is actually playing. */
  isPlaying: boolean;
  /** True while the preview URL is being resolved or the audio is buffering. */
  isLoading: boolean;
  currentTime: number;
  duration: number;
  /** Plays a track, or toggles play/pause when it is already the current one. */
  playTrack: (track: PlayingTrack) => void;
  togglePlay: () => void;
  pause: () => void;
  stopTrack: () => void;
  seek: (seconds: number) => void;
  /** Resolves the preview URL and buffers the audio so a later `playTrack` starts instantly. */
  preload: (track: PlayingTrack) => void;
  /** Cached preview lookup; `null` when no preview exists. */
  resolvePreviewUrl: (track: PlayingTrack) => Promise<string | null>;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

const DEFAULT_PREVIEW_SECONDS = 30;
/** Buffered <audio> elements kept warm for upcoming tracks (reels look-ahead). */
const MAX_PRELOADED = 3;

function createAudio(): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = 'auto';
  return audio;
}

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<PlayingTrack | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(DEFAULT_PREVIEW_SECONDS);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const detachRef = useRef<AbortController | null>(null);
  const previewCache = useRef(new Map<string, Promise<string | null>>());
  const preloaded = useRef(new Map<string, HTMLAudioElement>());
  /** Incremented on every play request so stale async work is ignored. */
  const requestRef = useRef(0);
  const currentTrackRef = useRef<PlayingTrack | null>(null);
  currentTrackRef.current = currentTrack;

  const attach = useCallback((audio: HTMLAudioElement) => {
    detachRef.current?.abort();
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime), opts);
    audio.addEventListener(
      'loadedmetadata',
      () => setDuration(Number.isFinite(audio.duration) ? audio.duration : DEFAULT_PREVIEW_SECONDS),
      opts
    );
    audio.addEventListener('playing', () => setStatus('playing'), opts);
    audio.addEventListener('waiting', () => setStatus('loading'), opts);
    audio.addEventListener('pause', () => setStatus((s) => (s === 'playing' ? 'paused' : s)), opts);
    audio.addEventListener(
      'ended',
      () => {
        setStatus('paused');
        setCurrentTime(0);
        audio.currentTime = 0;
      },
      opts
    );
    audio.addEventListener('error', () => setStatus('error'), opts);
    detachRef.current = controller;
    audioRef.current = audio;
  }, []);

  useEffect(() => {
    attach(createAudio());
    const pool = preloaded.current;
    return () => {
      detachRef.current?.abort();
      audioRef.current?.pause();
      audioRef.current?.removeAttribute('src');
      pool.forEach((a) => a.removeAttribute('src'));
      pool.clear();
    };
  }, [attach]);

  const resolvePreviewUrl = useCallback((track: PlayingTrack): Promise<string | null> => {
    if (track.previewUrl) return Promise.resolve(track.previewUrl);
    const cached = previewCache.current.get(track.id);
    if (cached) return cached;
    const pending = api.catalog
      .preview({ title: track.title, artist: track.artist, isrc: track.isrc ?? undefined })
      .then((res) => res.previewUrl)
      .catch(() => {
        // Do not cache failures: a later attempt may succeed once the network is back.
        previewCache.current.delete(track.id);
        return null;
      });
    previewCache.current.set(track.id, pending);
    return pending;
  }, []);

  const preload = useCallback(
    (track: PlayingTrack) => {
      void resolvePreviewUrl(track).then((url) => {
        if (!url || preloaded.current.has(url) || audioRef.current?.src === url) return;
        const audio = createAudio();
        audio.src = url;
        audio.load();
        preloaded.current.set(url, audio);
        // Drop the oldest buffered element beyond the cap.
        while (preloaded.current.size > MAX_PRELOADED) {
          const oldest = preloaded.current.keys().next().value;
          if (oldest === undefined) break;
          preloaded.current.get(oldest)?.removeAttribute('src');
          preloaded.current.delete(oldest);
        }
      });
    },
    [resolvePreviewUrl]
  );

  const startPlayback = useCallback(
    async (url: string, request: number) => {
      const current = audioRef.current;
      const warm = preloaded.current.get(url);
      let audio = current;
      if (warm) {
        preloaded.current.delete(url);
        current?.pause();
        current?.removeAttribute('src');
        attach(warm);
        audio = warm;
        if (Number.isFinite(warm.duration)) setDuration(warm.duration);
      } else if (audio && audio.src !== url) {
        audio.src = url;
      }
      if (!audio) return;
      audio.currentTime = 0;
      setStatus(audio.readyState >= 3 ? 'playing' : 'loading');
      try {
        await audio.play();
      } catch (err) {
        if (request !== requestRef.current) return;
        const blocked = err instanceof DOMException && err.name === 'NotAllowedError';
        setStatus(blocked ? 'blocked' : 'error');
      }
    },
    [attach]
  );

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    audio.play().catch((err: unknown) => {
      const blocked = err instanceof DOMException && err.name === 'NotAllowedError';
      setStatus(blocked ? 'blocked' : 'error');
    });
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setStatus((s) => (s === 'playing' || s === 'loading' ? 'paused' : s));
  }, []);

  const playTrack = useCallback(
    (track: PlayingTrack) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (currentTrackRef.current?.id === track.id && status !== 'unavailable') {
        if (status === 'playing' || status === 'loading') pause();
        else if (status !== 'resolving') resume();
        return;
      }

      const request = ++requestRef.current;
      audio.pause();
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(DEFAULT_PREVIEW_SECONDS);
      setStatus(track.previewUrl ? 'loading' : 'resolving');

      void resolvePreviewUrl(track).then((url) => {
        if (request !== requestRef.current) return;
        if (!url) {
          setStatus('unavailable');
          return;
        }
        void startPlayback(url, request);
      });
    },
    [pause, resolvePreviewUrl, resume, startPlayback, status]
  );

  const togglePlay = useCallback(() => {
    if (!currentTrackRef.current) return;
    if (status === 'playing' || status === 'loading') pause();
    else if (status === 'paused' || status === 'blocked' || status === 'error') resume();
  }, [pause, resume, status]);

  const stopTrack = useCallback(() => {
    requestRef.current++;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setStatus('idle');
    setCurrentTime(0);
    setCurrentTrack(null);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    setCurrentTime(audio.currentTime);
  }, []);

  // Lock-screen / hardware media keys.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (!currentTrack) {
      session.metadata = null;
      return;
    }
    session.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: currentTrack.coverUrl ? [{ src: currentTrack.coverUrl }] : [],
    });
    session.setActionHandler('play', resume);
    session.setActionHandler('pause', pause);
    session.setActionHandler('stop', stopTrack);
    return () => {
      session.setActionHandler('play', null);
      session.setActionHandler('pause', null);
      session.setActionHandler('stop', null);
    };
  }, [currentTrack, pause, resume, stopTrack]);

  const value = useMemo<AudioPlayerContextType>(
    () => ({
      currentTrack,
      status,
      isPlaying: status === 'playing',
      isLoading: status === 'resolving' || status === 'loading',
      currentTime,
      duration,
      playTrack,
      togglePlay,
      pause,
      stopTrack,
      seek,
      preload,
      resolvePreviewUrl,
    }),
    [
      currentTrack,
      status,
      currentTime,
      duration,
      playTrack,
      togglePlay,
      pause,
      stopTrack,
      seek,
      preload,
      resolvePreviewUrl,
    ]
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
};

export const useAudioPlayer = (): AudioPlayerContextType => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};
