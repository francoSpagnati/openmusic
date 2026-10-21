import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { MusicVideoItem, VideoCategory } from '@openmusic/shared';
import { useTheme, withAlpha } from '../../../theme';
import { Badge, Text } from '../../../components/ui';
import { formatDuration } from '../../../lib/format';
import { Play, VideoCamera } from '../icons';

export const VIDEO_CATEGORY_LABELS: Record<VideoCategory, string> = {
  ESSAY: 'Video-saggio',
  REVIEW: 'Video-recensione',
  INTERVIEW: 'Intervista',
  LIVE_SESSION: 'Live session',
};

/** Video essay / interview / live session about a release; opens in the browser or the YouTube app. */
export function VideoCard({ video, width = 240 }: { video: MusicVideoItem; width?: number }) {
  const { colors, radii, space } = useTheme();
  const label = VIDEO_CATEGORY_LABELS[video.category];
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${video.title}, di ${video.creatorName}, ${formatDuration(video.durationSeconds * 1000)}`}
      accessibilityHint="Apre il video"
      onPress={() => void Linking.openURL(video.videoUrl).catch(() => undefined)}
      style={({ pressed }) => [{ width, gap: space[2], opacity: pressed ? 0.75 : 1 }]}
    >
      <View
        style={[
          styles.thumb,
          { borderRadius: radii.md, backgroundColor: colors.sunken, borderColor: colors.border },
        ]}
      >
        {video.thumbnailUrl ? (
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={160}
            accessible={false}
          />
        ) : (
          <VideoCamera size={32} color={colors.muted} weight="duotone" />
        )}
        <View
          style={[
            styles.play,
            { backgroundColor: withAlpha(colors.bg, 0.7), borderRadius: radii.pill },
          ]}
        >
          <Play size={20} color={colors.text} weight="fill" />
        </View>
        <View
          style={[
            styles.duration,
            { backgroundColor: withAlpha(colors.bg, 0.8), borderRadius: radii.sm },
          ]}
        >
          <Text variant="mono" size="xs">
            {formatDuration(video.durationSeconds * 1000)}
          </Text>
        </View>
      </View>
      <Badge label={label} size="sm" variant="outline" />
      <Text variant="bodyStrong" size="sm" numberOfLines={2}>
        {video.title}
      </Text>
      <Text variant="caption" size="xs" tone="secondary" numberOfLines={1}>
        {video.creatorName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  play: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  duration: { position: 'absolute', right: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2 },
});
