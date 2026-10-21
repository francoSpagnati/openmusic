import React from 'react';
import type { Metadata } from 'next';
import { Sidebar } from '../../components/Sidebar';
import { ReelsFeed } from './ReelsFeed';

export const metadata: Metadata = {
  title: 'Reels',
  description:
    'Scorri anteprime di 30 secondi con il voto della critica e del pubblico e la recensione migliore della community.',
};

export default function ReelsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl justify-center">
      <Sidebar />
      <section
        aria-label="Reels musicali"
        // Full viewport minus the mobile top bar (the desktop rail has none).
        className="h-[calc(100dvh-61px)] min-w-0 flex-1 lg:h-dvh lg:border-r lg:border-line"
      >
        <ReelsFeed />
      </section>
    </div>
  );
}
