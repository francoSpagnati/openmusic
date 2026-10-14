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
import * as Haptics from 'expo-haptics';
import { Ghost, Broadcast, Disc } from 'phosphor-react-native';
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
    // Feedback tattile istantaneo (Legge di Fitts + Nielsen #1)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    ghostScale.value = withSpring(0.90, THEME.spring.snappy, () => {
      ghostScale.value = withSpring(1, THEME.spring.snappy);
    });
    onToggleGhostMode(!isMyGhostModeActive);
  }, [ghostScale, isMyGhostModeActive, onToggleGhostMode]);

  const handleFriendPress = useCallback(
    (friend: FriendPresence) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPressFriendTrack(friend);
    },
    [onPressFriendTrack]
  );

  const renderFriendItem = useCallback(
    ({ item }: { item: FriendPresence }) => {
      const track = item.currentlyPlaying;
      const cardAccent = track?.dominantColor ?? THEME.colors.borderSubtle;

      return (
        <Pressable
          onPress={() => handleFriendPress(item)}
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
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Disc size={16} color={THEME.colors.textMuted} weight="duotone" />
              </View>
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
    [handleFriendPress]
  );

  return (
    <View style={styles.container}>
      {/* Euristica #1 e #3 di Nielsen: Stato Scrobbling + Ghost Mode 1-tap con Phosphor Icons & Haptics */}
      <Animated.View style={animatedGhostStyle}>
        <Pressable
          onPress={handleGhostPress}
          style={[
            styles.ghostToggle,
            isMyGhostModeActive && styles.ghostToggleActive,
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: isMyGhostModeActive }}
          accessibilityLabel="Attiva o disattiva Ghost Mode"
        >
          {isMyGhostModeActive ? (
            <Ghost size={16} color={THEME.colors.accentWarm} weight="fill" />
          ) : (
            <Broadcast size={16} color={THEME.colors.accentFresh} weight="duotone" />
          )}
          <Text
            style={[
              styles.ghostLabel,
              isMyGhostModeActive && styles.ghostLabelActive,
            ]}
          >
            {isMyGhostModeActive ? 'Ghost' : 'Live'}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Lista Orizzontale Amici in Ascolto (Nielsen #6: Riconoscimento anziché ricordo) */}
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
    gap: 6,
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
    backgroundColor: THEME.colors.bgInteractive,
  },
  ghostLabel: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    fontWeight: '600',
  },
  ghostLabelActive: {
    color: THEME.colors.accentWarm,
  },
  listContent: {
    gap: 10,
    alignItems: 'center',
  },
  friendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 200,
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
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    fontWeight: '600',
  },
  artistName: {
    color: THEME.colors.textSecondary,
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
  },
  idleText: {
    color: THEME.colors.textSecondary,
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
  },
});