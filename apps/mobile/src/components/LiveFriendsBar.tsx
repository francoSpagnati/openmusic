import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { THEME, type FriendPresence } from '@openmusic/shared';

interface LiveFriendsBarProps {
  friends: FriendPresence[];
  isMyGhostModeActive: boolean;
  onToggleGhostMode: (nextValue: boolean) => void;
  onPressFriendTrack: (friend: FriendPresence) => void;
}

export const LiveFriendsBar: React.FC<LiveFriendsBarProps> = ({
  friends,
  isMyGhostModeActive,
  onToggleGhostMode,
  onPressFriendTrack,
}) => {
  const ghostScale = useSharedValue(1);

  const animatedGhostStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ghostScale.value }],
  }));

  const handleGhostPress = useCallback(() => {
    ghostScale.value = withSpring(0.92, THEME.spring.snappy, () => {
      ghostScale.value = withSpring(1, THEME.spring.snappy);
    });
    onToggleGhostMode(!isMyGhostModeActive);
  }, [ghostScale, isMyGhostModeActive, onToggleGhostMode]);

  const renderFriendItem = useCallback(
    ({ item }: { item: FriendPresence }) => {
      const track = item.currentlyPlaying;
      const cardAccent = track?.dominantColor ?? THEME.colors.bgInteractive;

      return (
        <Pressable
          onPress={() => onPressFriendTrack(item)}
          style={[
            styles.friendPill,
            { borderColor: cardAccent },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            track
              ? `${item.username} sta ascoltando ${track.title} di ${track.artistName}`
              : `${item.username} è online`
          }
        >
          <View style={styles.avatarContainer}>
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]} />
            )}
            <View
              style={[
                styles.liveDot,
                {
                  backgroundColor: track?.isPlaying
                    ? THEME.colors.accentWarm
                    : THEME.colors.textMuted,
                },
              ]}
            />
          </View>

          {track ? (
            <View style={styles.trackMeta}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {track.artistName}
              </Text>
            </View>
          ) : (
            <Text style={styles.idleText} numberOfLines={1}>
              {item.username}
            </Text>
          )}
        </Pressable>
      );
    },
    [onPressFriendTrack]
  );

  return (
    <View style={styles.container}>
      {/* Euristica #1 e #3 di Nielsen: Stato del proprio Scrobbling + Ghost Mode 1-tap */}
      <Animated.View style={animatedGhostStyle}>
        <Pressable
          onPress={handleGhostPress}
          style={[
            styles.ghostToggle,
            isMyGhostModeActive && styles.ghostToggleActive,
          ]}
        >
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: isMyGhostModeActive
                  ? THEME.colors.textMuted
                  : THEME.colors.accentFresh,
              },
            ]}
          />
          <Text style={styles.ghostLabel}>
            {isMyGhostModeActive ? 'Ghost' : 'Live'}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Lista Orizzontale degli Amici in Ascolto */}
      <FlatList
        horizontal
        data={friends}
        keyExtractor={(item) => item.userId}
        renderItem={renderFriendItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  ghostToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    marginRight: 12,
  },
  ghostToggleActive: {
    borderColor: THEME.colors.accentWarm,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  ghostLabel: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    gap: 10,
  },
  friendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 190,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    backgroundColor: THEME.colors.bgInteractive,
  },
  liveDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: THEME.colors.bgElevated,
  },
  trackMeta: {
    flexShrink: 1,
  },
  trackTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  artistName: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  idleText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
  },
});