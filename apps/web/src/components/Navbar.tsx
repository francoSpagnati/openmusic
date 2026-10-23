'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, List, SignIn, SignOut, X } from '@phosphor-icons/react';
import { loginRedirectUrl, useAuth } from '@/lib/auth';
import { useFriendsPresence } from '@/lib/socket';
import { Avatar, IconButton, ThemeToggle, buttonClasses, cn } from '@/components/ui';
import { CatalogQuickSearch } from './discovery/CatalogQuickSearch';
import { BrandMark } from './web-core/shell/BrandMark';
import { GhostModeSwitch } from './web-core/GhostModeSwitch';
import { NAV_ITEMS, isActivePath } from './web-core/navigation';
import { displayNameOf } from './web-core/format';
import { useUnreadNotifications } from './web-core/useUnreadNotifications';

/** Mobile/tablet top bar (< lg). Desktop navigation is the <Sidebar>. */
export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { status, user, logout } = useAuth();
  const unread = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const authenticated = status === 'authenticated' && user !== null;

  // Close the menu after navigating and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const items = NAV_ITEMS.filter((item) => authenticated || !item.private);

  return (
    <header className="sticky top-0 z-sticky w-full border-b border-line bg-canvas lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <BrandMark compact />

        <div className="flex items-center gap-1">
          {authenticated && <LiveFriendsPill />}
          {authenticated ? (
            <>
              <Link
                href="/notifications"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-fg-muted hover:bg-fg/[0.05] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                aria-label={unread > 0 ? `Notifiche, ${unread} non lette` : 'Notifiche'}
              >
                <Bell aria-hidden="true" className="h-5 w-5" />
                {unread > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1 top-1 min-w-4 rounded-full bg-accent px-1 text-center font-mono text-[10px] font-semibold leading-4 text-accent-contrast tabular-nums"
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link
                href="/profile"
                aria-label="Il tuo profilo"
                className="ml-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <Avatar name={displayNameOf(user)} src={user.avatarUrl} size="sm" decorative />
              </Link>
            </>
          ) : (
            status === 'anonymous' &&
            // Secondary: the page's own action (e.g. the login form) keeps the only clay fill.
            !isActivePath(pathname, '/auth') && (
              <Link
                href={loginRedirectUrl(pathname ?? '/')}
                className={buttonClasses({ variant: 'secondary', size: 'sm' })}
              >
                <SignIn aria-hidden="true" />
                Accedi
              </Link>
            )
          )}
          {/* md (40px) matches the other touch targets in the mobile bar. */}
          <ThemeToggle variant="icon" />
          <IconButton
            label={open ? 'Chiudi menu' : 'Apri menu'}
            icon={open ? <X weight="bold" /> : <List weight="bold" />}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          />
        </div>
      </div>

      <nav
        id={menuId}
        aria-label="Menu"
        hidden={!open}
        className="om-fade border-t border-line bg-canvas px-4 pb-5 pt-3 sm:px-6"
      >
        {!isActivePath(pathname, '/explore') && <CatalogQuickSearch className="mb-2 mt-1" />}
        <ul className="grid gap-0.5 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-3 rounded-md px-3 py-3 text-base',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
                    active
                      ? 'bg-fg/[0.045] font-medium text-fg before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-accent'
                      : 'text-fg-muted hover:bg-fg/[0.035] hover:text-fg'
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    weight={active ? 'fill' : 'regular'}
                    className={cn('h-5 w-5', active ? 'text-accent' : 'text-fg-subtle')}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {authenticated && (
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <GhostModeSwitch variant="detailed" className="px-3 py-1" />
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-base text-fg-muted hover:bg-fg/[0.035] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <SignOut aria-hidden="true" className="h-5 w-5 text-fg-subtle" />
              Esci
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};

/** "3 amici in ascolto": live count from the presence socket. */
function LiveFriendsPill() {
  const { friends } = useFriendsPresence();
  const listening = friends.filter((f) => !f.isGhostMode && f.currentlyPlaying?.isPlaying).length;
  if (listening === 0) return null;
  return (
    <span className="mr-1 hidden items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs text-fg-muted sm:inline-flex">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-fresh" />
      <span className="font-mono tabular-nums">{listening}</span>{' '}
      {listening === 1 ? 'amico in ascolto' : 'amici in ascolto'}
    </span>
  );
}
