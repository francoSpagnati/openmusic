import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { ReactionType, ReviewItem } from '@openmusic/shared';
import { useTheme, withAlpha } from '../../../theme';
import { Avatar, Badge, Card, RatingStars, Text, starsFromRating } from '../../../components/ui';
import { Heart, SealCheck, ThumbsUp } from '../../../components/icons';
import { formatRelative } from '../../../lib/format';
import { Lightbulb, PenNib } from '../icons';
import { REACTION_LABELS, REACTION_TYPES, myReactions } from '../reactions';
import { haptics } from '../haptics';

export interface ReviewCardProps {
  review: ReviewItem;
  /** The viewer wrote it: reactions are shown but not tappable. */
  isMine: boolean;
  onReact: (review: ReviewItem, type: ReactionType) => void;
  pending?: ReadonlySet<ReactionType>;
}

function ReactionIcon({
  type,
  color,
  active,
}: {
  type: ReactionType;
  color: string;
  active: boolean;
}) {
  const weight = active ? 'fill' : 'regular';
  switch (type) {
    case 'AGREE':
      return <ThumbsUp size={18} color={color} weight={weight} />;
    case 'WELL_WRITTEN':
      return <PenNib size={18} color={color} weight={weight} />;
    case 'DISCOVERED':
      return <Lightbulb size={18} color={color} weight={weight} />;
    case 'HEART':
      return <Heart size={18} color={color} weight={weight} />;
  }
}

/** An audience review with its four constructive reactions (ADR-002: no comment threads). */
export function ReviewCard({ review, isMine, onReact, pending }: ReviewCardProps) {
  const { colors, space, radii } = useTheme();
  const name = review.user.displayName ?? review.user.username;
  const mine = new Set(myReactions(review));
  return (
    <Card variant="sleeve" padding="sm" style={{ gap: space[2] }}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Profilo di ${name}`}
          onPress={() => router.push(`/profile/${review.user.id}`)}
          style={styles.author}
        >
          <Avatar name={name} src={review.user.avatarUrl} size="sm" decorative />
          <View style={styles.flex}>
            <Text variant="bodyStrong" size="sm" numberOfLines={1}>
              {name}
              {isMine ? ' · tu' : ''}
            </Text>
            <Text variant="caption" size="xs" tone="muted">
              {formatRelative(review.updatedAt)}
            </Text>
          </View>
        </Pressable>
        <RatingStars value={starsFromRating(review.rating)} size="sm" label={`Voto di ${name}`} />
      </View>
      {review.content ? <Text size="sm">{review.content}</Text> : null}
      {review.vibeTags.length > 0 || review.isVerifiedListen ? (
        <View style={styles.tags}>
          {review.isVerifiedListen ? (
            <Badge
              label="Ascolto verificato"
              tone="fresh"
              size="sm"
              icon={<SealCheck size={12} color={colors.fresh} weight="fill" />}
            />
          ) : null}
          {review.vibeTags.map((tag) => (
            <Badge key={tag} label={`#${tag}`} size="sm" mono />
          ))}
        </View>
      ) : null}
      <View
        style={styles.reactions}
        accessibilityRole="toolbar"
        accessibilityLabel={`Reazioni alla recensione di ${name}`}
      >
        {REACTION_TYPES.map((type) => {
          const active = mine.has(type);
          const count = review.reactions[type] ?? 0;
          const busy = pending?.has(type) ?? false;
          return (
            <Pressable
              key={type}
              accessibilityRole="togglebutton"
              accessibilityLabel={`${REACTION_LABELS[type]}, ${count}`}
              accessibilityState={{ checked: active, disabled: isMine || busy }}
              accessibilityHint={isMine ? 'Non puoi reagire alla tua recensione' : undefined}
              disabled={isMine || busy}
              hitSlop={4}
              onPress={() => {
                haptics.tap();
                onReact(review, type);
              }}
              style={[
                styles.reaction,
                {
                  borderRadius: radii.pill,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? withAlpha(colors.accent, 0.14) : 'transparent',
                  opacity: isMine ? 0.6 : 1,
                },
              ]}
            >
              <ReactionIcon
                type={type}
                color={active ? colors.accent : colors.textSecondary}
                active={active}
              />
              <Text variant="mono" size="xs" tone={active ? 'accent' : 'secondary'}>
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  flex: { flex: 1, minWidth: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    minWidth: 56,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
});
