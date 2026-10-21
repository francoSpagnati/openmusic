'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowClockwise, MagnifyingGlass, Sparkle } from '@phosphor-icons/react';
import type { GenreRouletteResult } from '@openmusic/shared';
import { api, isApiError } from '../lib/api';
import { Button, Card, ErrorState, cn } from './ui';
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
    <Card variant="sleeve" padding="lg" as="section" aria-labelledby="roulette-title">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div
            aria-hidden="true"
            className={cn(
              'om-grooves aspect-square w-40 shadow-om-md sm:w-52',
              spinning
                ? 'om-spin-record'
                : 'rotate-12 transition-transform duration-slow ease-tonearm'
            )}
          />
          <Button
            onClick={() => void spin()}
            loading={spinning}
            loadingLabel="La roulette gira…"
            leadingIcon={<ArrowClockwise weight="bold" />}
            size="lg"
          >
            {shown ? 'Gira ancora' : 'Gira la roulette'}
          </Button>
        </div>

        <div className="min-w-0 space-y-4" aria-live="polite" aria-busy={spinning}>
          <p className="om-eyebrow flex items-center gap-2 text-accent">
            <Sparkle weight="duotone" aria-hidden="true" className="h-4 w-4" />
            <span id="roulette-title">Roulette dei generi · fuori dalla bolla</span>
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
              <div className="space-y-2">
                <h3 className="om-headline text-2xl text-ink sm:text-3xl">
                  Esci dai soliti solchi
                </h3>
                <p className="text-sm text-ink-secondary">
                  Scegliamo un genere lontano da quello che ascolti di solito e ti diamo tre brani
                  per entrarci con un’anteprima di 30 secondi.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </Card>
  );
};

function RouletteResult({
  result,
  headingRef,
  dimmed,
}: {
  result: GenreRouletteResult;
  headingRef: React.RefObject<HTMLHeadingElement>;
  dimmed: boolean;
}) {
  return (
    <div className={cn('space-y-4 transition-opacity duration-base', dimmed && 'opacity-50')}>
      <div className="space-y-1.5">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="om-headline text-3xl text-ink focus:outline-none"
        >
          {result.genre}
        </h3>
        <p className="om-deck text-lg">{result.tagline}</p>
        {result.context && <p className="text-sm text-ink-secondary">{result.context}</p>}
      </div>

      <div>
        <h4 className="om-eyebrow mb-2">Starter pack · 3 brani</h4>
        <ol className="divide-y divide-line rounded-md border border-line bg-sunken">
          {result.starterTracks.map((track, index) => (
            <li key={track.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 font-mono text-xs tabular-nums text-ink-muted">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{track.title}</p>
                <p className="truncate text-xs text-ink-secondary">{track.artistName}</p>
              </div>
              <Link
                href={`/explore?q=${encodeURIComponent(track.artistName)}`}
                className="hidden rounded-sm p-1 text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:inline-flex"
                aria-label={`Cerca ${track.artistName} nel catalogo`}
                title={`Cerca ${track.artistName} nel catalogo`}
              >
                <MagnifyingGlass aria-hidden="true" className="h-4 w-4" />
              </Link>
              <PreviewPlayButton track={toPlayingTrack(track)} size="sm" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
