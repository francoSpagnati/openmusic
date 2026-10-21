import type { Metadata } from 'next';
import { HomeFeed } from '@/components/web-core/feed/HomeFeed';

export const metadata: Metadata = {
  title: { absolute: 'OpenMusic — Il feed dei tuoi amici' },
  description:
    'Cosa stanno ascoltando le persone che segui: post, voti e anteprime di 30 secondi su OpenMusic.',
};

export default function HomePage() {
  return <HomeFeed />;
}
