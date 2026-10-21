'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlusCircle, SignIn, SignOut } from '@phosphor-icons/react';
import { useAuth, loginRedirectUrl } from '@/lib/auth';
import { Avatar, Button, Skeleton, buttonClasses, cn, useToast } from '@/components/ui';
import { CatalogQuickSearch } from './discovery/CatalogQuickSearch';
import { BrandMark } from './web-core/shell/BrandMark';
import { GhostModeSwitch } from './web-core/GhostModeSwitch';
import { NAV_ITEMS, isActivePath } from './web-core/navigation';
import { displayNameOf, errorMessage } from './web-core/format';
import { useUnreadNotifications } from './web-core/useUnreadNotifications';

interface SidebarProps {
  /** Opens the page's composer. Without it the button links to the home composer. */
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
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-line bg-canvas p-4 lg:flex"
    >
      <div className="space-y-6">
        <BrandMark />

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
                      'group flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors duration-fast',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      active
                        ? 'bg-surface font-semibold text-ink shadow-om-sm ring-1 ring-line'
                        : 'text-ink-secondary hover:bg-surface hover:text-ink'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon
                        aria-hidden="true"
                        weight={active ? 'fill' : 'regular'}
                        className={cn(
                          'h-5 w-5',
                          active ? 'text-accent' : 'text-ink-muted group-hover:text-ink'
                        )}
                      />
                      {item.label}
                    </span>
                    {badge !== null && (
                      <span className="min-w-5 rounded-full bg-accent px-1.5 text-center font-mono text-[11px] font-bold leading-5 text-on-accent tabular-nums">
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

        {authenticated &&
          (onOpenCreatePost ? (
            <Button
              fullWidth
              size="lg"
              onClick={onOpenCreatePost}
              leadingIcon={<PlusCircle aria-hidden="true" weight="bold" />}
            >
              Condividi un disco
            </Button>
          ) : (
            <Link href="/#compose" className={buttonClasses({ size: 'lg', fullWidth: true })}>
              <PlusCircle aria-hidden="true" weight="bold" />
              Condividi un disco
            </Link>
          ))}
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
      <div aria-busy="true" className="rounded-lg border border-line bg-surface p-3">
        <span className="sr-only">Caricamento account…</span>
        <div className="flex items-center gap-3">
          <Skeleton shape="circle" className="h-9 w-9" />
          <Skeleton shape="text" lines={2} className="flex-1" />
        </div>
      </div>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <p className="om-eyebrow">Benvenuto</p>
        <p className="text-sm text-ink-secondary">
          Accedi per seguire gli amici, pubblicare e vedere chi sta ascoltando cosa.
        </p>
        <Link href={loginRedirectUrl(nextPath)} className={buttonClasses({ fullWidth: true })}>
          <SignIn aria-hidden="true" weight="bold" />
          Accedi
        </Link>
        <Link
          href="/auth?mode=register"
          className={buttonClasses({ variant: 'ghost', size: 'sm', fullWidth: true })}
        >
          Crea un account
        </Link>
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
    <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/profile"
          className="group flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Avatar
            name={name}
            src={user.avatarUrl}
            size="sm"
            status={user.isGhostMode ? 'ghost' : undefined}
            decorative
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink group-hover:underline">
              {name}
            </span>
            <span className="block truncate font-mono text-[11px] text-ink-muted">
              @{user.username}
            </span>
          </span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleLogout()}
          loading={loggingOut}
          aria-label="Esci da OpenMusic"
          className="px-2"
        >
          <SignOut aria-hidden="true" weight="bold" />
        </Button>
      </div>
      <GhostModeSwitch className="rounded-md bg-sunken px-2.5 py-2" />
    </div>
  );
}
