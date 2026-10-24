import React from 'react';
import Link from 'next/link';
import type { UserRole } from '@openmusic/shared';
import { SealCheck } from '@phosphor-icons/react/dist/ssr';
import { Avatar, cn, type AvatarSize, type AvatarStatus } from '@/components/ui';
import { displayNameOf, profileHref } from './format';

export interface IdentityUser {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role?: UserRole;
}

/** Avatar + name + @handle, linking to the public profile. */
export function UserIdentity({
  user,
  size = 'md',
  status,
  meta,
  className,
}: {
  user: IdentityUser;
  size?: AvatarSize;
  status?: AvatarStatus;
  /** Extra line under the handle (time, affinity...). */
  meta?: React.ReactNode;
  className?: string;
}) {
  const name = displayNameOf(user);
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Link href={profileHref(user)} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <Avatar name={name} src={user.avatarUrl} size={size} status={status} decorative />
      </Link>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1 text-sm">
          <Link
            href={profileHref(user)}
            className="truncate font-medium text-fg hover:underline focus-visible:underline"
          >
            {name}
          </Link>
          {user.role === 'CRITIC' && (
            <SealCheck
              weight="fill"
              className="h-4 w-4 shrink-0 text-accent"
              aria-label="Critico accreditato"
              role="img"
            />
          )}
        </p>
        <p className="truncate text-[13px] text-fg-subtle">
          @{user.username}
          {meta ? <span> · {meta}</span> : null}
        </p>
      </div>
    </div>
  );
}
