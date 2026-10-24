'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PencilSimple, SealCheck, ShieldStar } from '@phosphor-icons/react';
import type { UserProfileData } from '@openmusic/shared';
import { Avatar, Badge, buttonClasses } from '@/components/ui';
import { FollowButton } from '../FollowButton';
import { compactNumber, displayNameOf, monthYear } from '../format';
import { FollowListDialog, type FollowListKind } from './FollowListDialog';

const ROLE_BADGE = {
  CRITIC: { label: 'Critico accreditato', tone: 'accent', icon: <SealCheck weight="fill" /> },
  MODERATOR: { label: 'Moderatore', tone: 'neutral', icon: <ShieldStar weight="fill" /> },
  ADMIN: { label: 'Admin', tone: 'neutral', icon: <ShieldStar weight="fill" /> },
} as const;

/** Masthead of a profile: identity, bio, social counts and the primary action. */
export function ProfileHeader({
  profile,
  onFollowersChange,
}: {
  profile: UserProfileData;
  onFollowersChange: (followersCount: number, isFollowedByMe: boolean) => void;
}) {
  const { user, social } = profile;
  const name = displayNameOf(user);
  const [list, setList] = useState<FollowListKind | null>(null);
  const role = user.role === 'USER' ? null : ROLE_BADGE[user.role];

  return (
    <header className="om-enter border-b border-line px-4 pb-8 pt-10 sm:px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-end gap-4">
          <Avatar name={name} src={user.avatarUrl} size="xl" decorative />
          <div className="min-w-0">
            <h1 className="om-headline break-words text-display-sm text-fg">{name}</h1>
            <p className="mt-1 text-sm text-fg-muted">@{user.username}</p>
            <p className="text-sm text-fg-subtle">Su OpenMusic da {monthYear(user.createdAt)}</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {social.isMe ? (
            <Link href="/settings" className={buttonClasses({ variant: 'secondary', size: 'md' })}>
              <PencilSimple aria-hidden="true" />
              Modifica profilo
            </Link>
          ) : (
            <FollowButton
              size="md"
              emphasis="primary"
              userId={user.id}
              username={user.username}
              isFollowing={social.isFollowedByMe}
              onChange={(state) => onFollowersChange(state.followersCount, state.isFollowedByMe)}
            />
          )}
        </div>
      </div>

      {(role || user.bio) && (
        <div className="mt-6 max-w-prose space-y-3">
          {role && (
            <Badge tone={role.tone} icon={role.icon}>
              {role.label}
              {user.role === 'CRITIC' && user.criticOutlet ? ` · ${user.criticOutlet}` : ''}
            </Badge>
          )}
          {user.bio && <p className="whitespace-pre-line text-base text-fg">{user.bio}</p>}
        </div>
      )}

      <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="sr-only">Post</dt>
          <dd className="flex items-baseline gap-1.5">
            <span className="font-mono font-medium text-fg tabular-nums">
              {compactNumber(social.postsCount)}
            </span>
            <span aria-hidden="true" className="text-fg-muted">
              post
            </span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Follower</dt>
          <dd>
            <button
              type="button"
              onClick={() => setList('followers')}
              className="flex items-baseline gap-1.5 rounded-xs hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="font-mono font-medium text-fg tabular-nums">
                {compactNumber(social.followersCount)}
              </span>
              <span className="text-fg-muted">follower</span>
            </button>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Seguiti</dt>
          <dd>
            <button
              type="button"
              onClick={() => setList('following')}
              className="flex items-baseline gap-1.5 rounded-xs hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="font-mono font-medium text-fg tabular-nums">
                {compactNumber(social.followingCount)}
              </span>
              <span className="text-fg-muted">seguiti</span>
            </button>
          </dd>
        </div>
      </dl>

      <FollowListDialog userId={user.id} name={name} kind={list} onClose={() => setList(null)} />
    </header>
  );
}
