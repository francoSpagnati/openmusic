'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { isOptimizableImage } from '../../lib/images';
import { cn } from '../ui';

export interface CoverArtProps {
  src: string | null | undefined;
  /** Empty string when the cover is decorative (title is next to it). */
  alt: string;
  /**
   * `sizes` hint for the responsive image: the optimizer builds a `srcset` from it, so a 40px
   * thumbnail downloads a ~96px file and the hero cover a 384-640px one, never the 1000px master.
   */
  sizes: string;
  priority?: boolean;
  /** Load now even if off-screen (e.g. the next reel), without preloading like `priority`. */
  eager?: boolean;
  /**
   * The release's dominant colour (`#RRGGBB`): painted behind the cover while it loads, so the
   * slot already "looks like" the sleeve instead of flashing grey.
   */
  placeholderColor?: string | null;
  className?: string;
  imageClassName?: string;
  /**
   * Draw a 1px hairline over the edge (above the image), so pale sleeves do not melt into the
   * paper background. Used by the editorial release, album, explore and reel layouts.
   */
  framed?: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Square album cover.
 *
 * - Covers on the catalog CDNs (Deezer, iTunes, Cover Art Archive, seed hosts) go through the
 *   Next optimizer (AVIF/WebP, `srcset`); any other host is loaded by the browser as is.
 * - While loading, the slot shows the dominant colour (or the sunken surface) and the image
 *   fades in, so cards keep their shape and nothing jumps.
 * - With no artwork, or when it fails to load (dead link, CDN down, offline), it falls back to
 *   the vinyl-grooves disc instead of a broken image.
 */
export function CoverArt({
  src,
  alt,
  sizes,
  priority,
  eager,
  placeholderColor,
  className,
  imageClassName,
  framed = false,
}: CoverArtProps) {
  // Keyed by URL so a new cover gets a fresh attempt after a previous one failed.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;
  const loaded = showImage && loadedSrc === src;
  const background = placeholderColor && HEX.test(placeholderColor) ? placeholderColor : undefined;

  return (
    <span
      className={cn(
        'relative block overflow-hidden bg-sunken',
        framed &&
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-hairline after:content-['']",
        className
      )}
      style={showImage && background ? { backgroundColor: background } : undefined}
    >
      {showImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : eager ? 'eager' : 'lazy'}
          unoptimized={!isOptimizableImage(src)}
          // Priority covers are the LCP element: show them at once, no fade.
          className={cn(
            'object-cover',
            !priority && 'transition-opacity duration-base ease-standard',
            !priority && !loaded && 'opacity-0',
            imageClassName
          )}
          onLoad={() => setLoadedSrc(src)}
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
