import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Newspaper, ArrowSquareOut, Quotes } from 'phosphor-react-native';
import { THEME, type CriticReviewItem } from '@openmusic/shared';

interface CriticReviewCardProps {
  review: CriticReviewItem;
  onOpenArticle?: (url: string) => void;
}

export const CriticReviewCard: React.FC<CriticReviewCardProps> = ({
  review,
  onOpenArticle,
}) => {
  const { outletName, criticName, criticAvatarUrl, rating, quoteSnippet, originalReviewUrl } =
    review;

  const handleOpenPress = useCallback(() => {
    if (originalReviewUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onOpenArticle?.(originalReviewUrl);
    }
  }, [originalReviewUrl, onOpenArticle]);

  return (
    <View style={styles.card}>
      {/* Testata Giornalistica & Autore */}
      <View style={styles.header}>
        <View style={styles.outletBadge}>
          <Newspaper size={12} color={THEME.colors.accentWarm} weight="fill" />
          <Text style={styles.outletName}>{outletName}</Text>
        </View>

        <View style={styles.ratingBox}>
          <Text style={styles.ratingText}>
            {(rating / 20).toFixed(1)} <Text style={styles.starSymbol}>★</Text>
          </Text>
        </View>
      </View>

      {/* Citazione della Critica in tipografia editoriale Fraunces */}
      <View style={styles.quoteContainer}>
        <Quotes size={18} color={THEME.colors.accentWarm} weight="duotone" />
        <Text style={styles.quoteText}>{quoteSnippet}</Text>
      </View>

      {/* Autore Critico e Link all'articolo */}
      <View style={styles.footer}>
        <View style={styles.authorRow}>
          {criticAvatarUrl ? (
            <Image source={{ uri: criticAvatarUrl }} style={styles.authorAvatar} />
          ) : (
            <View style={[styles.authorAvatar, styles.avatarFallback]} />
          )}
          <Text style={styles.authorName}>Recensione di {criticName}</Text>
        </View>

        {originalReviewUrl && (
          <Pressable onPress={handleOpenPress} style={styles.readMoreBtn}>
            <Text style={styles.readMoreText}>Leggi su {outletName}</Text>
            <ArrowSquareOut size={12} color={THEME.colors.textPrimary} weight="bold" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  outletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${THEME.colors.accentWarm}20`,
    borderColor: THEME.colors.accentWarm,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  outletName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.accentWarm,
  },
  ratingBox: {
    backgroundColor: THEME.colors.bgInteractive,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingText: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  starSymbol: {
    color: THEME.colors.accentWarm,
    fontSize: 11,
  },
  quoteContainer: {
    gap: 6,
    marginBottom: 14,
  },
  quoteText: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 15,
    fontStyle: 'italic',
    color: THEME.colors.textPrimary,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle,
    paddingTop: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarFallback: {
    backgroundColor: THEME.colors.bgInteractive,
  },
  authorName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readMoreText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
});
