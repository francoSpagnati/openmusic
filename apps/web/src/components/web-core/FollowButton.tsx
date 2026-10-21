'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, UserPlus } from '@phosphor-icons/react';
import type { FollowState } from '@openmusic/shared';
import { api } from '@/lib/api';
import { loginRedirectUrl, useAuth } from '@/lib/auth';
import { Button, buttonClasses, useToast, type ButtonSize } from '@/components/ui';
import { errorMessage } from './format';

export interface FollowButtonProps {
  userId: string;
  /** Used in the accessible name and toasts: "Segui @marco". */
  username: string;
  isFollowing: boolean;
  size?: ButtonSize;
  onChange?: (state: FollowState) => void;
}

/**
 * Optimistic follow toggle. Unfollow shows an Undo toast (Nielsen #3); anonymous visitors get a
 * link to sign in and come back here.
 */
export function FollowButton({
  userId,
  username,
  isFollowing,
  size = 'sm',
  onChange,
}: FollowButtonProps) {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const { notify } = useToast();
  const [following, setFollowing] = useState(isFollowing);
  const [pending, setPending] = useState(false);

  useEffect(() => setFollowing(isFollowing), [isFollowing]);

  if (user?.id === userId) return null;

  if (status !== 'authenticated') {
    return (
      <Link
        href={loginRedirectUrl(pathname ?? '/')}
        className={buttonClasses({ variant: 'outline', size })}
        aria-label={`Accedi per seguire @${username}`}
      >
        <UserPlus aria-hidden="true" weight="bold" />
        Segui
      </Link>
    );
  }

  async function apply(next: boolean, withUndo: boolean) {
    const previous = following;
    setFollowing(next);
    setPending(true);
    try {
      const state = next ? await api.users.follow(userId) : await api.users.unfollow(userId);
      setFollowing(state.isFollowedByMe);
      onChange?.(state);
      if (withUndo && !next) {
        notify({
          title: `Non segui più @${username}`,
          action: { label: 'Annulla', onAction: () => void apply(true, false) },
        });
      }
    } catch (err) {
      setFollowing(previous);
      notify({ tone: 'error', title: 'Operazione non riuscita', description: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      size={size}
      variant={following ? 'secondary' : 'primary'}
      aria-pressed={following}
      aria-label={following ? `Segui già @${username}. Smetti di seguire` : `Segui @${username}`}
      disabled={pending}
      onClick={() => void apply(!following, true)}
      leadingIcon={
        following ? (
          <Check aria-hidden="true" weight="bold" />
        ) : (
          <UserPlus aria-hidden="true" weight="bold" />
        )
      }
    >
      {following ? 'Segui già' : 'Segui'}
    </Button>
  );
}
