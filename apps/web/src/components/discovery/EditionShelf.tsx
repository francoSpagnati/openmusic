import React from 'react';
import Link from 'next/link';
import { SealCheck, Star, UsersThree } from '@phosphor-icons/react/dist/ssr';
import type { EditionSummary } from '@openmusic/shared';
import { cn } from '../ui';
import { CoverArt } from './CoverArt';
import { EditionChip } from './EditionChip';
import { editionFacts } from './editions';
import { RELEASE_TYPE_LABEL, formatStars, plural } from './format';

/** One edition's own average (0.5–5 stars) and count; never mixed with other editions. */
function EditionScore({
  kind,
  avg,
  count,
}: {
  kind: 'critic' | 'audience';
  avg: number | null;
  count: number;
}) {
  const name = kind === 'critic' ? 'Critica' : 'Pubblico';
  const Icon = kind === 'critic' ? SealCheck : UsersThree;
  const label =
    count > 0 && avg !== null
      ? `${name}: media ${formatStars(avg)} su 5, ${plural(count, 'recensione', 'recensioni')}`
      : `${name}: nessuna recensione`;
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-ink-secondary"
    >
      <Icon aria-hidden="true" weight="duotone" className="h-3.5 w-3.5" />
      {count > 0 && avg !== null ? (
        <>
          <Star aria-hidden="true" weight="fill" className="h-3 w-3 text-accent" />
          {formatStars(avg)}
          <span className="text-ink-muted">· {count}</span>
        </>
      ) : (
        <span className="text-ink-muted">—</span>
      )}
    </span>
  );
}

export function EditionScores({ edition }: { edition: EditionSummary }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <EditionScore kind="critic" avg={edition.criticAvg} count={edition.criticCount} />
      <EditionScore kind="audience" avg={edition.audienceAvg} count={edition.audienceCount} />
    </span>
  );
}

/**
 * Editions as a row of record sleeves (release page, "Altre edizioni"). Scrolls sideways on
 * phones, wraps into a grid from `sm` up. Each sleeve links to that edition's own page.
 */
export function EditionShelf({ editions, label }: { editions: EditionSummary[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 xl:grid-cols-4"
    >
      {editions.map((edition) => (
        <li key={edition.id} className="w-40 shrink-0 snap-start sm:w-auto">
          <article className="om-sleeve group relative flex h-full flex-col gap-2 p-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
            <CoverArt
              src={edition.coverUrl}
              placeholderColor={edition.dominantColor}
              alt=""
              sizes="(min-width: 1280px) 200px, (min-width: 640px) 30vw, 160px"
              className="aspect-square w-full rounded-sm"
            />
            <EditionChip label={edition.editionLabel} size="sm" className="self-start" />
            <h3 className="text-sm font-semibold leading-snug text-ink">
              <Link
                href={`/releases/${edition.id}`}
                className="line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-accent"
              >
                {edition.title}
              </Link>
            </h3>
            <p className="om-eyebrow truncate">
              {[RELEASE_TYPE_LABEL[edition.releaseType], ...editionFacts(edition)].join(' · ')}
            </p>
            <div className="mt-auto pt-1">
              <EditionScores edition={edition} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

/**
 * Editions as a catalogue list (album page): sleeve thumbnail, edition, facts, track count and
 * that edition's own scores.
 */
export function EditionList({
  editions,
  label,
  className,
}: {
  editions: EditionSummary[];
  label: string;
  className?: string;
}) {
  return (
    <ol
      aria-label={label}
      className={cn('divide-y divide-line rounded-lg border border-line bg-surface', className)}
    >
      {editions.map((edition) => (
        <li
          key={edition.id}
          className="group relative flex gap-3 p-3 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-focus hover:bg-elevated sm:gap-4 sm:p-4"
        >
          <CoverArt
            src={edition.coverUrl}
            placeholderColor={edition.dominantColor}
            alt=""
            sizes="80px"
            className="h-16 w-16 shrink-0 rounded-xs shadow-om-sm sm:h-20 sm:w-20"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <EditionChip label={edition.editionLabel} size="sm" />
              {edition.year && (
                <span className="font-mono text-xs tabular-nums text-ink-muted">
                  {edition.year}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-snug text-ink sm:text-base">
              <Link
                href={`/releases/${edition.id}`}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-accent"
              >
                {edition.title}
              </Link>
            </h3>
            <p className="font-mono text-xs text-ink-secondary">
              {[
                RELEASE_TYPE_LABEL[edition.releaseType],
                ...editionFacts({ ...edition, year: null }),
                edition.trackCount ? plural(edition.trackCount, 'brano', 'brani') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <EditionScores edition={edition} />
          </div>
        </li>
      ))}
    </ol>
  );
}
