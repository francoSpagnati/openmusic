import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { HeavyRotationItem, Post, ReviewItem, UserProfileData } from '@openmusic/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { ApiQueryState } from '../../lib/useApiQuery';
import { formatRelative } from '../../lib/format';
import { useTheme } from '../../theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CoverArt,
  EmptyState,
  ErrorState,
  RatingStars,
  Skeleton,
  SkeletonText,
  Text,
  starsFromRating,
} from '../../components/ui';
import { SealCheck } from '../../components/icons';
import { FeedPostCard } from './FeedPostCard';
import { ChatText, GearSix, UserCheck, UserPlus } from './icons';
import { haptics } from './haptics';
import { useCursorList } from './useCursorList';
import { useFollow } from './useFollow';
import { usePostActions } from './usePostActions';

type Tab = 'posts' | 'reviews' | 'rotation';
const TABS: { value: Tab; label: string }[] = [
  { value: 'posts', label: 'Post' },
  { value: 'reviews', label: 'Recensioni' },
  { value: 'rotation', label: 'In rotazione' },
];

type Row =
  | { kind: 'post'; post: Post }
  | { kind: 'review'; review: ReviewItem }
  | { kind: 'rotation'; item: HeavyRotationItem };

function rowKey(r: Row): string {
  if (r.kind === 'post') return `p:${r.post.id}`;
  if (r.kind === 'review') return `r:${r.review.id}`;
  return `h:${r.item.track.id}`;
}

export interface SocialProfileProps {
  userId: string;
  profile: ApiQueryState<UserProfileData>;
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const content = (
    <>
      <Text variant="mono" size="lg">
        {value}
      </Text>
      <Text variant="eyebrow">{label}</Text>
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      hitSlop={6}
      style={styles.stat}
    >
      {content}
    </Pressable>
  );
}

/**
 * Profile page body shared by "Profilo" (own) and `/profile/[id]`: header with tappable
 * follower/following counts, follow + message (others) or settings (own), then Post / Recensioni
 * / In rotazione. Posts are paged from `/api/users/:id/posts`.
 */
