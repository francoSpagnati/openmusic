'use client';

import React from 'react';
import { useRequireAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import { ProfileView } from '@/components/web-core/profile/ProfileView';

/** The signed-in user's own profile; anonymous visitors are sent to /auth?next=/profile. */
export default function MyProfilePage() {
  const { ready } = useRequireAuth();
  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" label="Caricamento del profilo…" />
      </div>
    );
  }
  return <ProfileView />;
}
