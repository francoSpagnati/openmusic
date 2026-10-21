import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  type ListViewToken as ViewToken,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Heart,
  Play,
  Pause,
  ArrowUUpLeft,
  Sparkle,
  SealCheck,
  Quotes,
} from 'phosphor-react-native';
import { THEME, type DiscoveryReelItem } from '@openmusic/shared';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const REEL_ITEM_HEIGHT = SCREEN_HEIGHT * 0.78;

interface DiscoveryReelsFeedProps {
  items: DiscoveryReelItem[];
  onSaveTrack?: (trackId: string, willSave: boolean) => void;
  onPressReview?: (reelItem: DiscoveryReelItem) => void;
}

export const DiscoveryReelsFeed: React.FC<DiscoveryReelsFeedProps> = ({
  items,
  onSaveTrack,
  onPressReview,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [canUndo, setCanUndo] = useState<boolean>(false);

  const flatListRef = useRef<FlatList<DiscoveryReelItem>>(null);
  const heartScale = useSharedValue(1);

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  // Soglia di Doherty: Traccia N corrente, pre-buffering logico per N+1 e N+2
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstItem = viewableItems[0];
      if (firstItem && typeof firstItem.index === 'number') {
        const nextIndex: number = firstItem.index;
        setActiveIndex(nextIndex);
        setCanUndo(nextIndex > 0);

        // Pre-caricamento logico audio (simulato o predisposto per audio engine)
        const nextItem1 = items[nextIndex + 1];
        if (nextItem1?.release.coverUrl) {
          Image.prefetch(nextItem1.release.coverUrl);
        }
      }
    },
    [items]
  );

  const handleToggleSave = useCallback(
    (trackId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      heartScale.value = withSpring(1.3, THEME.spring.snappy, () => {
        heartScale.value = withSpring(1, THEME.spring.snappy);
      });

      setSavedIds((prev) => {
        const next = new Set(prev);
        const willSave = !next.has(trackId);
        if (willSave) {
          next.add(trackId);
        } else {
          next.delete(trackId);
        }
        onSaveTrack?.(trackId, willSave);
        return next;
      });
    },
    [heartScale, onSaveTrack]
  );

  // Euristica #3 di Nielsen: Controllo e libertà dell'utente -> Annulla ultimo swipe
  const handleUndoSwipe = useCallback(() => {
    if (activeIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      flatListRef.current?.scrollToIndex({
        index: activeIndex - 1,
        animated: true,
      });
    }
  }, [activeIndex]);

  const renderItem = useCallback(
    ({ item, index }: { item: DiscoveryReelItem; index: number }) => {
      const isCurrent = index === activeIndex;
      const isSaved = savedIds.has(item.track.id);
      const isFresh = (item.release.audienceFreshPct ?? 0) >= 70;
      const hasAudienceScore =
        item.release.audienceCount > 0 && item.release.audienceFreshPct !== null;

      return (
        <View style={styles.reelCard}>
          {/* Sfondo con Cover Art e Tint Dinamico */}
          <View style={styles.coverWrapper}>
            {item.release.coverUrl ? (
              <Image source={{ uri: item.release.coverUrl }} style={styles.coverImage} />
            ) : (
              <View style={[styles.coverImage, styles.coverFallback]} />
            )}
            <View
              style={[
                styles.dynamicOverlay,
                {
                  backgroundColor: item.release.dominantColor
                    ? `${item.release.dominantColor}99`
                    : `${THEME.colors.bgPrimary}CC`,
                },
              ]}
            />
          </View>

          {/* Badge Audience Score (Rotten Tomatoes Style) */}
          <View style={styles.topBadgesRow}>
            {hasAudienceScore && (
              <View
                style={[
                  styles.scoreBadge,
                  {
                    backgroundColor: isFresh
                      ? `${THEME.colors.accentFresh}25`
                      : `${THEME.colors.accentRotten}25`,
                    borderColor: isFresh ? THEME.colors.accentFresh : THEME.colors.accentRotten,
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
                    styles.scoreText,
                    {
                      color: isFresh ? THEME.colors.accentFresh : THEME.colors.accentRotten,
                    },
                  ]}
                >
                  {item.release.audienceFreshPct}% Fresh
                </Text>
              </View>
            )}

            <View style={styles.previewIndicator}>
              <Text style={styles.previewTimer}>0:30 Clip</Text>
            </View>
          </View>

          {/* Informazioni Brano & Estratto Recensione Migliore */}
          <View style={styles.contentBottom}>
            <Text style={styles.trackTitle} numberOfLines={2}>
              {item.track.title}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {item.track.artistName} • {item.release.title}
            </Text>

            {item.topReviewSnippet && (
              <View style={styles.reviewSnippetBox}>
                <Quotes size={16} color={THEME.colors.accentWarm} weight="duotone" />
                <Text style={styles.reviewSnippetText} numberOfLines={2}>
                  "{item.topReviewSnippet.snippet}"
                </Text>
                <Text style={styles.reviewAuthor}>
                  — @{item.topReviewSnippet.authorName} ({item.topReviewSnippet.rating / 20} ★)
                </Text>
              </View>
            )}
          </View>

          {/* Barra Azioni nella Thumb Zone (Legge di Fitts) */}
          <View style={styles.actionColumn}>
            {/* Salva nei preferiti */}
            <Animated.View style={animatedHeartStyle}>
              <Pressable
                onPress={() => handleToggleSave(item.track.id)}
                style={[styles.actionBtn, isSaved && styles.actionBtnActive]}
                accessibilityLabel="Salva brano nella libreria"
              >
                <Heart
                  size={24}
                  color={isSaved ? THEME.colors.accentRotten : THEME.colors.textPrimary}
                  weight={isSaved ? 'fill' : 'regular'}
                />
              </Pressable>
            </Animated.View>

            {/* Play/Pause anteprima */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setIsPlaying(!isPlaying);
              }}
              style={styles.actionBtn}
              accessibilityLabel="Riproduci anteprima audio"
            >
              {isCurrent && isPlaying ? (
                <Pause size={24} color={THEME.colors.textPrimary} weight="fill" />
              ) : (
                <Play size={24} color={THEME.colors.textPrimary} weight="fill" />
              )}
            </Pressable>

            {/* Recensisci */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onPressReview?.(item);
              }}
              style={styles.actionBtn}
              accessibilityLabel="Scrivi recensione"
            >
              <SealCheck size={24} color={THEME.colors.textPrimary} weight="duotone" />
            </Pressable>
          </View>
        </View>
      );
    },
    [activeIndex, savedIds, isPlaying, heartScale, handleToggleSave, onPressReview]
  );

  return (
    <View style={styles.container}>
      {/* Euristica #3: Pulsante Undo Swipe flottante in alto a sinistra */}
      {canUndo && (
        <Pressable onPress={handleUndoSwipe} style={styles.undoFloatingBtn}>
          <ArrowUUpLeft size={16} color={THEME.colors.textPrimary} weight="bold" />
          <Text style={styles.undoText}>Annulla swipe</Text>
        </Pressable>
      )}

      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_ITEM_HEIGHT + 16}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgPrimary,
    position: 'relative',
  },
  undoFloatingBtn: {
    position: 'absolute',
    top: 14,
    left: 16,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${THEME.colors.bgElevated}EE`,
    borderColor: THEME.colors.borderSubtle,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  undoText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  reelCard: {
    height: REEL_ITEM_HEIGHT,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    backgroundColor: THEME.colors.bgElevated,
    justifyContent: 'space-between',
    padding: 20,
  },
  coverWrapper: {
    ...StyleSheet.absoluteFill,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverFallback: {
    backgroundColor: THEME.colors.bgInteractive,
  },
  dynamicOverlay: {
    ...StyleSheet.absoluteFill,
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  scoreText: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  previewIndicator: {
    backgroundColor: `${THEME.colors.bgPrimary}AA`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  previewTimer: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  contentBottom: {
    zIndex: 10,
    paddingRight: 60,
  },
  trackTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    lineHeight: 30,
    marginBottom: 6,
  },
  artistName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.accentWarm,
    marginBottom: 14,
  },
  reviewSnippetBox: {
    backgroundColor: `${THEME.colors.bgElevated}DD`,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    gap: 4,
  },
  reviewSnippetText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  reviewAuthor: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    color: THEME.colors.textSecondary,
    alignSelf: 'flex-end',
  },
  actionColumn: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    gap: 16,
    zIndex: 20,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${THEME.colors.bgElevated}EE`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  actionBtnActive: {
    borderColor: THEME.colors.accentRotten,
  },
});
