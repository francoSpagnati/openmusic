'use client';

import React from 'react';
import { Pause, Play, SpeakerSlash } from '@phosphor-icons/react';
import { useAudioPlayer, type PlayingTrack } from '../../context/AudioPlayerContext';
import {
  IconButton,
  type IconButtonShape,
  type IconButtonSize,
  type IconButtonVariant,
} from '../ui';

export interface PreviewPlayButtonProps {
  track: PlayingTrack;
  /** Used in the accessible label: "Ascolta l’anteprima di <label>". */
  label?: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  shape?: IconButtonShape;
  className?: string;
}

/** Play/pause toggle for one track's 30s preview, reflecting the shared player state. */
export function PreviewPlayButton({
  track,
  label,
  size = 'md',
  variant = 'solid',
  shape,
  className,
}: PreviewPlayButtonProps) {
  const { currentTrack, status, playTrack } = useAudioPlayer();
  const isCurrent = currentTrack?.id === track.id;
  const active =
    isCurrent && (status === 'playing' || status === 'loading' || status === 'resolving');
  const unavailable = isCurrent && status === 'unavailable';
  const name = label ?? `${track.title} di ${track.artist}`;

  return (
    <IconButton
      label={
        unavailable
          ? `Anteprima non disponibile per ${name}`
          : active
            ? `Metti in pausa ${name}`
            : `Ascolta l’anteprima di ${name}`
      }
      size={size}
      variant={variant}
      shape={shape}
      loading={isCurrent && (status === 'resolving' || status === 'loading')}
      disabled={unavailable}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        playTrack(track);
      }}
      icon={
        unavailable ? <SpeakerSlash /> : active ? <Pause weight="fill" /> : <Play weight="fill" />
      }
    />
  );
}
