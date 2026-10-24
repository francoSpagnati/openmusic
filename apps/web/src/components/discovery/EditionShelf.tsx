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
      className="inline-flex items-center gap-1 text-xs text-fg-muted"
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 text-fg-subtle" />
      {count > 0 && avg !== null ? (
        <>
          <Star aria-hidden="true" weight="fill" className="h-3 w-3 text-accent" />
          <span className="font-mono tabular-nums text-fg">{formatStars(avg)}</span>
          <span className="font-mono tabular-nums text-fg-subtle">({count})</span>
        </>
      ) : (
        <span className="font-mono text-fg-subtle">—</span>
      )}
    </span>
  );
}

export function EditionScores({ edition }: { edition: EditionSummary }) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <EditionScore kind="critic" avg={edition.criticAvg} count={edition.criticCount} />
      <EditionScore kind="audience" avg={edition.audienceAvg} count={edition.audienceCount} />
    </span>
  );
}

/**
 * Editions as one quiet horizontal row (release page, "Altre edizioni"): small sleeves with the
 * edition name underneath, scrolling sideways when they do not fit. Each links to its own page.
 */
export function EditionShelf({ editions, label }: { editions: EditionSummary[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className="-mx-4 flex snap-x gap-6 overflow-x-auto px-4 pb-3 sm:-mx-0 sm:px-0 [scrollbar-width:thin]"
    >
      {editions.map((edition) => (
        <li key={edition.id} className="w-36 shrink-0 snap-start sm:w-40">
          <article className="group relative flex h-full flex-col gap-2 rounded-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-focus">
            <CoverArt
              src={edition.coverUrl}
              placeholderColor={edition.dominantColor}
              alt=""
              sizes="160px"
              framed
              className="aspect-square w-full rounded-sm transition-opacity duration-base group-hover:opacity-85"
            />
            <h3 className="mt-1 text-sm font-medium leading-snug text-fg">
              <Link
                href={`/releases/${edition.id}`}
                className="line-clamp-2 underline-offset-4 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:underline"
              >
                {edition.title}
              </Link>
            </h3>
            <EditionChip label={edition.editionLabel} size="sm" className="self-start" />
            <p className="truncate text-xs text-fg-subtle">
              {[RELEASE_TYPE_LABEL[edition.releaseType], ...editionFacts(edition)].join(', ')}
            </p>
            <div className="mt-auto">
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
    <ol aria-label={label} className={cn('border-t border-line', className)}>
      {editions.map((edition) => (
        <li
          key={edition.id}
          className="group relative flex gap-4 border-b border-line py-4 transition-colors duration-fast focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-focus hover:bg-fg/[0.03] sm:gap-5 sm:px-2"
        >
          <CoverArt
            src={edition.coverUrl}
            placeholderColor={edition.dominantColor}
            alt=""
            sizes="80px"
            framed
            className="h-16 w-16 shrink-0 rounded-sm sm:h-20 sm:w-20"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <EditionChip label={edition.editionLabel} size="sm" />
              {edition.year && (
                <span className="font-mono text-xs tabular-nums text-fg-subtle">
                  {edition.year}
                </span>
              )}
            </div>
            <h3 className="om-headline text-lg leading-snug text-fg">
              <Link
                href={`/releases/${edition.id}`}
                className="underline-offset-4 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:underline"
              >
                {edition.title}
              </Link>
            </h3>
            <p className="text-xs text-fg-muted">
              {[
                RELEASE_TYPE_LABEL[edition.releaseType],
                ...editionFacts({ ...edition, year: null }),
                edition.trackCount ? plural(edition.trackCount, 'brano', 'brani') : null,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
            <EditionScores edition={edition} />
          </div>
        </li>
      ))}
    </ol>
  );
}
