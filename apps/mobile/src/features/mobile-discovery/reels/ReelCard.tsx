import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import type { DiscoveryReelItem } from '@openmusic/shared';
import { useTheme, withAlpha } from '../../../theme';
import { CoverArt, RatingStars, ScoreBadge, Text, starsFromRating } from '../../../components/ui';
import { SealCheck } from '../../../components/icons';
import { ArrowUUpLeft, BookmarkSimple, Pause, Play, Quotes, SpeakerSlash, X } from '../icons';
import { IconAction } from '../components/IconAction';
import { usePreviewPlayer } from '../PreviewPlayer';
import { previewSourceLabel } from '../preview';
import { tintAlpha } from '../catalog';
import { haptics } from '../haptics';

export interface ReelCardProps {
  item: DiscoveryReelItem;
  index: number;
  total: number;
  height: number;
  active: boolean;
  saved: boolean;
  canGoBack: boolean;
  onTogglePlay: () => void;
  onSave: () => void;
  onHide: () => void;
  onBack: () => void;
}

/**
 * One full-height reel: blurred cover backdrop tinted with the release's dominant colour, the
 * cover, track/release info, the best review and the action rail in the thumb zone (bottom
 * right). Screen readers get the same actions as custom accessibility actions on the card.
 */
export function ReelCard({
  item,
  index,
  total,
  height,
  active,
  saved,
  canGoBack,
  onTogglePlay,
  onSave,
  onHide,
  onBack,
}: ReelCardProps) {
  const theme = useTheme();
  const { colors, space, radii } = theme;
  const { width } = useWindowDimensions();
  const preview = usePreviewPlayer();
  const state = active ? preview.stateOf(item.track.id) : 'idle';
  const { release, track, topReviewSnippet: review } = item;
  const cover = release.coverUrl ?? track.coverUrl ?? null;
  const coverSize = Math.min(width - space[8] * 2, height * 0.42);
  const sourceLabel =
    active && preview.currentSource ? previewSourceLabel(preview.currentSource) : null;
  const openRelease = () => router.push(`/release/${release.id}`);

  // Clip progress on the UI thread: each 250 ms status tick eases into the next.
  const progress = useSharedValue(0);
  const target = active ? preview.progress : 0;
  useEffect(() => {
    progress.value =
      target === 0 ? 0 : withTiming(target, { duration: 250, easing: Easing.linear });
  }, [progress, target]);
  const progressStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  const playing = state === 'playing';
  const unavailable = state === 'unavailable';

  return (
    <View
      testID={`reel-${index}`}
      style={[styles.page, { height, backgroundColor: colors.bg }]}
      accessible={false}
      accessibilityActions={[
        { name: 'magicTap', label: playing ? 'Pausa' : 'Riproduci' },
        { name: 'save', label: 'Salva nella playlist' },
        { name: 'hide', label: 'Non fa per me' },
        { name: 'open', label: 'Apri il disco' },
      ]}
      onAccessibilityAction={(event) => {
        switch (event.nativeEvent.actionName) {
          case 'magicTap':
            onTogglePlay();
            break;
          case 'save':
            onSave();
            break;
          case 'hide':
            onHide();
            break;
          case 'open':
            openRelease();
            break;
        }
      }}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={40}
          cachePolicy="memory-disk"
          recyclingKey={cover}
          accessible={false}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: withAlpha(
              release.dominantColor,
              tintAlpha(release.dominantColor, theme.name)
            ),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.bg, 0.78) }]}
      />

      <View style={[styles.topRow, { paddingHorizontal: space[5], paddingTop: space[3] }]}>
        <ScoreBadge
          kind="audience"
          size="sm"
          percentage={release.audienceCount > 0 ? (release.audienceFreshPct ?? null) : null}
          totalReviews={release.audienceCount}
        />
        <Text
          variant="mono"
          size="xs"
          tone="secondary"
          accessibilityLabel={`Reel ${index + 1} di ${total}`}
        >
          {index + 1} / {total}
        </Text>
      </View>

      <View style={[styles.center, { paddingHorizontal: space[4] }]}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Copertina di ${release.title}, ${release.artistName}. Apri il disco`}
          onPress={openRelease}
        >
          <CoverArt key={cover ?? 'none'} uri={cover} size={coverSize} />
        </Pressable>
      </View>

      <View
        style={[
          styles.bottom,
          { paddingHorizontal: space[5], paddingBottom: space[5], gap: space[4] },
        ]}
      >
        <View style={styles.info}>
          <Text variant="eyebrow" numberOfLines={1}>
            {[release.genres[0], release.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ') ||
              'Anteprima 30 s'}
          </Text>
          <Text variant="headline" size="3xl" numberOfLines={2} accessibilityRole="header">
            {track.title}
          </Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {track.artistName}
          </Text>
          <Text size="sm" tone="secondary" numberOfLines={1}>
            da {release.title}
          </Text>
          {review ? (
            <View
              accessible
              accessibilityLabel={`Recensione di ${review.authorName}, ${starsFromRating(review.rating)} stelle: ${review.snippet}`}
              style={[
                styles.review,
                {
                  backgroundColor: withAlpha(colors.surfaceRaised, 0.92),
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  padding: space[3],
                },
              ]}
            >
              <View style={styles.reviewHead}>
                <Quotes size={16} color={colors.textSubtle} weight="fill" />
                <RatingStars value={starsFromRating(review.rating)} size="sm" />
                {review.isVerifiedListen ? (
                  <SealCheck size={14} color={colors.fresh} weight="fill" />
                ) : null}
              </View>
              <Text variant="deck" size="base" numberOfLines={3}>
                “{review.snippet}”
              </Text>
              <Text variant="caption" size="xs" tone="secondary">
                — @{review.authorName}
              </Text>
            </View>
          ) : null}
          {unavailable ? (
            <Text variant="caption" size="xs" tone="secondary">
              Nessuna anteprima su Spotify, Deezer o iTunes per questo brano.
            </Text>
          ) : state === 'error' ? (
            <Text variant="caption" size="xs" tone="rotten">
              Anteprima non caricata. Tocca play per riprovare.
            </Text>
          ) : sourceLabel ? (
            <Text variant="caption" size="xs" tone="muted">
              Anteprima da {sourceLabel}
            </Text>
          ) : null}
        </View>

        <View style={[styles.rail, { gap: space[3] }]}>
          <IconAction
            overlay
            size={48}
            label="Torna al reel precedente"
            caption="Indietro"
            disabled={!canGoBack}
            onPress={onBack}
            icon={<ArrowUUpLeft size={22} color={colors.text} weight="regular" />}
          />
          <IconAction
            overlay
            size={48}
            label={
              saved
                ? `${track.title} è già nella playlist Scoperte dai Reels`
                : `Salva ${track.title} nella playlist Scoperte dai Reels`
            }
            caption={saved ? 'Salvato' : 'Salva'}
            active={saved}
            onPress={onSave}
            icon={
              <BookmarkSimple
                size={22}
                color={saved ? colors.accentContrast : colors.text}
                weight={saved ? 'fill' : 'regular'}
              />
            }
          />
          <IconAction
            overlay
            size={48}
            label={`Non fa per me: nascondi ${track.title}`}
            caption="Non fa per me"
            onPress={() => {
              haptics.thud();
              onHide();
            }}
            icon={<X size={22} color={colors.text} weight="regular" />}
          />
          <IconAction
            overlay
            testID={`reel-play-${index}`}
            size={64}
            label={
              unavailable
                ? `Nessuna anteprima per ${track.title}`
                : playing
                  ? `Metti in pausa ${track.title}`
                  : `Ascolta 30 secondi di ${track.title}`
            }
            active={playing}
            busy={state === 'loading'}
            disabled={unavailable}
            onPress={() => {
              haptics.tap();
              onTogglePlay();
            }}
            icon={
              unavailable ? (
                <SpeakerSlash size={26} color={colors.textSubtle} />
              ) : playing ? (
                <Pause size={28} color={colors.accentContrast} weight="fill" />
              ) : (
                <Play size={28} color={colors.text} weight="fill" />
              )
            }
          />
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.progressTrack,
          { backgroundColor: withAlpha(colors.text, active ? 0.12 : 0) },
        ]}
      >
        <Animated.View
          style={[styles.progressFill, { backgroundColor: colors.accent }, progressStyle]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden', justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { alignItems: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end' },
  info: { flex: 1, minWidth: 0, gap: 4 },
  review: { borderWidth: StyleSheet.hairlineWidth, gap: 6, marginTop: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rail: { alignItems: 'center' },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
  progressFill: { height: 2, width: '100%', transformOrigin: 'left' },
});
