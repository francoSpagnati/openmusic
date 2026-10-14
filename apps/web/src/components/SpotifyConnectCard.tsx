'use client';

import React, { useState } from 'react';
import {
  Waveform,
  ArrowsClockwise,
  ShareNetwork,
  CheckCircle,
  Play,
  Pause,
  Disc,
} from '@phosphor-icons/react';

interface MockSpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
}

export const SpotifyConnectCard: React.FC = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedNotice, setSyncedNotice] = useState<string | null>(null);

  const [currentTrack, setCurrentTrack] = useState<MockSpotifyTrack>({
    id: 'sp_1',
    title: 'Weird Fishes/Arpeggi',
    artist: 'Radiohead',
    album: 'In Rainbows',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&h=120&fit=crop',
    progressMs: 142000,
    durationMs: 318000,
    isPlaying: true,
  });

  const heavyRotation = [
    { rank: 1, title: 'Plastic Love', artist: 'Mariya Takeuchi', plays: 48 },
    { rank: 2, title: 'Weird Fishes/Arpeggi', artist: 'Radiohead', plays: 42 },
    { rank: 3, title: 'Alison', artist: 'Slowdive', plays: 35 },
    { rank: 4, title: 'Pagan Poetry', artist: 'Björk', plays: 29 },
    { rank: 5, title: 'Never Meant', artist: 'American Football', plays: 24 },
  ];

  const handleSyncPlayback = () => {
    setIsSyncing(true);
    setSyncedNotice(null);

    setTimeout(() => {
      setIsSyncing(false);
      setSyncedNotice('Riproduzione sincronizzata in tempo reale nella Live Friends Bar!');
      setTimeout(() => setSyncedNotice(null), 4000);
    }, 800);
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = (currentTrack.progressMs / currentTrack.durationMs) * 100;

  return (
    <div className="rounded-2xl border border-om-border bg-om-card p-6 sm:p-8 space-y-6 shadow-2xl">
      {/* Header with Spotify Brand Green */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-om-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954]">
            <Waveform weight="bold" className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-editorial text-xl font-bold text-om-text">
                Integrazione Spotify
              </h3>
              <span className="text-[10px] font-mono text-[#1DB954] border border-[#1DB954]/40 bg-[#1DB954]/10 px-2 py-0.5 rounded-full font-semibold">
                OAuth2 Attivo
              </span>
            </div>
            <p className="text-xs text-om-secondary mt-0.5">
              Rilevamento Now Playing in tempo reale, scrobbling verificato e playlist export.
            </p>
          </div>
        </div>

        <button
          onClick={handleSyncPlayback}
          disabled={isSyncing}
          className="flex items-center gap-2 rounded-lg bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-sans font-semibold text-xs px-4 py-2.5 transition-all shadow-sm hover:scale-[1.02] active:scale-95 disabled:opacity-50 self-start sm:self-auto"
        >
          <ArrowsClockwise weight="bold" className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizzazione...' : 'Sincronizza Riproduzione'}</span>
        </button>
      </div>

      {syncedNotice && (
        <div className="rounded-lg border border-om-fresh/40 bg-om-fresh/10 px-4 py-2.5 text-xs font-mono text-om-fresh flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle weight="fill" className="h-4 w-4 flex-shrink-0" />
          <span>{syncedNotice}</span>
        </div>
      )}

      {/* Currently Playing Live Widget */}
      <div className="rounded-xl border border-om-border bg-om-bg p-4 sm:p-5">
        <span className="text-xs font-mono uppercase tracking-wider text-om-muted block mb-3">
          In Riproduzione sul tuo Account Spotify:
        </span>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden border border-om-border">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-4">
                  <span className="w-1 bg-[#1DB954] h-full animate-pulse" />
                  <span className="w-1 bg-[#1DB954] h-2/3 animate-pulse" />
                  <span className="w-1 bg-[#1DB954] h-4/5 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <h4 className="font-editorial text-base font-bold text-om-text truncate">
                {currentTrack.title}
              </h4>
              <p className="text-xs text-om-secondary truncate mt-0.5">
                {currentTrack.artist} • <span className="italic">{currentTrack.album}</span>
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-om-fresh mt-1">
                <CheckCircle weight="fill" className="h-3 w-3" />
                <span>Eleggibile per Ascolto Verificato (&gt; 30s)</span>
              </span>
            </div>
          </div>

          <div className="w-full sm:w-64 space-y-1.5 self-center">
            <div className="h-1.5 w-full bg-om-interactive rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1DB954] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-om-secondary tabular-nums">
              <span>{formatTime(currentTrack.progressMs)}</span>
              <span>{formatTime(currentTrack.durationMs)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heavy Rotation (Top 5 Short Term from Spotify) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="font-editorial text-lg font-bold text-om-text">
            In Rotazione Pesante (Top 5 da Spotify)
          </h4>
          <span className="text-[11px] font-mono text-om-muted">
            Aggiornato automaticamente via API
          </span>
        </div>

        <div className="divide-y divide-om-border/50 rounded-xl border border-om-border bg-om-bg overflow-hidden">
          {heavyRotation.map((item) => (
            <div
              key={item.rank}
              className="flex items-center justify-between px-4 py-3 hover:bg-om-card transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 font-mono text-xs font-bold text-om-amber tabular-nums">
                  #{item.rank}
                </span>
                <div>
                  <h5 className="font-sans text-sm font-semibold text-om-text">{item.title}</h5>
                  <p className="text-xs text-om-secondary">{item.artist}</p>
                </div>
              </div>

              <span className="text-xs font-mono text-om-muted tabular-nums">
                {item.plays} ascolti
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
