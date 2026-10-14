import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Sparkle, Users, Newspaper } from 'phosphor-react-native';
import { THEME, type DualScoreDetails } from '@openmusic/shared';

interface DualScoreCardProps {
  scores: DualScoreDetails;
  onPressAudience?: () => void;
  onPressCritic?: () => void;
}

export const DualScoreCard: React.FC<DualScoreCardProps> = ({
  scores,
  onPressAudience,
  onPressCritic,
}) => {
  const {
    audienceAvg,
    audienceFreshPct,
    audienceCount,
    criticAvg,
    criticFreshPct,
    criticCount,
  } = scores;

  const isAudienceFresh = (audienceFreshPct ?? 0) >= 70;
  const isCriticFresh = (criticFreshPct ?? 0) >= 70;

  const handleAudiencePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressAudience?.();
  }, [onPressAudience]);

  const handleCriticPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressCritic?.();
  }, [onPressCritic]);

  return (
    <View style={styles.container}>
      {/* Colonna Voto del Pubblico (Audience Score) */}
      <Pressable
        onPress={handleAudiencePress}
        style={styles.scoreColumn}
        accessibilityRole="button"
        accessibilityLabel="Voto del Pubblico"
      >
        <View style={styles.columnHeader}>
          <Users size={14} color={THEME.colors.textSecondary} weight="bold" />
          <Text style={styles.columnTitle}>Voto del Pubblico</Text>
        </View>

        {audienceCount > 0 && audienceFreshPct !== null ? (
          <View style={styles.scoreBody}>
            <View
              style={[
                styles.freshBadge,
                {
                  backgroundColor: isAudienceFresh
                    ? `${THEME.colors.accentFresh}20`
                    : `${THEME.colors.accentRotten}20`,
                  borderColor: isAudienceFresh
                    ? THEME.colors.accentFresh
                    : THEME.colors.accentRotten,
                },
              ]}
            >
              <Sparkle
                size={14}
                color={isAudienceFresh ? THEME.colors.accentFresh : THEME.colors.accentRotten}
                weight="fill"
              />
              <Text
                style={[
                  styles.pctText,
                  {
                    color: isAudienceFresh
                      ? THEME.colors.accentFresh
                      : THEME.colors.accentRotten,
                  },
                ]}
              >
                {audienceFreshPct}%
              </Text>
            </View>

            <Text style={styles.avgText}>
              {audienceAvg?.toFixed(1) ?? '-'}{' '}
              <Text style={styles.maxText}>/ 5.0</Text>
            </Text>
            <Text style={styles.countText}>{audienceCount} voti</Text>
          </View>
        ) : (
          <View style={styles.emptyScore}>
            <Text style={styles.emptyText}>In attesa di voti</Text>
          </View>
        )}
      </Pressable>

      {/* Divisore Verticale */}
      <View style={styles.verticalDivider} />

      {/* Colonna Voto della Critica (Critic Score) */}
      <Pressable
        onPress={handleCriticPress}
        style={styles.scoreColumn}
        accessibilityRole="button"
        accessibilityLabel="Voto della Critica"
      >
        <View style={styles.columnHeader}>
          <Newspaper size={14} color={THEME.colors.accentWarm} weight="bold" />
          <Text style={[styles.columnTitle, styles.criticTitle]}>Voto della Critica</Text>
        </View>

        {criticCount > 0 && criticFreshPct !== null ? (
          <View style={styles.scoreBody}>
            <View
              style={[
                styles.freshBadge,
                {
                  backgroundColor: isCriticFresh
                    ? `${THEME.colors.accentFresh}20`
                    : `${THEME.colors.accentRotten}20`,
                  borderColor: isCriticFresh
                    ? THEME.colors.accentFresh
                    : THEME.colors.accentRotten,
                },
              ]}
            >
              <Sparkle
                size={14}
                color={isCriticFresh ? THEME.colors.accentFresh : THEME.colors.accentRotten}
                weight="fill"
              />
              <Text
                style={[
                  styles.pctText,
                  {
                    color: isCriticFresh
                      ? THEME.colors.accentFresh
                      : THEME.colors.accentRotten,
                  },
                ]}
              >
                {criticFreshPct}%
              </Text>
            </View>

            <Text style={styles.avgText}>
              {criticAvg?.toFixed(1) ?? '-'}{' '}
              <Text style={styles.maxText}>/ 5.0</Text>
            </Text>
            <Text style={styles.countText}>{criticCount} webzine</Text>
          </View>
        ) : (
          <View style={styles.emptyScore}>
            <Text style={styles.emptyText}>In attesa di recensioni</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  columnTitle: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  criticTitle: {
    color: THEME.colors.accentWarm,
  },
  scoreBody: {
    alignItems: 'center',
    gap: 3,
  },
  freshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 2,
  },
  pctText: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  avgText: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  maxText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  countText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  emptyScore: {
    paddingVertical: 10,
  },
  emptyText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: THEME.colors.borderSubtle,
    marginHorizontal: 8,
  },
});
