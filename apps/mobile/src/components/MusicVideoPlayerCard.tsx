import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Play, VideoCamera, Clock } from 'phosphor-react-native';
import { THEME, type MusicVideoItem } from '@openmusic/shared';

interface MusicVideoPlayerCardProps {
  video: MusicVideoItem;
  onPressVideo?: (video: MusicVideoItem) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ESSAY: 'Video Saggio',
  REVIEW: 'Recensione Video',
  INTERVIEW: 'Intervista',
  LIVE_SESSION: 'Live Session',
};

export const MusicVideoPlayerCard: React.FC<MusicVideoPlayerCardProps> = ({
  video,
  onPressVideo,
}) => {
  const { title, creatorName, thumbnailUrl, durationSeconds, category } = video;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressVideo?.(video);
  }, [video, onPressVideo]);

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = String(durationSeconds % 60).padStart(2, '0');

  return (
    <Pressable
      onPress={handlePress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Video: ${title} di ${creatorName}`}
    >
      {/* Thumbnail con durata e categoria */}
      <View style={styles.thumbnailWrapper}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailFallback]}>
            <VideoCamera size={36} color={THEME.colors.textMuted} weight="duotone" />
          </View>
        )}

        {/* Play Icon Overlay */}
        <View style={styles.playOverlay}>
          <View style={styles.playCircle}>
            <Play size={20} color={THEME.colors.bgPrimary} weight="fill" />
          </View>
        </View>

        {/* Durata Video (fontMono + tabular-nums) */}
        <View style={styles.durationBadge}>
          <Clock size={10} color={THEME.colors.textPrimary} />
          <Text style={styles.durationText}>
            {minutes}:{seconds}
          </Text>
        </View>

        {/* Categoria Badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {CATEGORY_LABELS[category] ?? category}
          </Text>
        </View>
      </View>

      {/* Metadati Video */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.creatorName} numberOfLines={1}>
          di {creatorName}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  thumbnailWrapper: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: THEME.colors.bgInteractive,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.accentWarm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${THEME.colors.bgPrimary}E6`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationText: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: `${THEME.colors.bgPrimary}CC`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  categoryText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.accentWarm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoContainer: {
    padding: 14,
  },
  title: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  creatorName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
});
