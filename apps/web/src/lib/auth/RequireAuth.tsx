'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { UserRole } from '@openmusic/shared';
import { safeRelativePath } from '../url';
import { useAuth } from './AuthProvider';

/** Where anonymous users are sent. The original path is passed as `?next=`. */
export const LOGIN_PATH = '/auth';

/** Builds `/auth?next=<path>`; only same-origin relative paths are accepted as `next`. */
export function loginRedirectUrl(nextPath: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(safeRelativePath(nextPath))}`;
}

/** Reads a safe post-login destination from `?next=` (falls back to `/`). */
export function safeNextPath(next: string | null | undefined): string {
  return safeRelativePath(next);
}

/**
 * Redirects anonymous users to the login page and returns the auth state. Optionally requires a
 * role (users without it are sent to `/`). Render nothing/skeletons until `ready` is true.
 */
export function useRequireAuth(options: { roles?: UserRole[] } = {}) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const roles = options.roles;
  const roleOk = !roles || (auth.user !== null && roles.includes(auth.user.role));

  useEffect(() => {
    if (auth.status === 'anonymous') router.replace(loginRedirectUrl(pathname ?? '/'));
    else if (auth.status === 'authenticated' && !roleOk) router.replace('/');
  }, [auth.status, roleOk, router, pathname]);

  return { ...auth, ready: auth.status === 'authenticated' && roleOk };
}

/**
 * Client-side route guard:
 * `<RequireAuth fallback={<Skeleton />}><SettingsForm /></RequireAuth>`.
 * The API still enforces every permission; this only avoids rendering private UI to anonymous
 * visitors.
 */
export function RequireAuth({
  children,
  fallback = null,
  roles,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  roles?: UserRole[];
}) {
  const { ready } = useRequireAuth({ roles });
  return <>{ready ? children : fallback}</>;
}
