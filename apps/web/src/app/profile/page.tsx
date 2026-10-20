'use client';

import React, { useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { RightSidebar } from '../../components/RightSidebar';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import {
  User,
  SealCheck,
  Disc,
  Play,
  Pause,
  Star,
  Waveform,
  Calendar,
  ShareNetwork,
} from '@phosphor-icons/react';

const HEAVY_ROTATION_TRACKS = [
  {
    id: 'hr_1',
    title: 'Weird Fishes/Arpeggi',
    artist: 'Radiohead',
    album: 'In Rainbows',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&h=200&fit=crop',
    plays: 52,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'hr_2',
    title: 'Plastic Love',
    artist: 'Mariya Takeuchi',
    album: 'Variety',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
    plays: 44,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'hr_3',
    title: 'Get Lucky',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
    plays: 38,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'hr_4',
    title: 'Alison',
    artist: 'Slowdive',
    album: 'Souvlaki',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=200&h=200&fit=crop',
    plays: 31,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'hr_5',
    title: 'King Kunta',
    artist: 'Kendrick Lamar',
    album: 'To Pimp a Butterfly',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop',
    plays: 28,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'ROTATION' | 'REVIEWS' | 'PLAYLISTS'>('ROTATION');
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Center Column: User Profile */}
      <main className="w-full max-w-2xl flex-1 border-r border-om-border min-h-screen p-4 sm:p-6 space-y-8">
        {/* Profile Card Header */}
        <div className="rounded-2xl border border-om-border bg-om-card p-6 sm:p-8 space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop"
                alt="Franco Spagnati"
                className="h-20 w-20 rounded-full object-cover border-2 border-om-amber shadow-glow"
              />

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-editorial text-2xl font-bold text-om-text">
                    Franco Spagnati
                  </h1>
                  <SealCheck weight="fill" className="text-om-fresh h-5 w-5" aria-label="Ascolto Verificato" />
                </div>
                <p className="text-xs font-mono text-om-secondary">@francospagnati</p>
                <div className="flex items-center gap-1 text-[11px] font-mono text-[#1DB954] mt-1">
                  <Waveform weight="bold" className="h-3 w-3" />
                  <span>Connesso con Spotify</span>
                </div>
              </div>
            </div>

            <button className="rounded-xl border border-om-border bg-om-interactive px-4 py-2 text-xs font-mono font-semibold text-om-text hover:border-om-amber transition-colors">
              Modifica Profilo
            </button>
          </div>

          <p className="text-sm text-om-secondary leading-relaxed font-sans">
            Appassionato di vinili, art-rock, psichedelia e produzioni analogiche. Ascolti scrobbati
            in tempo reale e collezionati per passione.
          </p>

          {/* Social Stats */}
          <div className="flex items-center gap-6 border-t border-om-border/60 pt-4 text-xs font-mono">
            <div>
              <span className="font-bold text-om-text text-sm tabular-nums">412</span>
              <span className="text-om-secondary ml-1">Follower</span>
            </div>
            <div>
              <span className="font-bold text-om-text text-sm tabular-nums">188</span>
              <span className="text-om-secondary ml-1">Seguiti</span>
            </div>
            <div>
              <span className="font-bold text-om-amber text-sm tabular-nums">1.2k</span>
              <span className="text-om-secondary ml-1">Scrobble Verificati</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-4 border-b border-om-border pb-1">
          <button
            onClick={() => setActiveTab('ROTATION')}
            className={`font-sans text-sm font-bold pb-2 transition-colors relative ${
              activeTab === 'ROTATION'
                ? 'text-om-text'
                : 'text-om-secondary hover:text-om-text'
            }`}
          >
            <span>In Rotazione Pesante</span>
            {activeTab === 'ROTATION' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-om-amber" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('REVIEWS')}
            className={`font-sans text-sm font-bold pb-2 transition-colors relative ${
              activeTab === 'REVIEWS'
                ? 'text-om-text'
                : 'text-om-secondary hover:text-om-text'
            }`}
          >
            <span>Diario Recensioni</span>
            {activeTab === 'REVIEWS' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-om-amber" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('PLAYLISTS')}
            className={`font-sans text-sm font-bold pb-2 transition-colors relative ${
              activeTab === 'PLAYLISTS'
                ? 'text-om-text'
                : 'text-om-secondary hover:text-om-text'
            }`}
          >
            <span>Playlist Viniliche</span>
            {activeTab === 'PLAYLISTS' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-om-amber" />
            )}
          </button>
        </div>

        {/* Tab Content: In Rotazione Pesante */}
        {activeTab === 'ROTATION' && (
          <div className="space-y-3">
            <span className="text-xs font-mono text-om-muted uppercase tracking-wider block">
              Top 5 Tracce più ascoltate questo mese (Sincronizzate da Spotify):
            </span>

            <div className="divide-y divide-om-border/50 rounded-xl border border-om-border bg-om-card overflow-hidden">
              {HEAVY_ROTATION_TRACKS.map((t, idx) => {
                const isPlayingThis = currentTrack?.id === t.id && isPlaying;

                return (
                  <div
                    key={t.id}
                    onClick={() =>
                      playTrack({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        coverUrl: t.coverUrl,
                        previewUrl: t.previewUrl,
                      })
                    }
                    className="flex items-center justify-between p-3.5 hover:bg-om-interactive transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-5 font-mono text-sm font-bold text-om-amber tabular-nums">
                        #{idx + 1}
                      </span>
                      <img
                        src={t.coverUrl}
                        alt={t.title}
                        className="h-10 w-10 rounded-md object-cover border border-om-border flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-sans font-bold text-sm text-om-text truncate group-hover:text-om-amber transition-colors">
                          {t.title}
                        </h4>
                        <p className="text-xs text-om-secondary truncate">
                          {t.artist} • <span className="italic">{t.album}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-om-muted tabular-nums">
                        {t.plays} ascolti
                      </span>

                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-om-interactive group-hover:bg-om-amber group-hover:text-om-bg text-om-secondary transition-colors"
                        aria-label="Riproduci anteprima"
                      >
                        {isPlayingThis ? (
                          <Pause weight="fill" className="h-4 w-4" />
                        ) : (
                          <Play weight="fill" className="h-4 w-4 ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content: Diario Recensioni */}
        {activeTab === 'REVIEWS' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-om-border bg-om-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-editorial text-lg font-bold text-om-text">
                  In Rainbows — Radiohead
                </span>
                <span className="font-mono text-xs font-bold text-om-amber">★★★★★ 5.0</span>
              </div>
              <p className="text-xs text-om-secondary leading-relaxed">
                “Un disco che non invecchia mai. Weird Fishes e Reckoner rappresentano la perfezione
                sonora degli anni 2000.”
              </p>
            </div>
          </div>
        )}

        {/* Tab Content: Playlist Viniliche */}
        {activeTab === 'PLAYLISTS' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-om-border bg-om-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc weight="duotone" className="h-5 w-5 text-om-amber" />
                  <span className="font-editorial text-lg font-bold text-om-text">
                    Late Night Tokyo City Pop (Lato A / Lato B)
                  </span>
                </div>
                <span className="font-mono text-xs text-om-secondary">10 Tracce</span>
              </div>
              <p className="text-xs text-om-secondary">
                Arrangiamenti lussuosi, synth jazz-funk e calore analogico anni 80.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 3. Right Sidebar */}
      <RightSidebar />
    </div>
  );
}
