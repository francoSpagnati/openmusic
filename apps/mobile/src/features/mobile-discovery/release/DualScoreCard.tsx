import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { DualScoreDetails } from '@openmusic/shared';
import { useTheme } from '../../../theme';
import { Card, RatingStars, ScoreBadge, Text, clampStars } from '../../../components/ui';

export interface DualScoreCardProps {
  score: DualScoreDetails;
}

function Column({
  kind,
  pct,
  avg,
  count,
}: {
  kind: 'audience' | 'critic';
  pct: number | null;
  avg: number | null;
  count: number;
}) {
  const { space } = useTheme();
  const title = kind === 'audience' ? 'Pubblico' : 'Critica';
  const hasScore = count > 0 && pct !== null;
  return (
    <View
      style={[styles.column, { gap: space[2] }]}
      accessible
      accessibilityLabel={
        hasScore
          ? `${title}: ${Math.round(pct)}% positive su ${count} recensioni${avg !== null ? `, media ${avg.toFixed(1)} stelle` : ''}`
          : `${title}: ancora nessuna recensione`
      }
    >
      <Text variant="eyebrow">{title}</Text>
      <ScoreBadge kind={kind} size="lg" percentage={hasScore ? Math.round(pct) : null} />
      {avg !== null && count > 0 ? (
        <View style={styles.avg}>
          <RatingStars value={clampStars(avg)} size="sm" />
          <Text variant="mono" size="xs" tone="secondary">
            {avg.toFixed(1).replace('.', ',')}
          </Text>
        </View>
      ) : null}
      <Text variant="mono" size="xs" tone="muted">
        {count === 0 ? 'nessuna recensione' : count === 1 ? '1 recensione' : `${count} recensioni`}
      </Text>
    </View>
  );
}

/**
 * ADR-001 dual score: audience (verified listens weigh 1.5x) next to accredited critics. "Fresh" =
 * share of ratings >= 3.5 stars.
 */
export function DualScoreCard({ score }: DualScoreCardProps) {
  const { space, colors } = useTheme();
  return (
    <Card variant="surface" padding="md" style={{ gap: space[3] }}>
      <View style={styles.row}>
        <Column
          kind="audience"
          pct={score.audienceFreshPct}
          avg={score.audienceAvg}
          count={score.audienceCount}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Column
          kind="critic"
          pct={score.criticFreshPct}
          avg={score.criticAvg}
          count={score.criticCount}
        />
      </View>
      <Text variant="caption" size="xs" tone="muted">
        % di voti da 3,5 stelle in su. Le recensioni con ascolto verificato pesano 1,5×.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flex: 1, alignItems: 'flex-start' },
  avg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { width: StyleSheet.hairlineWidth, marginHorizontal: 12 },
});
