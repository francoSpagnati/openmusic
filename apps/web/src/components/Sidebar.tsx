'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PencilSimpleLine, SignIn, SignOut } from '@phosphor-icons/react';
import { useAuth, loginRedirectUrl } from '@/lib/auth';
import {
  Avatar,
  IconButton,
  Skeleton,
  ThemeToggle,
  buttonClasses,
  cn,
  useToast,
} from '@/components/ui';
import { CatalogQuickSearch } from './discovery/CatalogQuickSearch';
import { BrandMark } from './web-core/shell/BrandMark';
import { GhostModeSwitch } from './web-core/GhostModeSwitch';
import { NAV_ITEMS, isActivePath } from './web-core/navigation';
import { displayNameOf, errorMessage } from './web-core/format';
import { useUnreadNotifications } from './web-core/useUnreadNotifications';

interface SidebarProps {
  /**
   * Set by pages that already show the composer (home). The composer is then the only "write"
   * action on the page, so the rail does not repeat it.
   */
  onOpenCreatePost?: () => void;
}

/** Desktop navigation rail (lg+). The mobile equivalent lives in <Navbar>. */
export const Sidebar: React.FC<SidebarProps> = ({ onOpenCreatePost }) => {
  const pathname = usePathname();
  const { status } = useAuth();
  const unread = useUnreadNotifications();
  const authenticated = status === 'authenticated';
  const items = NAV_ITEMS.filter((item) => authenticated || !item.private);

  return (
    <aside
      aria-label="Navigazione principale"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-line bg-canvas px-4 py-6 lg:flex"
    >
      <div className="space-y-8">
        <BrandMark className="px-2" />

        {/* Explore has its own, bigger search box. */}
        {!isActivePath(pathname, '/explore') && <CatalogQuickSearch />}

        <nav aria-label="Sezioni">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              const badge = item.badge === 'notifications' && unread > 0 ? unread : null;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-10 items-center justify-between rounded-md pl-3 pr-2 text-[15px] transition-colors duration-fast ease-out',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      active
                        ? 'bg-fg/[0.045] font-medium text-fg before:absolute before:inset-y-2.5 before:-left-4 before:w-0.5 before:rounded-full before:bg-accent'
                        : 'text-fg-muted hover:bg-fg/[0.035] hover:text-fg'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon
                        aria-hidden="true"
                        weight={active ? 'fill' : 'regular'}
                        className={cn(
                          'h-[1.15rem] w-[1.15rem]',
                          active ? 'text-accent' : 'text-fg-subtle group-hover:text-fg-muted'
                        )}
                      />
                      {item.label}
                    </span>
                    {badge !== null && (
                      <span className="min-w-5 rounded-full bg-accent/[0.12] px-1.5 text-center font-mono text-[11px] font-semibold leading-5 text-accent tabular-nums">
                        {badge > 99 ? '99+' : badge}
                        <span className="sr-only"> non lette</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Secondary on purpose: the page's own primary action stays the only clay fill. */}
        {authenticated && !onOpenCreatePost && (
          <Link
            href="/#compose"
            className={buttonClasses({ variant: 'secondary', fullWidth: true })}
          >
            <PencilSimpleLine aria-hidden="true" />
            Condividi un disco
          </Link>
        )}
      </div>

      <AccountPanel nextPath={pathname ?? '/'} />
    </aside>
  );
};

function AccountPanel({ nextPath }: { nextPath: string }) {
  const { status, user, logout } = useAuth();
  const { notify } = useToast();
  const [loggingOut, setLoggingOut] = React.useState(false);

  if (status === 'loading') {
    return (
      <div aria-busy="true" className="border-t border-line pt-4">
        <span className="sr-only">Caricamento account…</span>
        <div className="flex items-center gap-3 px-1">
          <Skeleton shape="circle" className="h-9 w-9" />
          <Skeleton shape="text" lines={2} className="flex-1" />
        </div>
      </div>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <div className="space-y-4 border-t border-line pt-5">
        <p className="px-1 text-sm text-fg-muted">
          Accedi per seguire gli amici, pubblicare e vedere chi sta ascoltando cosa.
        </p>
        <div className="space-y-1">
          <Link href={loginRedirectUrl(nextPath)} className={buttonClasses({ fullWidth: true })}>
            <SignIn aria-hidden="true" />
            Accedi
          </Link>
          <Link
            href="/auth?mode=register"
            className={buttonClasses({ variant: 'ghost', size: 'sm', fullWidth: true })}
          >
            Crea un account
          </Link>
        </div>
        <div className="flex justify-end">
          <ThemeToggle variant="icon" size="sm" />
        </div>
      </div>
    );
  }

  const name = displayNameOf(user);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      notify({ tone: 'error', title: 'Uscita non riuscita', description: errorMessage(err) });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-1">
        <Link
          href="/profile"
          className="group flex min-w-0 items-center gap-2.5 rounded-md px-1 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Avatar
            name={name}
            src={user.avatarUrl}
            size="sm"
            status={user.isGhostMode ? 'ghost' : undefined}
            decorative
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-fg group-hover:underline">
              {name}
            </span>
            <span className="block truncate text-xs text-fg-subtle">@{user.username}</span>
          </span>
        </Link>
        <span className="flex shrink-0 items-center">
          <ThemeToggle variant="icon" size="sm" />
          <IconButton
            size="sm"
            label="Esci da OpenMusic"
            icon={<SignOut />}
            loading={loggingOut}
            onClick={() => void handleLogout()}
          />
        </span>
      </div>
      <GhostModeSwitch className="px-1" />
    </div>
  );
}
