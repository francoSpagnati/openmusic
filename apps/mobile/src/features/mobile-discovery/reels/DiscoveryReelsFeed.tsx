import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import type { DiscoveryReelItem } from '@openmusic/shared';
import { usePreviewPlayer } from '../PreviewPlayer';
import { lookaheadIndices } from '../preview';
import { haptics } from '../haptics';
import { ReelCard } from './ReelCard';

export interface DiscoveryReelsFeedProps {
  items: DiscoveryReelItem[];
  savedTrackIds: ReadonlySet<string>;
  onSave: (item: DiscoveryReelItem) => void;
  onHide: (item: DiscoveryReelItem) => void;
  /** Rendered as the last page ("fine del lato B"). */
  footer: React.ReactNode;
  /** Bump to jump back to a reel (e.g. after undoing "Non fa per me"). */
  focusIndex?: { index: number; nonce: number } | null;
}

/** How many reels ahead get their clip resolved and buffered (N+1, N+2). */
export const PREBUFFER_AHEAD = 2;

/**
 * Vertical, paged reels on FlashList. The snapped reel autoplays its 30s clip (looping) while the
 * screen is focused; the next two clips and covers are pre-buffered so the next swipe starts in
 * < 400 ms. Pausing sticks until the listener swipes to another reel.
 */
export function DiscoveryReelsFeed({
  items,
  savedTrackIds,
  onSave,
  onHide,
  footer,
  focusIndex,
}: DiscoveryReelsFeedProps) {
  const list = useRef<FlashListRef<DiscoveryReelItem>>(null);
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const preview = usePreviewPlayer();
  const focused = useIsFocused();
  // Undefined on the closing card (index === items.length): nothing autoplays there.
  const activeItem = items[active];
  const activeTrackId = activeItem?.track.id;

  // Keep `active` inside the list when reels are hidden at the end.
  useEffect(() => {
    if (items.length > 0 && active > items.length) setActive(items.length);
  }, [items.length, active]);

  useEffect(() => {
    if (!focusIndex) return;
    const index = Math.max(0, Math.min(focusIndex.index, items.length - 1));
    setActive(index);
    list.current?.scrollToIndex({ index, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new request
  }, [focusIndex?.nonce]);

  // Autoplay the snapped reel; pre-buffer N+1 and N+2 (audio + cover).
  const playerRef = useRef(preview);
  playerRef.current = preview;
  useEffect(() => {
    const item = activeTrackId ? items.find((i) => i.track.id === activeTrackId) : undefined;
    const ahead = lookaheadIndices(active, items.length, PREBUFFER_AHEAD)
      .map((i) => items[i])
      .filter((i): i is DiscoveryReelItem => i !== undefined);
    playerRef.current.prebuffer(ahead.map((i) => i.track));
    const covers = ahead
      .map((i) => i.release.coverUrl ?? i.track.coverUrl)
      .filter((u): u is string => Boolean(u));
    if (covers.length > 0) void Image.prefetch(covers, 'memory-disk').catch(() => false);

    if (!item) {
      playerRef.current.pause();
      return;
    }
    if (!focused || userPaused) return;
    if (
      playerRef.current.currentKey !== item.track.id ||
      playerRef.current.stateOf(item.track.id) === 'idle'
    ) {
      void playerRef.current.play(item.track);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the reel, not to player ticks
  }, [active, activeTrackId, focused, userPaused, items.length]);

  const onMomentumEnd = useCallback(
    // Structural type: FlashList's typings resolve the root react-native copy (see README, two Reacts).
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (height <= 0) return;
      const next = Math.round(event.nativeEvent.contentOffset.y / height);
      if (next !== active) {
        haptics.select();
        setUserPaused(false);
        setActive(next);
      }
    },
    [height, active]
  );

  const goBack = useCallback(() => {
    if (active <= 0) return;
    haptics.thud();
    const index = active - 1;
    setUserPaused(false);
    setActive(index);
    list.current?.scrollToIndex({ index, animated: true });
  }, [active]);

  const togglePlay = useCallback(
    (item: DiscoveryReelItem) => {
      const state = preview.stateOf(item.track.id);
      setUserPaused(state === 'playing' || state === 'loading');
      preview.toggle(item.track);
    },
    [preview]
  );

  return (
    <View
      testID="reels-feed"
      style={styles.flex}
      onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}
    >
      {height > 0 ? (
        <FlashList
          ref={list}
          data={items}
          keyExtractor={(item) => item.id}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          extraData={{ active, savedTrackIds, preview }}
          accessibilityLabel="Reels: anteprime da 30 secondi, scorri in verticale"
          renderItem={({ item, index }) => (
            <ReelCard
              item={item}
              index={index}
              total={items.length}
              height={height}
              active={index === active}
              saved={item.isSaved || savedTrackIds.has(item.track.id)}
              canGoBack={index > 0}
              onTogglePlay={() => togglePlay(item)}
              onSave={() => onSave(item)}
              onHide={() => onHide(item)}
              onBack={goBack}
            />
          )}
          ListFooterComponent={<View style={{ height }}>{footer}</View>}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
