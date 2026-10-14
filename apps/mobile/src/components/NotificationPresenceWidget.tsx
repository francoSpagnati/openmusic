import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Broadcast, CaretRight, Disc } from 'phosphor-react-native';
import {
  THEME,
  type NotificationPresenceSummary,
} from '@openmusic/shared';

interface NotificationPresenceWidgetProps {
  summary: NotificationPresenceSummary;
  onPressOpen?: () => void;
  onPressFriend?: (friendUserId: string) => void;
}

export const NotificationPresenceWidget: React.FC<NotificationPresenceWidgetProps> = ({
  summary,
  onPressOpen,
  onPressFriend,
}) => {
  const { activeFriendsCount, topListeningFriends } = summary;

  const handleOpenPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressOpen?.();
  }, [onPressOpen]);

  const handleFriendPress = useCallback(
    (userId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPressFriend?.(userId);
    },
    [onPressFriend]
  );

  if (activeFriendsCount === 0) {
    return null;
  }

  const primaryFriend = topListeningFriends[0];

  return (
    <Pressable
      onPress={handleOpenPress}
      style={[
        styles.container,
        {
          borderColor: primaryFriend?.dominantColor
            ? `${primaryFriend.dominantColor}66`
            : THEME.colors.borderSubtle,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Notifica: ${activeFriendsCount} amici stanno ascoltando musica`}
    >
      {/* Header Notifica OS (Stile Live Activity iOS / Ongoing Android) */}
      <View style={styles.headerRow}>
        <View style={styles.appBadge}>
          <Broadcast size={14} color={THEME.colors.accentFresh} weight="fill" />
          <Text style={styles.appTitle}>OpenMusic Live</Text>
        </View>
        <Text style={styles.countBadge}>
          {activeFriendsCount} {activeFriendsCount === 1 ? 'amico attivo' : 'amici attivi'}
        </Text>
      </View>

      {/* Dettagli dell'amico in evidenza */}
      {primaryFriend && (
        <View style={styles.bodyRow}>
          <View style={styles.avatarsStack}>
            {topListeningFriends.map((f, idx) => (
              <Pressable
                key={f.userId}
                onPress={() => handleFriendPress(f.userId)}
                style={[styles.stackedAvatarWrapper, { left: idx * 20 }]}
              >
                {f.avatarUrl ? (
                  <Image source={{ uri: f.avatarUrl }} style={styles.stackedAvatar} />
                ) : (
                  <View style={[styles.stackedAvatar, styles.avatarFallback]}>
                    <Disc size={16} color={THEME.colors.textMuted} weight="duotone" />
                  </View>
                )}
                <View style={styles.livePulseDot} />
              </Pressable>
            ))}
          </View>

          <View style={styles.trackDetails}>
            <Text style={styles.friendHeadline} numberOfLines={1}>
              {primaryFriend.username} sta ascoltando
            </Text>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {primaryFriend.trackTitle}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {primaryFriend.artistName}
            </Text>
          </View>

          <CaretRight size={18} color={THEME.colors.textSecondary} weight="bold" />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  countBadge: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 11,
    color: THEME.colors.accentWarm,
    fontVariant: ['tabular-nums'],
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarsStack: {
    width: 68,
    height: 38,
    position: 'relative',
    marginRight: 8,
  },
  stackedAvatarWrapper: {
    position: 'absolute',
    top: 0,
  },
  stackedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: THEME.colors.bgElevated,
  },
  avatarFallback: {
    backgroundColor: THEME.colors.bgInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulseDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.accentFresh,
    borderWidth: 1.5,
    borderColor: THEME.colors.bgElevated,
  },
  trackDetails: {
    flex: 1,
    paddingHorizontal: 8,
  },
  friendHeadline: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  trackTitle: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  artistName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.accentWarm,
  },
});
