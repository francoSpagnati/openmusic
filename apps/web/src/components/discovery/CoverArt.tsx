'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { cn } from '../ui';

export interface CoverArtProps {
  src: string | null | undefined;
  /** Empty string when the cover is decorative (title is next to it). */
  alt: string;
  /** `sizes` hint for the responsive image. */
  sizes: string;
  priority?: boolean;
  /** Load now even if off-screen (e.g. the next reel), without preloading like `priority`. */
  eager?: boolean;
  className?: string;
  imageClassName?: string;
}

/**
 * Square album cover. Falls back to the vinyl-grooves disc when the release has no artwork, so
 * cards keep their shape (no layout shift) and never show a broken image. The same fallback is
 * used when the artwork fails to load (dead link, blocked host, optimizer error).
 */
export function CoverArt({
  src,
  alt,
  sizes,
  priority,
  eager,
  className,
  imageClassName,
}: CoverArtProps) {
  // Keyed by URL so a new cover gets a fresh attempt after a previous one failed.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;
  return (
    <span className={cn('relative block overflow-hidden bg-sunken', className)}>
      {showImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : eager ? 'eager' : 'lazy'}
          className={cn('object-cover', imageClassName)}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          role={alt ? 'img' : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
          className="absolute inset-[8%] om-grooves"
        />
      )}
    </span>
  );
}