export function SocialProfile({ userId, profile }: SocialProfileProps) {
  const { colors, space, radii } = useTheme();
  const { user: me } = useAuth();
  const [tab, setTab] = useState<Tab>('posts');
  const posts = useCursorList<Post>(
    (cursor) => api.users.posts(userId, { cursor, limit: 20 }),
    [userId],
    { enabled: userId.length > 0 }
  );
  const postActions = usePostActions(posts.setItems);

  const applyFollow = useCallback(
    (s: { isFollowedByMe: boolean; followersDelta?: number; followersCount?: number }) =>
      profile.setData((p) =>
        p
          ? {
              ...p,
              social: {
                ...p.social,
                isFollowedByMe: s.isFollowedByMe,
                followersCount:
                  s.followersCount ??
                  Math.max(0, p.social.followersCount + (s.followersDelta ?? 0)),
              },
            }
          : p
      ),
    [profile]
  );
  const follow = useFollow(applyFollow);

  const refresh = useCallback(() => {
    void posts.reload();
    return profile.reload();
  }, [posts, profile]);

  if (profile.loading) {
    return (
      <View
        style={{ padding: space[4], gap: space[3] }}
        accessibilityLabel="Caricamento del profilo"
      >
        <View style={styles.row}>
          <Skeleton shape="circle" width={80} height={80} />
          <View style={styles.flex}>
            <SkeletonText lines={2} />
          </View>
        </View>
        <SkeletonText lines={3} />
      </View>
    );
  }
  if (profile.error || !profile.data) {
    return (
      <View style={{ padding: space[4] }}>
        <ErrorState
          title="Profilo non disponibile"
          error={profile.error}
          onRetry={profile.reload}
          retrying={profile.refreshing}
        />
      </View>
    );
  }

  const { user, social, stats, recentReviews, heavyRotation } = profile.data;
  const name = user.displayName ?? user.username;
  const isMe = social.isMe || user.id === me?.id;

  const rows: Row[] =
    tab === 'posts'
      ? posts.items.map((post) => ({ kind: 'post', post }))
      : tab === 'reviews'
        ? recentReviews.map((review) => ({ kind: 'review', review }))
        : heavyRotation.map((item) => ({ kind: 'rotation', item }));

  const header = (
    <View style={{ gap: space[4], paddingBottom: space[4] }}>
      <View style={styles.row}>
        <Avatar name={name} src={user.avatarUrl} size="xl" decorative />
        <View style={styles.flex}>
          <Text variant="headline" numberOfLines={2} accessibilityRole="header">
            {name}
          </Text>
          <Text variant="mono" size="sm" tone="secondary">
            @{user.username}
          </Text>
          {user.role === 'CRITIC' ? (
            <Badge
              label={user.criticOutlet ?? 'Critico'}
              tone="accent"
              size="sm"
              icon={<SealCheck size={12} color={colors.accent} weight="fill" />}
            />
          ) : null}
        </View>
      </View>
      {user.bio ? <Text tone="secondary">{user.bio}</Text> : null}
      <View style={styles.stats}>
        <Stat
          label="Follower"
          value={social.followersCount}
          onPress={() =>
            router.push({
              pathname: '/connections/[id]',
              params: { id: user.id, kind: 'followers', name },
            })
          }
        />
        <Stat
          label="Seguiti"
          value={social.followingCount}
          onPress={() =>
            router.push({
              pathname: '/connections/[id]',
              params: { id: user.id, kind: 'following', name },
            })
          }
        />
        <Stat label="Recensioni" value={stats.totalReviews} />
        <Stat label="Ascolti" value={stats.totalScrobbles} />
      </View>

      {isMe ? (
        <View style={styles.actions}>
          <Button
            label="Impostazioni"
            variant="secondary"
            leadingIcon={<GearSix size={18} color={colors.text} />}
            onPress={() => router.push('/settings')}
            style={styles.flex}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={social.isFollowedByMe ? 'Segui già' : 'Segui'}
            variant={social.isFollowedByMe ? 'secondary' : 'primary'}
            accessibilityState={{ selected: social.isFollowedByMe, busy: follow.busy }}
            leadingIcon={
              social.isFollowedByMe ? (
                <UserCheck size={18} color={colors.text} />
              ) : (
                <UserPlus size={18} color={colors.onAccent} />
              )
            }
            onPress={() => void follow.toggle(user.id, social.isFollowedByMe)}
            style={styles.flex}
          />
          <Button
            label="Messaggio"
            variant="outline"
            leadingIcon={<ChatText size={18} color={colors.text} />}
            onPress={() => router.push(`/chat/${user.id}`)}
            style={styles.flex}
          />
        </View>
      )}

      <View
        style={[styles.segment, { backgroundColor: colors.surface, borderRadius: radii.pill }]}
        accessibilityRole="tablist"
      >
        {TABS.map((t) => {
          const selected = tab === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) haptics.select();
                setTab(t.value);
              }}
              style={[
                styles.segmentItem,
                {
                  borderRadius: radii.pill,
                  backgroundColor: selected ? colors.elevated : 'transparent',
                },
              ]}
            >
              <Text
                variant="bodyStrong"
                size="sm"
                tone={selected ? 'accent' : 'secondary'}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'post') {
      return (
        <FeedPostCard
          post={item.post}
          viewerId={me?.id}
          onToggleLike={postActions.toggleLike}
          onToggleSave={postActions.toggleSave}
          onDelete={(p) => void postActions.remove(p)}
        />
      );
    }
    if (item.kind === 'review') {
      const r = item.review;
      return (
        <Pressable
          accessibilityRole={r.releaseId ? 'link' : undefined}
          accessibilityLabel={`Recensione, ${starsFromRating(r.rating)} stelle`}
          disabled={!r.releaseId}
          onPress={() => r.releaseId && router.push(`/release/${r.releaseId}`)}
        >
          <Card variant="outline" padding="sm">
            <View style={styles.reviewHead}>
              <RatingStars value={starsFromRating(r.rating)} size="sm" showValue />
              {r.isVerifiedListen ? (
                <Badge label="Ascolto verificato" tone="fresh" size="sm" />
              ) : null}
            </View>
            {r.content ? (
              <Text size="sm" numberOfLines={4} style={styles.mt}>
                {r.content}
              </Text>
            ) : null}
            <Text variant="mono" size="xs" tone="muted" style={styles.mt}>
              {formatRelative(r.createdAt)}
            </Text>
          </Card>
        </Pressable>
      );
    }
    const { track, playCount } = item.item;
    return (
      <Pressable
        accessibilityRole={track.releaseId ? 'link' : undefined}
        accessibilityLabel={`${track.title} di ${track.artistName}, ${playCount} ascolti`}
        disabled={!track.releaseId}
        onPress={() => track.releaseId && router.push(`/release/${track.releaseId}`)}
        style={styles.rotation}
      >
        <CoverArt uri={track.coverUrl ?? null} size={48} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {track.title}
          </Text>
          <Text size="sm" tone="secondary" numberOfLines={1}>
            {track.artistName}
          </Text>
        </View>
        <Text variant="mono" size="sm" tone="muted">
          {playCount}×
        </Text>
      </Pressable>
    );
  };

  const empty =
    tab === 'posts' ? (
      posts.loading ? (
        <SkeletonText lines={4} />
      ) : posts.error ? (
        <ErrorState title="Post non disponibili" error={posts.error} onRetry={posts.reload} />
      ) : (
        <EmptyState
          size="compact"
          title="Nessun post"
          description={
            isMe ? 'Scrivi il primo dalla Home.' : `${name} non ha ancora scritto nulla.`
          }
        />
      )
    ) : tab === 'reviews' ? (
      <EmptyState size="compact" title="Nessuna recensione" />
    ) : (
      <EmptyState
        size="compact"
        title="Niente in rotazione"
        description="Gli ascolti arrivano da Spotify o Last.fm collegati."
      />
    );

  return (
    <FlatList
      data={rows}
      keyExtractor={rowKey}
      renderItem={renderRow}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[8] }}
      onEndReached={() => {
        if (tab === 'posts') void posts.loadMore();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        tab === 'posts' && posts.loadingMore ? (
          <ActivityIndicator color={colors.accent} />
        ) : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={profile.refreshing}
          onRefresh={refresh}
          tintColor={colors.accent}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 4 },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 2, minHeight: 44, minWidth: 56, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  segment: { flexDirection: 'row', padding: 4 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mt: { marginTop: 6 },
  rotation: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
});
