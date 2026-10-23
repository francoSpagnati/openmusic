import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { CriticReviewItem } from '@openmusic/shared';
import { useTheme } from '../../../theme';
import { Avatar, Card, ScoreBadge, Text } from '../../../components/ui';
import { ArrowSquareOut, Quotes } from '../icons';

/** A quote from an accredited critic, with the outlet and a link to the full review. */
export function CriticReviewCard({ review }: { review: CriticReviewItem }) {
  const { colors, space } = useTheme();
  const url = review.originalReviewUrl;
  return (
    <Card variant="sleeve" padding="md" style={{ gap: space[3] }}>
      <View style={styles.head}>
        <Avatar
          name={review.criticName}
          src={review.criticAvatarUrl ?? null}
          size="sm"
          decorative
        />
        <View style={styles.flex}>
          <Text variant="bodyStrong" size="sm" numberOfLines={1}>
            {review.criticName}
          </Text>
          <Text variant="eyebrow" numberOfLines={1}>
            {review.outletName}
          </Text>
        </View>
        <ScoreBadge kind="critic" size="sm" percentage={review.rating} />
      </View>
      <View style={styles.quote}>
        <Quotes size={18} color={colors.textSubtle} weight="fill" />
        <Text variant="deck" size="xl" style={styles.flex}>
          {review.quoteSnippet}
        </Text>
      </View>
      {url ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Leggi la recensione completa su ${review.outletName}`}
          onPress={() => void Linking.openURL(url).catch(() => undefined)}
          style={styles.link}
        >
          <Text variant="bodyStrong" size="sm" tone="accent">
            Leggi su {review.outletName}
          </Text>
          <ArrowSquareOut size={16} color={colors.accent} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  quote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
});
