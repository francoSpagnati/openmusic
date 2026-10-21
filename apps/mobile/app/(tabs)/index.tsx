import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { Post } from '@openmusic/shared';
import { Bell } from '../../src/components/icons';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonText,
  Text,
} from '../../src/components/ui';
import { useFriendsPresence } from '../../src/lib/socket';
import { FeedPostCard } from '../../src/features/mobile-social/FeedPostCard';
import { LiveFriendsBar } from '../../src/features/mobile-social/LiveFriendsBar';
import { PostComposerSheet } from '../../src/features/mobile-social/PostComposerSheet';
import { PressableScale } from '../../src/features/mobile-social/PressableScale';
import { haptics } from '../../src/features/mobile-social/haptics';
import { PencilSimple } from '../../src/features/mobile-social/icons';
import { useCursorList } from '../../src/features/mobile-social/useCursorList';
import { useGhostMode } from '../../src/features/mobile-social/useGhostMode';
import { usePostActions } from '../../src/features/mobile-social/usePostActions';
import { useUnreadNotifications } from '../../src/features/mobile-social/useUnreadNotifications';

type Scope = 'following' | 'global';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'following', label: 'Seguiti' },
  { value: 'global', label: 'Globale' },
];

/**
 * Home: live friends bar (socket presence + one-tap Ghost Mode), following/global feed with
 * infinite scroll, optimistic like/save/delete, and a thumb-zone button to write a post.
 */
export default function HomeScreen() {
  const { colors, space, radii } = useTheme();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('following');
  const [composerOpen, setComposerOpen] = useState(false);
  const feed = useCursorList<Post>(
    (cursor) => api.feed.list({ scope, cursor, limit: 20 }),
    [scope]
  );
  const actions = usePostActions(feed.setItems);
  const presence = useFriendsPresence();
  const ghost = useGhostMode();
  const unread = useUnreadNotifications();

  const onCreated = useCallback(
    (post: Post) => {
      setComposerOpen(false);
      feed.setItems((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
    },
    [feed]
  );

  const header = (
    <View style={{ gap: space[4], paddingBottom: space[4] }}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text variant="eyebrow">OpenMusic</Text>
          <Text variant="headline" accessibilityRole="header">
            Sui piatti oggi
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifiche, ${unread} non lette` : 'Notifiche'}
          hitSlop={8}
          onPress={() => router.push('/notifications')}
          style={styles.iconButton}
        >
          <Bell size={26} color={colors.text} weight={unread > 0 ? 'fill' : 'regular'} />
          {unread > 0 ? (
            <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.bg }]}>
              <Text variant="mono" size="xs" tone="onAccent" style={styles.dotText}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.gap2}>
        <Text variant="eyebrow">In ascolto ora</Text>
        <LiveFriendsBar
          friends={presence.friends}
          connected={presence.connected}
          isGhostMode={ghost.isGhostMode}
          ghostPending={ghost.pending}
          onToggleGhostMode={(next) => void ghost.setGhostMode(next)}
        />
        {ghost.error ? (
          <Text size="sm" tone="rotten" accessibilityLiveRegion="polite">
            {ghost.error}
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.segment, { backgroundColor: colors.surface, borderRadius: radii.pill }]}
        accessibilityRole="tablist"
      >
        {SCOPES.map((s) => {
          const selected = scope === s.value;
          return (
            <Pressable
              key={s.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) haptics.select();
                setScope(s.value);
              }}
              style={[
                styles.segmentItem,
                {
                  borderRadius: radii.pill,
                  backgroundColor: selected ? colors.elevated : 'transparent',
                },
              ]}
            >
              <Text variant="bodyStrong" size="sm" tone={selected ? 'accent' : 'secondary'}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <FlatList
        data={feed.items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: 96 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <FeedPostCard
            post={item}
            viewerId={user?.id}
            onToggleLike={actions.toggleLike}
            onToggleSave={actions.toggleSave}
            onDelete={(p) => void actions.remove(p)}
          />
        )}
        onEndReached={() => void feed.loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={feed.reload}
            tintColor={colors.accent}
          />
        }
        ListFooterComponent={
          feed.loadingMore ? (
            <ActivityIndicator color={colors.accent} accessibilityLabel="Carico altri post" />
          ) : feed.loadMoreError ? (
            <Button
              label="Riprova a caricare"
              variant="ghost"
              onPress={() => void feed.loadMore()}
            />
          ) : undefined
        }
        ListEmptyComponent={
          feed.loading ? (
            <View style={{ gap: space[4] }} accessibilityLabel="Caricamento del feed">
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ gap: space[2] }}>
                  <Skeleton shape="circle" height={32} />
                  <SkeletonText lines={3} />
                </View>
              ))}
            </View>
          ) : feed.error ? (
            <ErrorState
              title="Non riusciamo a caricare il feed"
              error={feed.error}
              onRetry={feed.reload}
              retrying={feed.refreshing}
            />
          ) : (
            <EmptyState
              title="Ancora silenzio"
              description={
                scope === 'following'
                  ? 'Segui qualcuno o passa al feed globale.'
                  : 'Nessun post per ora. Scrivi il primo.'
              }
              action={
                scope === 'following' ? (
                  <Button
                    label="Vedi il feed globale"
                    variant="secondary"
                    onPress={() => setScope('global')}
                  />
                ) : undefined
              }
            />
          )
        }
      />

      {/* Thumb zone: bottom-right floating action above the tab bar. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Scrivi un post"
        onPress={() => {
          haptics.tap();
          setComposerOpen(true);
        }}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent,
            borderRadius: radii.pill,
            right: space[4],
            bottom: space[4],
          },
        ]}
      >
        <PencilSimple size={22} color={colors.onAccent} weight="bold" />
        <Text variant="bodyStrong" tone="onAccent">
          Scrivi
        </Text>
      </PressableScale>

      <PostComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={onCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap2: { gap: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dotText: { fontSize: 10, lineHeight: 12 },
  segment: { flexDirection: 'row', padding: 4, alignSelf: 'flex-start' },
  segmentItem: { paddingHorizontal: 16, minHeight: 36, justifyContent: 'center' },
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    minHeight: 56,
    elevation: 6,
    shadowColor: '#0A0805',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
