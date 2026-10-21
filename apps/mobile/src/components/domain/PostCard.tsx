import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Heart } from '../icons';
import type { Post } from '@openmusic/shared';
import { useTheme } from '../../theme';
import { Avatar, Card, CoverArt, RatingStars, Text, starsFromRating } from '../ui';
import { formatRelative } from '../../lib/format';

export interface PostCardProps {
  post: Post;
  onToggleLike?: (post: Post) => void;
}

/** Feed post: author, text, attached release (tap to open) and like toggle. */
export function PostCard({ post, onToggleLike }: PostCardProps) {
  const { colors } = useTheme();
  const author = post.author.displayName ?? post.author.username;
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
          <Text variant="mono" size="xs" tone="muted">
            @{post.author.username} · {formatRelative(post.createdAt)}
          </Text>
        </View>
      </Pressable>
      <Text style={styles.content}>{post.content}</Text>
      {post.release ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${post.release.title} di ${post.release.artistName}`}
          onPress={() => post.release && router.push(`/release/${post.release.id}`)}
          style={[styles.release, { backgroundColor: colors.sunken }]}
        >
          <CoverArt uri={post.release.coverUrl} size={56} />
          <View style={styles.flex}>
            <Text variant="title" size="base" numberOfLines={1}>
              {post.release.title}
            </Text>
            <Text size="sm" tone="secondary" numberOfLines={1}>
              {post.release.artistName}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {post.rating !== null ? (
        <RatingStars value={starsFromRating(post.rating)} size="sm" label="Voto del post" />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: post.isLikedByMe }}
        accessibilityLabel={post.isLikedByMe ? 'Togli mi piace' : 'Mi piace'}
        onPress={() => onToggleLike?.(post)}
        hitSlop={8}
        style={styles.like}
      >
        <Heart
          size={20}
          weight={post.isLikedByMe ? 'fill' : 'regular'}
          color={post.isLikedByMe ? colors.accent : colors.textSecondary}
        />
        <Text variant="mono" size="sm" tone="secondary">
          {post.likeCount}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  content: { marginTop: 12 },
  release: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
});
