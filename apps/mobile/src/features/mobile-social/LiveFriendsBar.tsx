import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { FriendPresence } from '@openmusic/shared';
import { useTheme, withAlpha } from '../../theme';
import { Avatar, Text } from '../../components/ui';
import { Broadcast, Ghost } from './icons';
import { haptics } from './haptics';
import { PressableScale } from './PressableScale';

export interface LiveFriendsBarProps {
  friends: FriendPresence[];
  connected: boolean;
  isGhostMode: boolean;
  ghostPending?: boolean;
  onToggleGhostMode: (next: boolean) => void;
  /** Defaults to opening the friend's profile. */
  onPressFriend?: (friend: FriendPresence) => void;
}

function friendLabel(f: FriendPresence): string {
  const name = f.displayName ?? f.username;
  if (f.isGhostMode) return `${name}, in Ghost Mode`;
  const t = f.currentlyPlaying;
  if (!t) return `${name}, online`;
  return `${name} ${t.isPlaying ? 'sta ascoltando' : 'ha in pausa'} ${t.title} di ${t.artistName}`;
}

/**
 * Home "in ascolto ora" strip: one-tap Ghost Mode (44pt target) followed by the followed users who
 * are online, playing first. Data comes from the
 * authenticated socket (`useFriendsPresence`).
 */
export function LiveFriendsBar({
  friends,
  connected,
  isGhostMode,
  ghostPending = false,
  onToggleGhostMode,
  onPressFriend,
}: LiveFriendsBarProps) {
  const { colors, radii, space } = useTheme();
  const sorted = [...friends].sort(
    (a, b) =>
      Number(Boolean(b.currentlyPlaying?.isPlaying)) -
      Number(Boolean(a.currentlyPlaying?.isPlaying))
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], alignItems: 'center', paddingVertical: space[1] }}
      accessibilityLabel="Amici in ascolto ora"
    >
      <PressableScale
        accessibilityRole="switch"
        accessibilityLabel="Ghost Mode"
        accessibilityHint="Nasconde ai follower cosa stai ascoltando"
        accessibilityState={{ checked: isGhostMode, busy: ghostPending }}
        disabled={ghostPending}
        onPress={() => onToggleGhostMode(!isGhostMode)}
        style={[
          styles.ghost,
          {
            borderRadius: radii.pill,
            borderColor: isGhostMode ? colors.borderStrong : colors.border,
            backgroundColor: isGhostMode ? withAlpha(colors.text, 0.06) : colors.surfaceRaised,
          },
        ]}
      >
        {isGhostMode ? (
          <Ghost size={18} color={colors.text} weight="fill" />
        ) : (
          <Broadcast size={18} color={colors.fresh} weight="regular" />
        )}
        <Text variant="eyebrow" size="sm" tone="primary">
          {isGhostMode ? 'Ghost' : 'Live'}
        </Text>
      </PressableScale>

      {sorted.length === 0 ? (
        <Text size="sm" tone="muted" style={styles.empty}>
          {connected ? 'Nessun amico in ascolto ora' : 'Presenza non connessa'}
        </Text>
      ) : (
        sorted.map((f) => {
          const t = f.isGhostMode ? null : f.currentlyPlaying;
          return (
            <PressableScale
              key={f.userId}
              accessibilityRole="button"
              accessibilityLabel={friendLabel(f)}
              accessibilityHint="Apre il profilo"
              onPress={() => {
                haptics.tap();
                if (onPressFriend) onPressFriend(f);
                else router.push(`/profile/${f.userId}`);
              }}
              style={[
                styles.friend,
                {
                  borderRadius: radii.pill,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceRaised,
                },
              ]}
            >
              <Avatar
                name={f.displayName ?? f.username}
                src={f.avatarUrl}
                size="sm"
                status={f.isGhostMode ? 'ghost' : t?.isPlaying ? 'live' : 'online'}
                decorative
              />
              <View style={styles.meta}>
                {t ? (
                  <>
                    <Text variant="bodyStrong" size="xs" numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text size="xs" tone="secondary" numberOfLines={1}>
                      {t.artistName}
                    </Text>
                  </>
                ) : (
                  <Text size="xs" tone="secondary" numberOfLines={1}>
                    {f.displayName ?? f.username}
                  </Text>
                )}
              </View>
            </PressableScale>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingLeft: 6,
    paddingRight: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 210,
  },
  meta: { flexShrink: 1 },
  empty: { paddingHorizontal: 4 },
});
