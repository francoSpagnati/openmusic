import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CatalogTrack } from '@openmusic/shared';
import { useTheme, withAlpha } from '../../../theme';
import { Card, Text } from '../../../components/ui';
import { formatDuration } from '../../../lib/format';
import { formatRunningTime, splitSides } from '../catalog';
import { PreviewButton } from '../components/PreviewButton';
import { usePreviewPlayer } from '../PreviewPlayer';

/** Tracklist split into vinyl sides A and B, each track with its 30s preview. */
export function Tracklist({
  tracks,
  fallbackCover,
}: {
  tracks: CatalogTrack[];
  fallbackCover?: string | null;
}) {
  const { colors, space, radii } = useTheme();
  const preview = usePreviewPlayer();
  const sides = splitSides(tracks);
  if (sides.length === 0) return null;
  return (
    <View style={{ gap: space[3] }}>
      {sides.map((side) => (
        <Card key={side.name} variant="sunken" padding="sm">
          <View style={[styles.sideHead, { marginBottom: space[1] }]} accessibilityRole="header">
            <Text variant="eyebrow">Lato {side.name}</Text>
            <Text variant="mono" size="xs" tone="muted">
              {formatRunningTime(side.durationMs)}
            </Text>
          </View>
          {side.tracks.map((track, i) => {
            const current = preview.currentKey === track.id;
            const withCover = track.coverUrl
              ? track
              : { ...track, coverUrl: fallbackCover ?? null };
            return (
              <View
                key={track.id}
                style={[
                  styles.track,
                  { borderRadius: radii.sm, paddingHorizontal: space[1] },
                  current && { backgroundColor: withAlpha(colors.accent, 0.08) },
                ]}
              >
                <Text
                  variant="mono"
                  size="sm"
                  tone={current ? 'accent' : 'muted'}
                  style={styles.trackNo}
                >
                  {track.trackNumber ?? i + 1}
                </Text>
                <View style={styles.flex}>
                  <Text size="sm" numberOfLines={1} tone={current ? 'accent' : 'primary'}>
                    {track.title}
                  </Text>
                  {track.artistName && tracks[0] && track.artistName !== tracks[0].artistName ? (
                    <Text variant="caption" size="xs" tone="secondary" numberOfLines={1}>
                      {track.artistName}
                    </Text>
                  ) : null}
                </View>
                <Text variant="mono" size="sm" tone="muted">
                  {formatDuration(track.durationMs)}
                </Text>
                <PreviewButton track={withCover} size={44} />
              </View>
            );
          })}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sideHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2, minHeight: 48 },
  trackNo: { width: 24 },
  flex: { flex: 1, minWidth: 0 },
});
