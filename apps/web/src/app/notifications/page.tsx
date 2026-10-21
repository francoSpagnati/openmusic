import type { Metadata } from 'next';
import { NotificationsScreen } from '@/components/web-social/notifications/NotificationsScreen';

export const metadata: Metadata = {
  title: 'Notifiche',
  description:
    'Nuovi follower, reazioni alle tue recensioni e brani consigliati ascoltati dagli amici.',
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
