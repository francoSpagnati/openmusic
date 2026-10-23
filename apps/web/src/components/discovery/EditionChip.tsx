import React from 'react';
import { VinylRecord } from '@phosphor-icons/react/dist/ssr';
import { Badge, cn, type BadgeSize } from '../ui';
import { editionName } from './editions';

/**
 * Which edition of an album this is ("Remaster 2011", "Deluxe", "Edizione standard"). Text plus a
 * record icon, never colour alone; `sr-only` prefix so screen readers hear "Edizione: …".
 */
export function EditionChip({
  label,
  size = 'md',
  className,
}: {
  label: string | null | undefined;
  size?: BadgeSize;
  className?: string;
}) {
  return (
    <Badge
      tone="neutral"
      variant="soft"
      size={size}
      icon={<VinylRecord />}
      className={cn('min-w-0 max-w-full', className)}
    >
      <span className="sr-only">Edizione: </span>
      <span className="truncate">{editionName(label)}</span>
    </Badge>
  );
}
