import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowSquareOut, Clock, Play } from '@phosphor-icons/react/dist/ssr';
import type { MusicVideoItem } from '@openmusic/shared';
import { Badge, Card } from '../../components/ui';
import { formatDate, formatLongDuration } from '../../components/discovery/format';
import { CATEGORY_LABEL, fallbackThumbnail, videoHost } from './videoMeta';

/** A curated external video. The whole card opens it in a new tab (stretched link). */
export function VideoCard({
  video,
  showReleaseLink = true,
  priority,
}: {
  video: MusicVideoItem;
  showReleaseLink?: boolean;
  priority?: boolean;
}) {
  const thumb = video.thumbnailUrl ?? fallbackThumbnail(video.videoUrl);
  const host = videoHost(video.videoUrl);

  return (
    <Card
      as="article"
      variant="sleeve"
      padding="none"
      interactive
      className="group flex h-full flex-col focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-sunken">
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-slow ease-standard group-hover:scale-[1.03]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="om-grooves absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2"
          />
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center opacity-90 transition-opacity group-hover:opacity-100"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-on-accent shadow-om-md">
            <Play weight="fill" className="h-5 w-5 translate-x-px" />
          </span>
        </span>
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-xs bg-canvas/90 px-1.5 py-0.5 font-mono text-xs tabular-nums text-ink">
          <Clock aria-hidden="true" className="h-3 w-3" />
          <span className="sr-only">Durata </span>
          {formatLongDuration(video.durationSeconds)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" size="sm" mono>
            {CATEGORY_LABEL[video.category]}
          </Badge>
          <span className="truncate text-xs text-ink-secondary">{video.creatorName}</span>
        </div>
        <h3 className="om-headline line-clamp-2 text-lg text-ink group-hover:text-accent">
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {video.title}
            <span className="sr-only">
              {host
                ? ` (su ${host}, si apre in una nuova scheda)`
                : ' (si apre in una nuova scheda)'}
            </span>
          </a>
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-ink-muted">
          <time dateTime={video.createdAt} className="font-mono tabular-nums">
            {formatDate(video.createdAt)}
          </time>
          <span className="flex items-center gap-3">
            {showReleaseLink && video.releaseId && (
              <Link
                href={`/releases/${video.releaseId}`}
                className="relative z-raised font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                Scheda del disco
              </Link>
            )}
            {host && (
              <span className="inline-flex items-center gap-1">
                {host}
                <ArrowSquareOut aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
