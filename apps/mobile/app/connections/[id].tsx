import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import type { UserSummary } from '@openmusic/shared';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/theme';
import { Avatar, Button, EmptyState, ErrorState, Skeleton, Text } from '../../src/components/ui';
import { useCursorList } from '../../src/features/mobile-social/useCursorList';
import { useFollow } from '../../src/features/mobile-social/useFollow';

type Kind = 'followers' | 'following';

function FollowRow({
  user,
  isMe,
  onChange,
}: {
  user: UserSummary;
  isMe: boolean;
  onChange: (u: UserSummary) => void;
}) {
  const { colors, radii } = useTheme();
  const follow = useFollow((s) => onChange({ ...user, isFollowedByMe: s.isFollowedByMe }));
  const name = user.displayName ?? user.username;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Profilo di ${name}`}
        onPress={() => router.push(`/profile/${user.id}`)}
        style={({ pressed }) => [
          styles.person,
          { borderRadius: radii.md, backgroundColor: pressed ? colors.surface : 'transparent' },
        ]}
      >
        <Avatar name={name} src={user.avatarUrl} decorative />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="mono" size="xs" tone="muted">
            @{user.username}
          </Text>
        </View>
      </Pressable>
      {!isMe ? (
        <Button
          size="sm"
          label={user.isFollowedByMe ? 'Segui già' : 'Segui'}
          variant={user.isFollowedByMe ? 'secondary' : 'primary'}
          accessibilityLabel={`${user.isFollowedByMe ? 'Smetti di seguire' : 'Segui'} ${name}`}
          onPress={() => void follow.toggle(user.id, user.isFollowedByMe)}
        />
      ) : null}
    </View>
  );
}

/** Followers / following of a user, paged, with inline follow buttons. */
export default function ConnectionsScreen() {
  const params = useLocalSearchParams<{ id: string; kind?: string; name?: string }>();
  const userId = typeof params.id === 'string' ? params.id : '';
  const kind: Kind = params.kind === 'following' ? 'following' : 'followers';
  const { user: me } = useAuth();
  const { colors, space } = useTheme();
  const list = useCursorList<UserSummary>(
    (cursor) =>
      kind === 'followers'
        ? api.users.followers(userId, { cursor, limit: 30 })
        : api.users.following(userId, { cursor, limit: 30 }),
    [userId, kind],
    { enabled: userId.length > 0 }
  );
  const title = kind === 'followers' ? 'Follower' : 'Seguiti';

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: params.name ? `${title} · ${params.name}` : title }} />
      <FlatList
        data={list.items}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: space[4], gap: space[1] }}
        renderItem={({ item }) => (
          <FollowRow
            user={item}
            isMe={item.id === me?.id}
            onChange={(u) => list.setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
          />
        )}
        onEndReached={() => void list.loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={list.reload}
            tintColor={colors.accent}
          />
        }
        ListFooterComponent={
          list.loadingMore ? <ActivityIndicator color={colors.accent} /> : undefined
        }
        ListEmptyComponent={
          list.loading ? (
            <View style={{ gap: space[2] }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={56} />
              ))}
            </View>
          ) : list.error ? (
            <ErrorState title="Elenco non disponibile" error={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState
              size="compact"
              title={kind === 'followers' ? 'Ancora nessun follower' : 'Non segue ancora nessuno'}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    minHeight: 56,
  },
});
