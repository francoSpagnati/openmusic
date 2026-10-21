'use client';

import React from 'react';
import Link from 'next/link';
import { ChatText, Disc, Notebook } from '@phosphor-icons/react';
import type { UserProfileData } from '@openmusic/shared';
import { api, isApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EmptyState, ErrorState, Skeleton, Tabs, buttonClasses } from '@/components/ui';
import { RightSidebar } from '@/components/RightSidebar';
import { Sidebar } from '@/components/Sidebar';
import { displayNameOf, errorMessage, isUuid } from '../format';
import { useApiResource, type ApiResource } from '../useApiResource';
import { ProfileHeader } from './ProfileHeader';
import { ProfilePosts, ProfileReviews, ProfileRotation } from './ProfileSections';
import { ProfileStats } from './ProfileStats';

/**
 * A profile page body. `handle` is a username or a user id; omit it for the signed-in user's own
 * profile (the caller guards that route).
 */
export function ProfileView({ handle }: { handle?: string }) {
  const { status, user } = useAuth();
  const viewer = user?.id ?? 'anon';
  const key =
    status === 'loading' || (handle === undefined && status !== 'authenticated')
      ? null
      : `profile:${handle ?? 'me'}:${viewer}`;

  const profile = useApiResource<UserProfileData>(key, () => {
    if (handle === undefined) return api.profile.me();
    return isUuid(handle) ? api.profile.byId(handle) : api.profile.byUsername(handle);
  });

  return (
    <div className="mx-auto flex max-w-7xl justify-center">
      <Sidebar />
      <div className="min-w-0 max-w-3xl flex-1 border-line lg:border-r">
        <ProfileBody
          profile={profile}
          onFollowersChange={(followersCount, isFollowedByMe) =>
            profile.setData((data) =>
              data ? { ...data, social: { ...data.social, followersCount, isFollowedByMe } } : data
            )
          }
        />
      </div>
      <RightSidebar />
    </div>
  );
}

function ProfileBody({
  profile,
  onFollowersChange,
}: {
  profile: ApiResource<UserProfileData>;
  onFollowersChange: (followersCount: number, isFollowedByMe: boolean) => void;
}) {
  if (profile.status === 'error') {
    if (isApiError(profile.error) && profile.error.status === 404) {
      return (
        <div className="p-4 sm:p-6">
          <h1 className="sr-only">Profilo non trovato</h1>
          <EmptyState
            title="Questo profilo non esiste"
            description="Forse l'username è cambiato o il link è sbagliato."
            action={
              <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
                Torna al feed
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div className="p-4 sm:p-6">
        <h1 className="sr-only">Profilo</h1>
        <ErrorState
          title="Il profilo non si è caricato"
          description={errorMessage(profile.error)}
          onRetry={profile.reload}
        />
      </div>
    );
  }

  const data = profile.data;
  if (!data || profile.status !== 'success') return <ProfileSkeleton />;

  const name = displayNameOf(data.user);
  const isMe = data.social.isMe;

  return (
    <>
      <ProfileHeader profile={data} onFollowersChange={onFollowersChange} />
      <ProfileStats stats={data.stats} />
      <Tabs
        label={`Contenuti di ${name}`}
        className="[&>[role=tablist]]:px-4 sm:[&>[role=tablist]]:px-6"
        panelClassName="pt-0"
        items={[
          {
            id: 'posts',
            label: 'Post',
            icon: <ChatText aria-hidden="true" />,
            count: data.social.postsCount,
            content: <ProfilePosts userId={data.user.id} isMe={isMe} name={name} />,
          },
          {
            id: 'reviews',
            label: 'Recensioni',
            icon: <Notebook aria-hidden="true" />,
            count: data.stats.totalReviews,
            content: <ProfileReviews reviews={data.recentReviews} isMe={isMe} />,
          },
          {
            id: 'rotation',
            label: 'In rotazione',
            icon: <Disc aria-hidden="true" />,
            content: <ProfileRotation items={data.heavyRotation} isMe={isMe} />,
          },
        ]}
      />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" className="px-4 pb-6 pt-8 sm:px-6">
      <span className="sr-only" role="status">
        Caricamento del profilo…
      </span>
      <div className="flex items-end gap-4">
        <Skeleton shape="circle" className="h-20 w-20" />
        <div className="w-56">
          <Skeleton shape="text" lines={3} />
        </div>
      </div>
      <Skeleton shape="text" lines={2} className="mt-6 max-w-prose" />
      <Skeleton shape="rect" className="mt-8 h-20" />
    </div>
  );
}
