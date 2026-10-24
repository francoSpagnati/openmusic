'use client';

import React from 'react';
import { cn } from './cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'live' | 'online' | 'ghost' | 'offline';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** `live` draws a quiet green ring and dot: the user is listening right now. */
  status?: AvatarStatus;
  /** Hide the name from assistive tech when it is already written next to the avatar. */
  decorative?: boolean;
  className?: string;
}

const sizes: Record<AvatarSize, { box: string; text: string; dot: string }> = {
  xs: { box: 'h-6 w-6', text: 'text-[10px]', dot: 'h-2 w-2' },
  sm: { box: 'h-8 w-8', text: 'text-xs', dot: 'h-2.5 w-2.5' },
  md: { box: 'h-10 w-10', text: 'text-sm', dot: 'h-3 w-3' },
  lg: { box: 'h-14 w-14', text: 'text-lg', dot: 'h-3.5 w-3.5' },
  xl: { box: 'h-20 w-20', text: 'text-2xl', dot: 'h-4 w-4' },
};

const statusLabel: Record<AvatarStatus, string> = {
  live: 'in ascolto ora',
  online: 'online',
  ghost: 'in Ghost Mode',
  offline: 'offline',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'md',
  status,
  decorative = false,
  className,
}: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const s = sizes[size];
  const showImage = Boolean(src) && !failed;
  const label = status ? `${name}, ${statusLabel[status]}` : name;

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={cn('relative inline-flex shrink-0', s.box, className)}
    >
      {status === 'live' && (
        <span aria-hidden="true" className="absolute -inset-[3px] rounded-full ring-2 ring-fresh" />
      )}
      <span
        className={cn(
          'relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full',
          'bg-surface font-editorial font-medium text-fg-muted ring-1 ring-line',
          status === 'ghost' && 'opacity-60 grayscale',
          s.text
        )}
      >
        {/* Initials sit underneath the photo: they show while it loads and if it never does
            (including an error that fired before hydration, which onError cannot see). */}
        <span aria-hidden="true">{initials(name)}</span>
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </span>
      {status && status !== 'offline' && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-canvas',
            status === 'ghost' ? 'bg-fg-subtle' : 'bg-fresh',
            s.dot
          )}
        />
      )}
    </span>
  );
}
