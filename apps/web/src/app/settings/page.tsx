'use client';

import React, { useState } from 'react';
import {
  Gear,
  Waveform,
  EyeSlash,
  Eye,
  SpeakerHigh,
  User,
  SealCheck,
  ShieldCheck,
  CheckCircle,
  FloppyDisk,
  LinkBreak,
} from '@phosphor-icons/react';
import { Sidebar } from '../../components/Sidebar';
import { ShareSongModal } from '../../components/ShareSongModal';

export default function SettingsPage() {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form states
  const [ghostMode, setGhostMode] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(true);
  const [audioQuality, setAudioQuality] = useState<'HIGH' | 'NORMAL'>('HIGH');
  const [displayName, setDisplayName] = useState('Franco Spagnati');
  const [bio, setBio] = useState('Appassionato di vinili, art-rock, psichedelia e produzioni analogiche. Ascolti scrobbati in tempo reale.');
  const [favoriteSpeed, setFavoriteSpeed] = useState<'33_RPM' | '45_RPM'>('33_RPM');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar onOpenCreatePost={() => setIsShareModalOpen(true)} />

      {/* 2. Main Content Area */}
      <main className="w-full flex-1 border-r border-om-border min-h-screen p-4 sm:p-8 space-y-8">
        {/* Header */}
          <div className="border-b border-om-border pb-4">
            <div className="flex items-center gap-2 text-om-amber text-xs font-mono mb-1">
              <Gear weight="fill" className="h-4 w-4" />
              <span>Preferenze & Connessioni</span>
            </div>
            <h1 className="font-editorial text-3xl font-bold text-om-text">
              Impostazioni dell'Account
            </h1>
            <p className="text-sm text-om-secondary mt-1">
              Gestisci la sincronizzazione streaming in tempo reale, la privacy e le tue preferenze analogiche.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-8">
            {/* 1. Connessione Spotify & Streaming */}
            <section className="rounded-2xl border border-om-border bg-om-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/30 text-[#1DB954]">
                    <Waveform weight="bold" className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-editorial text-lg font-bold text-om-text">
                      Spotify Streaming Connect
                    </h3>
                    <p className="text-xs text-om-secondary">
                      {spotifyConnected
                        ? 'Sincronizzazione in ascolto permanente attiva (@francospagnati)'
                        : 'Nessun account Spotify collegato'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSpotifyConnected(!spotifyConnected)}
                  className={`rounded-xl px-4 py-2 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                    spotifyConnected
                      ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-[#1DB954] text-black hover:bg-[#1DB954]/90'
                  }`}
                >
                  {spotifyConnected ? (
                    <>
                      <LinkBreak size={14} weight="bold" />
                      <span>Disconnetti</span>
                    </>
                  ) : (
                    <>
                      <Waveform size={14} weight="bold" />
                      <span>Connetti Spotify</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-om-border bg-om-bg/60 p-4 text-xs font-sans text-om-secondary space-y-1">
                <p className="font-semibold text-om-text">Come funziona la condivisione perenne:</p>
                <p>
                  Quando ascolti una traccia su Spotify, OpenMusic aggiorna automaticamente il tuo stato
                  nelle Stories dei tuoi amici senza che tu debba premere nulla. Puoi attivare la <strong>Ghost Mode</strong> in ogni momento per ascoltare in privato.
                </p>
              </div>
            </section>

            {/* 2. Privacy & Ghost Mode */}
            <section className="rounded-2xl border border-om-border bg-om-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                    ghostMode
                      ? 'bg-om-interactive border-om-border text-om-muted'
                      : 'bg-om-amber/10 border-om-amber/30 text-om-amber'
                  }`}>
                    {ghostMode ? <EyeSlash size={24} weight="bold" /> : <Eye size={24} weight="bold" />}
                  </div>
                  <div>
                    <h3 className="font-editorial text-lg font-bold text-om-text">
                      Ghost Mode (Ascolto Privato)
                    </h3>
                    <p className="text-xs text-om-secondary">
                      {ghostMode
                        ? 'Attiva: i tuoi amici vedono il tuo profilo come "In incognito"'
                        : 'Disattiva: i tuoi amici vedono cosa ascolti in diretta'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setGhostMode(!ghostMode)}
                  className={`rounded-full px-4 py-1.5 text-xs font-mono font-bold transition-all ${
                    ghostMode
                      ? 'bg-om-amber text-om-bg shadow-glow'
                      : 'border border-om-border bg-om-bg text-om-secondary hover:text-om-text'
                  }`}
                >
                  {ghostMode ? 'ATTIVA' : 'OFF'}
                </button>
              </div>
            </section>

            {/* 3. Qualità Audio Anteprime */}
            <section className="rounded-2xl border border-om-border bg-om-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-om-interactive border border-om-border text-om-amber">
                  <SpeakerHigh weight="duotone" className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-editorial text-lg font-bold text-om-text">
                    Qualità Audio Anteprime 30s
                  </h3>
                  <p className="text-xs text-om-secondary">
                    Bitrate per lo streaming delle anteprime audio in-app
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAudioQuality('HIGH')}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    audioQuality === 'HIGH'
                      ? 'border-om-amber bg-om-amber/10 text-om-text shadow-glow'
                      : 'border-om-border bg-om-bg text-om-secondary hover:border-om-secondary'
                  }`}
                >
                  <div className="font-mono text-sm font-bold">HQ 320 kbps (Consigliato)</div>
                  <div className="text-xs text-om-muted mt-1">Dettaglio audio fedele e trasparente per cuffie Hi-Fi</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAudioQuality('NORMAL')}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    audioQuality === 'NORMAL'
                      ? 'border-om-amber bg-om-amber/10 text-om-text shadow-glow'
                      : 'border-om-border bg-om-bg text-om-secondary hover:border-om-secondary'
                  }`}
                >
                  <div className="font-mono text-sm font-bold">Standard 160 kbps</div>
                  <div className="text-xs text-om-muted mt-1">Minor consumo dati su rete mobile</div>
                </button>
              </div>
            </section>

            {/* 4. Dati Profilo */}
            <section className="rounded-2xl border border-om-border bg-om-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-om-interactive border border-om-border text-om-text">
                  <User weight="duotone" className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-editorial text-lg font-bold text-om-text">
                    Profilo & Bio Analogica
                  </h3>
                  <p className="text-xs text-om-secondary">
                    Informazioni visibili agli altri amanti della musica
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-om-secondary mb-1">
                    Nome Visualizzato
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-om-border bg-om-bg px-3.5 py-2.5 text-sm text-om-text focus:border-om-amber focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-om-secondary mb-1">
                    Bio Personale
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-lg border border-om-border bg-om-bg px-3.5 py-2.5 text-sm text-om-text focus:border-om-amber focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-om-secondary mb-2">
                    Velocità Vinile Preferita (Estetica)
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-om-text">
                      <input
                        type="radio"
                        name="speed"
                        checked={favoriteSpeed === '33_RPM'}
                        onChange={() => setFavoriteSpeed('33_RPM')}
                        className="text-om-amber focus:ring-om-amber"
                      />
                      <span>33 Giri (LP Completo)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-om-text">
                      <input
                        type="radio"
                        name="speed"
                        checked={favoriteSpeed === '45_RPM'}
                        onChange={() => setFavoriteSpeed('45_RPM')}
                        className="text-om-amber focus:ring-om-amber"
                      />
                      <span>45 Giri (Singolo / EP)</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-4">
              {saved ? (
                <div className="flex items-center gap-2 text-om-fresh text-xs font-mono">
                  <CheckCircle weight="fill" className="h-4 w-4" />
                  <span>Impostazioni salvate con successo!</span>
                </div>
              ) : (
                <span className="text-xs font-mono text-om-muted">Modifiche non salvate</span>
              )}

              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans font-semibold px-6 py-3 text-sm transition-all shadow-glow hover:scale-[1.02]"
              >
                <FloppyDisk weight="bold" className="h-4 w-4" />
                <span>Salva Impostazioni</span>
              </button>
            </div>
          </form>
        </main>

        <ShareSongModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      </div>
    );
  }
