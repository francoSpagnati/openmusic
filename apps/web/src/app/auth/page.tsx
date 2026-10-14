'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Disc,
  Waveform,
  User,
  EnvelopeSimple,
  LockKey,
  CheckCircle,
  Sparkle,
  ArrowRight,
} from '@phosphor-icons/react';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'REGISTER' | 'LOGIN'>('REGISTER');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Art Rock', 'Indie']);
  const [success, setSuccess] = useState(false);

  const GENRES = [
    'Art Rock',
    'Post-Punk',
    'Psichedelia',
    'Electronic / IDM',
    'Jazz / Fusion',
    'Hip-Hop Classico',
    'Shoegaze',
    'Ambient',
    'Folk Analogico',
  ];

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    // Simulate auth & save session to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'openmusic_session',
        JSON.stringify({
          username: username || 'francospagnati',
          email: email || 'franco@openmusic.social',
          token: 'jwt_mock_openmusic_' + Date.now(),
          genres: selectedGenres,
        })
      );
    }

    setTimeout(() => {
      router.push('/');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-om-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-om-card border border-om-border group-hover:border-om-amber transition-colors shadow-analog">
            <Disc weight="duotone" className="h-8 w-8 text-om-amber animate-[spin_10s_linear_infinite]" />
            <div className="absolute h-3 w-3 rounded-full bg-om-bg" />
          </div>
          <span className="font-editorial text-3xl font-bold tracking-tight text-om-text">
            OpenMusic
          </span>
        </Link>
        <p className="text-sm font-sans text-om-secondary">
          {mode === 'REGISTER'
            ? 'Crea il tuo profilo musicale e connettiti con veri amanti del vinile'
            : 'Accedi per riprendere gli ascolti in tempo reale'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-om-border bg-om-card p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-om-bg p-1 border border-om-border">
            <button
              type="button"
              onClick={() => setMode('REGISTER')}
              className={`rounded-lg py-2 text-xs font-mono font-semibold transition-all ${
                mode === 'REGISTER'
                  ? 'bg-om-card text-om-amber shadow-sm'
                  : 'text-om-secondary hover:text-om-text'
              }`}
            >
              Registrati
            </button>
            <button
              type="button"
              onClick={() => setMode('LOGIN')}
              className={`rounded-lg py-2 text-xs font-mono font-semibold transition-all ${
                mode === 'LOGIN'
                  ? 'bg-om-card text-om-amber shadow-sm'
                  : 'text-om-secondary hover:text-om-text'
              }`}
            >
              Accedi
            </button>
          </div>

          {/* Quick Spotify OAuth Register */}
          <button
            type="button"
            onClick={() => {
              alert('Reindirizzamento su Spotify Accounts per sincronizzazione istantanea...');
            }}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-sans font-bold py-3 text-sm transition-all shadow-md hover:scale-[1.01]"
          >
            <Waveform weight="bold" className="h-5 w-5" />
            <span>Continua con Spotify</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-om-border w-full" />
            <span className="bg-om-card px-3 text-[11px] font-mono text-om-muted uppercase">oppure via email</span>
          </div>

          {success ? (
            <div className="rounded-xl border border-om-fresh/40 bg-om-fresh/10 p-6 text-center space-y-3">
              <CheckCircle weight="fill" className="h-12 w-12 text-om-fresh mx-auto" />
              <h3 className="font-editorial text-xl font-bold text-om-text">
                {mode === 'REGISTER' ? 'Benvenuto in OpenMusic!' : 'Accesso effettuato!'}
              </h3>
              <p className="text-xs text-om-secondary">
                Caricamento del tuo feed musicale in corso...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'REGISTER' && (
                <div>
                  <label className="block text-xs font-mono text-om-secondary mb-1">
                    Username Univoco *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-4 w-4 text-om-muted" />
                    <input
                      type="text"
                      required
                      placeholder="es. francospagnati"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-om-border bg-om-bg pl-10 pr-3.5 py-2.5 text-sm text-om-text placeholder-om-muted focus:border-om-amber focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-om-secondary mb-1">
                  Email *
                </label>
                <div className="relative">
                  <EnvelopeSimple className="absolute left-3.5 top-3 h-4 w-4 text-om-muted" />
                  <input
                    type="email"
                    required
                    placeholder="nome@dominio.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-om-border bg-om-bg pl-10 pr-3.5 py-2.5 text-sm text-om-text placeholder-om-muted focus:border-om-amber focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-om-secondary mb-1">
                  Password *
                </label>
                <div className="relative">
                  <LockKey className="absolute left-3.5 top-3 h-4 w-4 text-om-muted" />
                  <input
                    type="password"
                    required
                    placeholder="Minimo 8 caratteri"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-om-border bg-om-bg pl-10 pr-3.5 py-2.5 text-sm text-om-text placeholder-om-muted focus:border-om-amber focus:outline-none"
                  />
                </div>
              </div>

              {mode === 'REGISTER' && (
                <div className="space-y-2 pt-2 border-t border-om-border/50">
                  <label className="block text-xs font-mono text-om-secondary">
                    I tuoi generi preferiti (per calibrare l'algoritmo)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRES.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-mono transition-colors ${
                            isSelected
                              ? 'bg-om-amber text-om-bg font-bold'
                              : 'border border-om-border bg-om-bg text-om-secondary hover:text-om-text'
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans font-semibold py-3 text-sm transition-all shadow-glow hover:scale-[1.01]"
              >
                <span>{mode === 'REGISTER' ? 'Crea Account Gratuito' : 'Accedi a OpenMusic'}</span>
                <ArrowRight weight="bold" className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
