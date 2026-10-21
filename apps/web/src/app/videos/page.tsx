import React from 'react';
import type { Metadata } from 'next';
import { VideoCamera } from '@phosphor-icons/react/dist/ssr';
import type { MusicVideoItem } from '@openmusic/shared';
import { api } from '../../lib/api';
import { DiscoveryShell, PageOpener } from '../../components/discovery/DiscoveryShell';
import { VideosClient } from './VideosClient';

export const metadata: Metadata = {
  title: 'Video-saggi e approfondimenti',
  description:
    'Video-saggi, recensioni, interviste e live session scelti dalla critica accreditata e collegati alle schede dei dischi.',
};

export const dynamic = 'force-dynamic';

export default async function VideosPage() {
  let initial: MusicVideoItem[] | null = null;
  try {
    initial = await api.videos.feed();
  } catch {
    // The client shows an error state with retry.
  }

  return (
    <DiscoveryShell className="space-y-8">
      <PageOpener
        eyebrow="Video · Approfondimenti"
        icon={<VideoCamera weight="duotone" />}
        title="L’approfondimento che la musica merita"
        deck="Analisi, interviste e sessioni dal vivo selezionate dalla critica, con un link diretto al video originale."
      />
      <VideosClient initialVideos={initial} />
    </DiscoveryShell>
  );
}
