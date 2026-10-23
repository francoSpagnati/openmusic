'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowClockwise, MagnifyingGlass } from '@phosphor-icons/react';
import type { GenreRouletteResult } from '@openmusic/shared';
import { api, isApiError } from '../lib/api';
import { Button, ErrorState, cn } from './ui';
import { PreviewPlayButton } from './discovery/PreviewPlayButton';
import { toPlayingTrack } from './discovery/ReleasePreviewButton';

type RouletteState =
  | { kind: 'idle' }
  | { kind: 'spinning'; previous: GenreRouletteResult | null }
  | { kind: 'result'; result: GenreRouletteResult }
  | { kind: 'error'; message: string; previous: GenreRouletteResult | null };

/**
 * "Fuori dalla bolla": asks the API for a genre outside the listener's history and three
 * starter tracks with 30s previews. The disc spins only while the request is in flight.
 */
export const GenreRouletteInteractive: React.FC = () => {
  const [state, setState] = useState<RouletteState>({ kind: 'idle' });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const shown =
    state.kind === 'result' ? state.result : state.kind === 'idle' ? null : state.previous;
  const spinning = state.kind === 'spinning';

  const spin = async () => {
    setState({ kind: 'spinning', previous: shown });
    try {
      const result = await api.discovery.roulette();
      setState({ kind: 'result', result });
      // Move focus to the new genre so keyboard and screen-reader users land on the result.
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (err) {
      setState({
        kind: 'error',
        previous: shown,
        message:
          isApiError(err) && err.status === 0
            ? 'Sei offline o il server non risponde.'
            : 'Riprova tra qualche secondo.',
      });
    }
  };

  return (
    <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
      <div className="flex flex-col items-center gap-6">
        {/* The record turns slowly only while the request is in flight; still otherwise. */}
        <div
          aria-hidden="true"
          className={cn(
            'om-grooves aspect-square w-36 transition-opacity duration-slow sm:w-48',
            spinning ? 'om-spin-record opacity-100' : 'opacity-90'
          )}
          style={spinning ? { animationDuration: '4.8s' } : undefined}
        />
        <Button
          onClick={() => void spin()}
          loading={spinning}
          loadingLabel="La roulette gira…"
          leadingIcon={<ArrowClockwise />}
        >
          {shown ? 'Gira ancora' : 'Gira la roulette'}
        </Button>
      </div>

      <div className="min-w-0 space-y-5" aria-live="polite" aria-busy={spinning}>
        <p id="roulette-title" className="om-eyebrow">
          Roulette dei generi
        </p>

        {state.kind === 'error' && (
          <ErrorState
            variant="inline"
            title="La roulette si è inceppata"
            description={state.message}
            onRetry={() => void spin()}
          />
        )}

        {shown ? (
          <RouletteResult result={shown} headingRef={headingRef} dimmed={spinning} />
        ) : (
          state.kind !== 'error' && (
            <div className="max-w-prose space-y-2">
              <h3 className="om-headline text-2xl text-fg sm:text-3xl">Esci dai soliti solchi</h3>
              <p className="text-fg-muted">
                Scegliamo un genere lontano da quello che ascolti di solito e ti diamo tre brani per
                entrarci con un’anteprima di 30 secondi.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

function RouletteResult({
  result,
  headingRef,
  dimmed,
}: {
  result: GenreRouletteResult;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  dimmed: boolean;
}) {
  return (
    <div
      key={result.genre}
      className={cn('om-fade space-y-5 transition-opacity duration-base', dimmed && 'opacity-50')}
    >
      <div className="max-w-prose space-y-2">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="om-headline text-4xl text-fg focus:outline-none"
        >
          {result.genre}
        </h3>
        <p className="om-deck text-lg">{result.tagline}</p>
        {result.context && <p className="text-sm text-fg-muted">{result.context}</p>}
      </div>

      <div>
        <h4 className="om-eyebrow mb-1">Tre brani per cominciare</h4>
        <ol className="border-t border-line">
          {result.starterTracks.map((track, index) => (
            <li key={track.id} className="flex items-center gap-3 border-b border-line px-1 py-2.5">
              <span className="w-5 text-right font-mono text-sm tabular-nums text-fg-subtle">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] text-fg">{track.title}</p>
                <p className="truncate text-sm text-fg-muted">{track.artistName}</p>
              </div>
              <Link
                href={`/explore?q=${encodeURIComponent(track.artistName)}`}
                className="hidden rounded-sm p-1 text-fg-subtle hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:inline-flex"
                aria-label={`Cerca ${track.artistName} nel catalogo`}
                title={`Cerca ${track.artistName} nel catalogo`}
              >
                <MagnifyingGlass aria-hidden="true" className="h-4 w-4" />
              </Link>
              <PreviewPlayButton
                track={toPlayingTrack(track)}
                size="sm"
                variant="subtle"
                shape="round"
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
