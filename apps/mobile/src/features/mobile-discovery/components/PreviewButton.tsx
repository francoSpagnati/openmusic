import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '../../../theme';
import { Pause, Play, SpeakerSlash } from '../icons';
import { haptics } from '../haptics';
import { usePreviewPlayer } from '../PreviewPlayer';
import type { PreviewTrack } from '../preview';
import { IconAction } from './IconAction';

export interface PreviewButtonProps {
  track: PreviewTrack;
  size?: number;
  overlay?: boolean;
  caption?: boolean;
}

/** Play / pause the 30s preview of a track in the screen's `PreviewPlayerProvider`. */
export function PreviewButton({
  track,
  size = 44,
  overlay = false,
  caption = false,
}: PreviewButtonProps) {
  const { colors } = useTheme();
  const preview = usePreviewPlayer();
  const state = preview.stateOf(track.id);
  const iconSize = Math.round(size * 0.42);
  const name = `${track.title} di ${track.artistName}`;

  const label =
    state === 'playing'
      ? `Metti in pausa ${name}`
      : state === 'loading'
        ? `Caricamento anteprima di ${name}`
        : state === 'unavailable'
          ? `Nessuna anteprima per ${name}`
          : `Ascolta 30 secondi di ${name}`;

  const icon =
    state === 'loading' ? (
      <ActivityIndicator color={colors.accent} />
    ) : state === 'playing' ? (
      <Pause size={iconSize} color={colors.accentContrast} weight="fill" />
    ) : state === 'unavailable' ? (
      <SpeakerSlash size={iconSize} color={colors.textSubtle} />
    ) : (
      <Play size={iconSize} color={colors.text} weight="fill" />
    );

  return (
    <IconAction
      label={label}
      testID={`preview-${track.id}`}
      icon={icon}
      size={size}
      overlay={overlay}
      active={state === 'playing'}
      busy={state === 'loading'}
      caption={
        caption
          ? state === 'unavailable'
            ? 'Nessuna clip'
            : state === 'error'
              ? 'Riprova'
              : 'Anteprima'
          : undefined
      }
      accessibilityHint={
        state === 'error' ? 'Anteprima non caricata: tocca per riprovare' : undefined
      }
      onPress={() => {
        haptics.tap();
        preview.toggle(track);
      }}
    />
  );
}
