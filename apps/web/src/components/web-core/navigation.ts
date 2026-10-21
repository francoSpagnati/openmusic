import type { Icon } from '@phosphor-icons/react';
import {
  Bell,
  ChatCircleDots,
  Compass,
  Gear,
  House,
  Newspaper,
  User,
  VideoCamera,
} from '@phosphor-icons/react';

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  /** Only shown to signed-in users. */
  private?: boolean;
  /** Shows the unread notifications badge. */
  badge?: 'notifications';
}

/** Primary navigation, shared by the desktop sidebar and the mobile menu. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Esplora', href: '/explore', icon: Compass },
  { label: 'Critica', href: '/critics', icon: Newspaper },
  { label: 'Video saggi', href: '/videos', icon: VideoCamera },
  { label: 'Chat', href: '/chat', icon: ChatCircleDots, private: true },
  { label: 'Notifiche', href: '/notifications', icon: Bell, private: true, badge: 'notifications' },
  { label: 'Profilo', href: '/profile', icon: User, private: true },
  { label: 'Impostazioni', href: '/settings', icon: Gear, private: true },
];

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
