import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SealCheck, ThumbsDown, ThumbsUp, UsersThree } from '../icons';
import { useTheme, withAlpha } from '../../theme';
import { Text } from './Text';

export type ScoreKind = 'critic' | 'audience';
export type ScoreStatus = 'FRESH' | 'ROTTEN';
export type ScoreBadgeSize = 'sm' | 'md' | 'lg';

/** Product rule: a release is "fresh" when >= 70% of reviews recommend it. */
export const FRESH_THRESHOLD = 70;

export function scoreStatus(percentage: number): ScoreStatus {
  return percentage >= FRESH_THRESHOLD ? 'FRESH' : 'ROTTEN';
}

export interface ScoreBadgeProps {
  kind: ScoreKind;
  /** 0..100, or null when there are not enough reviews yet. */
  percentage: number | null;
  totalReviews?: number;
  /** Override the computed status (e.g. when the API already returns it). */
  status?: ScoreStatus;
  size?: ScoreBadgeSize;
}

const kindLabel: Record<ScoreKind, string> = { critic: 'Critica', audience: 'Pubblico' };
const dims: Record<ScoreBadgeSize, { icon: number; digits: number; padH: number; padV: number }> = {
  sm: { icon: 14, digits: 14, padH: 8, padV: 4 },
  md: { icon: 16, digits: 18, padH: 10, padV: 6 },
  lg: { icon: 20, digits: 31, padH: 14, padV: 10 },
};

/** Fresh/rotten score: state is carried by icon + text, never by colour alone. */
export function ScoreBadge({
  kind,
  percentage,
  totalReviews,
  status,
  size = 'md',
}: ScoreBadgeProps) {
  const { colors, radii, font } = useTheme();
  const d = dims[size];
  const KindIcon = kind === 'critic' ? SealCheck : UsersThree;
  const box = { paddingHorizontal: d.padH, paddingVertical: d.padV, borderRadius: radii.sleeve };

  if (percentage === null) {
    return (
      <View
        accessible
        accessibilityLabel={`Voto ${kindLabel[kind].toLowerCase()}: pochi voti`}
        style={[styles.box, box, { borderColor: colors.borderStrong, borderStyle: 'dashed' }]}
      >
        <KindIcon size={d.icon} weight="regular" color={colors.textSubtle} />
        <View>
          <Text
            style={{
              fontFamily: font.monoBold,
              fontSize: d.digits,
              lineHeight: d.digits * 1.15,
              color: colors.textSubtle,
            }}
          >
            —
          </Text>
          <Text size="xs" tone="muted">
            {kindLabel[kind]}: pochi voti
          </Text>
        </View>
      </View>
    );
  }

  const fresh = (status ?? scoreStatus(percentage)) === 'FRESH';
  const tone = fresh ? colors.fresh : colors.rotten;
  const Thumb = fresh ? ThumbsUp : ThumbsDown;
  const reviewsText = totalReviews !== undefined ? ` su ${totalReviews} recensioni` : '';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Voto ${kindLabel[kind].toLowerCase()}: ${percentage}%${reviewsText}, ${fresh ? 'consigliato' : 'bocciato'}`}
      style={[
        styles.box,
        box,
        { borderColor: withAlpha(tone, 0.35), backgroundColor: withAlpha(tone, 0.07) },
      ]}
    >
      <View style={styles.icons}>
        <KindIcon size={d.icon} weight="regular" color={tone} />
        <Thumb size={d.icon} weight="fill" color={tone} />
      </View>
      <View>
        <Text
          style={{
            fontFamily: font.monoBold,
            fontSize: d.digits,
            lineHeight: d.digits * 1.15,
            color: tone,
            fontVariant: ['tabular-nums'],
          }}
        >
          {percentage}%
        </Text>
        {size !== 'sm' ? (
          <Text size="xs" tone="secondary">
            {kindLabel[kind]}
            {totalReviews !== undefined ? (
              <Text variant="mono" size="xs" tone="secondary">
                {` · ${totalReviews}`}
              </Text>
            ) : null}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icons: { flexDirection: 'row', gap: 2 },
});
