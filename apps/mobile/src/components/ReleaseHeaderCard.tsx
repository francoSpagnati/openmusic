import React, { useCallback } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Play, Pause, Sparkle, SealCheck } from 'phosphor-react-native';
import { THEME, type CatalogRelease } from '@openmusic/shared';

interface ReleaseHeaderCardProps {
  release: CatalogRelease;
  isPlayingPreview?: boolean;
  onTogglePlayPreview?: () => void;
  onPressReview?: () => void;
}

export const ReleaseHeaderCard: React.FC<ReleaseHeaderCardProps> = ({
  release,
  isPlayingPreview = false,
  onTogglePlayPreview,
  onPressReview,
}) => {
  const playScale = useSharedValue(1);

  const animatedPlayStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  const handlePlayPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    playScale.value = withSpring(0.92, THEME.spring.snappy, () => {
      playScale.value = withSpring(1, THEME.spring.snappy);
    });
    onTogglePlayPreview?.();
  }, [playScale, onTogglePlayPreview]);

  const handleReviewPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressReview?.();
  }, [onPressReview]);

  // ADR-001: Calcolo visivo stato "Fresh" (>= 70%) stile Rotten Tomatoes
  const isFresh = (release.audienceFreshPct ?? 0) >= 70;
  const hasAudienceScore = release.audienceCount > 0 && release.audienceFreshPct !== null;

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: release.dominantColor
            ? `${release.dominantColor}55`
            : THEME.colors.borderSubtle,
        },
      ]}
    >
      {/* Copertina Album e Badge Riproduzione */}
      <View style={styles.topRow}>
        <View style={styles.coverWrapper}>
          {release.coverUrl ? (
            <Image source={{ uri: release.coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverImage, styles.coverFallback]} />
          )}

          {onTogglePlayPreview && (
            <Animated.View style={[styles.playButtonWrapper, animatedPlayStyle]}>
              <Pressable
                onPress={handlePlayPress}
                style={[
                  styles.playButton,
                  isPlayingPreview && styles.playButtonActive,
                ]}
                accessibilityLabel={
                  isPlayingPreview ? 'Metti in pausa anteprima' : 'Ascolta anteprima 30s'
                }
              >
                {isPlayingPreview ? (
                  <Pause size={18} color={THEME.colors.bgPrimary} weight="fill" />
                ) : (
                  <Play size={18} color={THEME.colors.bgPrimary} weight="fill" />
                )}
              </Pressable>
            </Animated.View>
          )}
        </View>

        {/* Metadati Editoriali */}
        <View style={styles.metaContainer}>
          <Text style={styles.releaseType}>{release.releaseType}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {release.title}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {release.artistName}
          </Text>

          {/* Badge Audience Score (ADR-001 Rotten Tomatoes Style) */}
          <View style={styles.scoreRow}>
            {hasAudienceScore ? (
              <View
                style={[
                  styles.scoreBadge,
                  {
                    backgroundColor: isFresh
                      ? `${THEME.colors.accentFresh}20`
                      : `${THEME.colors.accentRotten}20`,
                    borderColor: isFresh
                      ? THEME.colors.accentFresh
                      : THEME.colors.accentRotten,
                  },
                ]}
              >
                <Sparkle
                  size={14}
                  color={isFresh ? THEME.colors.accentFresh : THEME.colors.accentRotten}
                  weight="fill"
                />
                <Text
                  style={[
                    styles.scorePct,
                    {
                      color: isFresh
                        ? THEME.colors.accentFresh
                        : THEME.colors.accentRotten,
                    },
                  ]}
                >
                  {release.audienceFreshPct}%
                </Text>
              </View>
            ) : (
              <View style={[styles.scoreBadge, styles.scoreBadgeNew]}>
                <Text style={styles.scorePctNew}>Nuovo</Text>
              </View>
            )}

            <View style={styles.ratingDetails}>
              {release.audienceAvg !== null && release.audienceAvg !== undefined ? (
                <Text style={styles.ratingAvg}>
                  {release.audienceAvg.toFixed(1)} <Text style={styles.ratingMax}>/ 5.0</Text>
                </Text>
              ) : null}
              <Text style={styles.reviewCount}>
                {release.audienceCount} {release.audienceCount === 1 ? 'voto' : 'voti'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tasto Rapido di Azione (Legge di Fitts) */}
      {onPressReview && (
        <Pressable onPress={handleReviewPress} style={styles.reviewButton}>
          <SealCheck size={16} color={THEME.colors.textPrimary} weight="duotone" />
          <Text style={styles.reviewButtonText}>Scrivi una recensione</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
  },
  coverWrapper: {
    position: 'relative',
  },
  coverImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  coverFallback: {
    backgroundColor: THEME.colors.bgInteractive,
  },
  playButtonWrapper: {
    position: 'absolute',
    bottom: -6,
    right: -6,
  },
  playButton: {
    backgroundColor: THEME.colors.accentWarm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  playButtonActive: {
    backgroundColor: THEME.colors.accentFresh,
  },
  metaContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  releaseType: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    color: THEME.colors.accentWarm,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    lineHeight: 22,
    marginBottom: 4,
  },
  artistName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  scoreBadgeNew: {
    backgroundColor: THEME.colors.bgInteractive,
    borderColor: THEME.colors.borderSubtle,
  },
  scorePct: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scorePctNew: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  ratingDetails: {
    flexDirection: 'column',
  },
  ratingAvg: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  ratingMax: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  reviewCount: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  reviewButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.bgInteractive,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  reviewButtonText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
});
