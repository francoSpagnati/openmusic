import React, { useEffect, useRef } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { THEME, type Post } from '@openmusic/shared';
import { Heart } from '../../components/icons';
import { useTheme } from '../../theme';
import {
  Avatar,
  Badge,
  Card,
  CoverArt,
  RatingStars,
  Text,
  starsFromRating,
} from '../../components/ui';
import { formatRelative } from '../../lib/format';
import { BookmarkSimple, MusicNote, Trash } from './icons';
import { PressableScale } from './PressableScale';

export interface FeedPostCardProps {
  post: Post;
  /** The viewer's user id: shows the delete action on their own posts. */
  viewerId?: string | null;
  onToggleLike: (post: Post) => void;
  onToggleSave: (post: Post) => void;
  onDelete?: (post: Post) => void;
}

function LikeButton({ post, onPress }: { post: Post; onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const first = useRef(true);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // A small, critically damped pulse: confirms the tap without bouncing.
    if (post.isLikedByMe && !reduced)
      scale.value = withSequence(
        withSpring(1.12, THEME.spring.snappy),
        withSpring(1, THEME.spring.gentle)
      );
  }, [post.isLikedByMe, scale, reduced]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: post.isLikedByMe }}
      accessibilityLabel={`${post.isLikedByMe ? 'Togli mi piace' : 'Mi piace'}, ${post.likeCount} mi piace`}
      onPress={onPress}
      hitSlop={6}
      style={styles.action}
    >
      <Animated.View style={style}>
        <Heart
          size={22}
          weight={post.isLikedByMe ? 'fill' : 'regular'}
          color={post.isLikedByMe ? colors.accent : colors.textMuted}
        />
      </Animated.View>
      <Text variant="mono" size="sm" tone={post.isLikedByMe ? 'accent' : 'secondary'}>
        {post.likeCount}
      </Text>
    </Pressable>
  );
}

/**
 * Feed post: author (tap: profile), text, attached release or track (tap: release page), rating,
 * vibe tags, animated like, private save and delete for the author. ADR-002: no comment thread;
 * discussion happens in chat.
 */
export function FeedPostCard({
  post,
  viewerId,
  onToggleLike,
  onToggleSave,
  onDelete,
}: FeedPostCardProps) {
  const { colors, radii } = useTheme();
  const author = post.author.displayName ?? post.author.username;
  const isMine = viewerId != null && post.author.id === viewerId;
  const release = post.release;
  const track = post.track;
  const attachmentTarget = release ? release.id : (track?.releaseId ?? null);

  const confirmDelete = () =>
    Alert.alert('Eliminare il post?', 'Non potrai recuperarlo.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => onDelete?.(post) },
    ]);

  return (
    <Card variant="sleeve">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Profilo di ${author}`}
        onPress={() => router.push(`/profile/${post.author.id}`)}
        style={styles.header}
      >
        <Avatar name={author} src={post.author.avatarUrl} size="sm" decorative />
        <View style={styles.flex}>
          <Text variant="bodyStrong" size="sm" numberOfLines={1}>
            {author}
          </Text>
          <Text size="xs" tone="muted" numberOfLines={1}>
            @{post.author.username} · {formatRelative(post.createdAt)}
          </Text>
        </View>
        {post.author.role === 'CRITIC' ? <Badge label="Critico" size="sm" /> : null}
      </Pressable>

      <Text style={styles.content}>{post.content}</Text>

      {release || track ? (
        <PressableScale
          pressedScale={0.98}
          accessibilityRole={attachmentTarget ? 'link' : undefined}
          accessibilityLabel={
            release
              ? `Disco: ${release.title} di ${release.artistName}`
              : track
                ? `Brano: ${track.title} di ${track.artistName}`
                : undefined
          }
          disabled={!attachmentTarget}
          onPress={() => attachmentTarget && router.push(`/release/${attachmentTarget}`)}
          style={[
            styles.attachment,
            {
              backgroundColor: colors.sunken,
              borderColor: colors.border,
              borderRadius: radii.sleeve,
            },
          ]}
        >
          <CoverArt uri={release?.coverUrl ?? track?.coverUrl ?? null} size={56} />
          <View style={styles.flex}>
            {track && !release ? (
              <View style={styles.kind}>
                <MusicNote size={12} color={colors.textSubtle} weight="regular" />
                <Text variant="eyebrow">Brano</Text>
              </View>
            ) : null}
            <Text variant="title" size="base" numberOfLines={1}>
              {release?.title ?? track?.title}
            </Text>
            <Text size="sm" tone="secondary" numberOfLines={1}>
              {release?.artistName ?? track?.artistName}
            </Text>
          </View>
        </PressableScale>
      ) : null}

      {post.rating !== null ? (
        <View style={styles.rating}>
          <RatingStars
            value={starsFromRating(post.rating)}
            size="sm"
            showValue
            label="Voto del post"
          />
        </View>
      ) : null}

      {post.vibeTags.length > 0 ? (
        <View style={styles.tags}>
          {post.vibeTags.map((tag) => (
            <Badge key={tag} label={`#${tag}`} size="sm" />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <LikeButton post={post} onPress={() => onToggleLike(post)} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.isSavedByMe }}
          accessibilityLabel={post.isSavedByMe ? 'Rimuovi dai salvati' : 'Salva'}
          onPress={() => onToggleSave(post)}
          hitSlop={6}
          style={styles.action}
        >
          <BookmarkSimple
            size={22}
            weight={post.isSavedByMe ? 'fill' : 'regular'}
            color={post.isSavedByMe ? colors.text : colors.textMuted}
          />
        </Pressable>
        <View style={styles.flex} />
        {isMine && onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Elimina post"
            onPress={confirmDelete}
            hitSlop={6}
            style={styles.action}
          >
            <Trash size={20} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  content: { marginTop: 14 },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { marginTop: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 4,
  },
});
