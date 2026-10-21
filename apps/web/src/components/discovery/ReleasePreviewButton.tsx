'use client';

import React, { useState } from 'react';
import { Play } from '@phosphor-icons/react';
import type { CatalogRelease, CatalogTrack } from '@openmusic/shared';
import { api } from '../../lib/api';
import { useAudioPlayer, type PlayingTrack } from '../../context/AudioPlayerContext';
import { IconButton, useToast, type IconButtonSize } from '../ui';
import { PreviewPlayButton } from './PreviewPlayButton';

export function toPlayingTrack(
  track: CatalogTrack,
  fallback?: { coverUrl?: string | null; releaseId?: string }
): PlayingTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artistName,
    coverUrl: track.coverUrl ?? fallback?.coverUrl ?? null,
    previewUrl: track.previewUrl ?? null,
    isrc: track.isrc ?? null,
    releaseId: track.releaseId ?? fallback?.releaseId ?? null,
  };
}

interface ReleasePreviewButtonProps {
  release: Pick<CatalogRelease, 'id' | 'title' | 'artistName' | 'coverUrl' | 'tracks'>;
  size?: IconButtonSize;
  className?: string;
}

/**
 * Plays the opening track of a release. Browse results do not carry tracks, so the first click
 * loads the tracklist, then hands over to the regular preview button.
 */
export function ReleasePreviewButton({
  release,
  size = 'md',
  className,
}: ReleasePreviewButtonProps) {
  const { playTrack } = useAudioPlayer();
  const { notify } = useToast();
  const [opening, setOpening] = useState<CatalogTrack | null>(release.tracks?.[0] ?? null);
  const [loading, setLoading] = useState(false);
  const fallback = { coverUrl: release.coverUrl, releaseId: release.id };

  if (opening) {
    return (
      <PreviewPlayButton
        track={toPlayingTrack(opening, fallback)}
        label={`${opening.title}, da ${release.title}`}
        size={size}
        className={className}
      />
    );
  }

  const load = async () => {
    setLoading(true);
    try {
      const full = await api.catalog.release(release.id);
      const first = full.tracks?.[0];
      if (!first) {
        notify({ title: 'Questo disco non ha ancora una tracklist', tone: 'neutral' });
        return;
      }
      setOpening(first);
      playTrack(toPlayingTrack(first, fallback));
    } catch {
      notify({
        title: 'Non riesco a caricare la tracklist',
        description: 'Riprova tra poco.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <IconButton
      label={`Ascolta l’anteprima di ${release.title} di ${release.artistName}`}
      variant="solid"
      size={size}
      loading={loading}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!loading) void load();
      }}
      icon={<Play weight="fill" />}
    />
  );
}
