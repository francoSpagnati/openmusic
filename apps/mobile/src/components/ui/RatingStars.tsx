import React from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Star, StarHalf } from '../icons';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type RatingSize = 'sm' | 'md' | 'lg';

/** ADR-001: ratings are stored as integers 10..100 (3.5 stars = 70). */
export function starsFromRating(rating: number): number {
  return Math.round(rating / 10) / 2;
}

export function ratingFromStars(stars: number): number {
  return Math.round(stars * 20);
}

const MIN = 0.5;
const MAX = 5;
const STEP = 0.5;

/** Clamps to 0.5..5 and snaps to the 0.5 grid. */
export function clampStars(value: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(value / STEP) * STEP));
}

const sizes: Record<RatingSize, number> = { sm: 16, md: 28, lg: 40 };

export interface RatingStarsProps {
  /** Stars, 0.5..5 in 0.5 steps. `null`/0 = not rated yet. */
  value: number | null;
  /** Omit for a read-only display. */
  onChange?: (stars: number) => void;
  size?: RatingSize;
  /** Accessible name, e.g. "Il tuo voto per OK Computer". */
  label?: string;
  /** Show the numeric value (mono, tabular) next to the stars. */
  showValue?: boolean;
  disabled?: boolean;
}

export function formatStars(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/**
 * Half-star rating. Interactive mode: each star has two touch halves (left = x.5, right = x.0)
 * and the whole control is an `adjustable` element, so screen-reader users swipe up/down by 0.5.
 */
export function RatingStars({
  value,
  onChange,
  size = 'md',
  label = 'Voto',
  showValue = false,
  disabled = false,
}: RatingStarsProps) {
  const { colors } = useTheme();
  const px = sizes[size];
  const interactive = Boolean(onChange) && !disabled;
  const current = value && value > 0 ? value : 0;
  const valueText = current > 0 ? `${formatStars(current)} stelle su 5` : 'Nessun voto';

  const commit = (next: number) => {
    if (interactive) onChange?.(clampStars(next));
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') commit((current || 0) + STEP);
    if (event.nativeEvent.actionName === 'decrement') commit((current || MIN + STEP) - STEP);
  };

  const stars = Array.from({ length: 5 }, (_, index) => {
    const fill: 0 | 0.5 | 1 = current >= index + 1 ? 1 : current >= index + 0.5 ? 0.5 : 0;
    const glyph =
      fill === 1 ? (
        <Star size={px} weight="fill" color={colors.accent} />
      ) : fill === 0.5 ? (
        <View>
          <Star size={px} weight="regular" color={colors.muted} />
          <View style={StyleSheet.absoluteFill}>
            <StarHalf size={px} weight="fill" color={colors.accent} />
          </View>
        </View>
      ) : (
        <Star size={px} weight="regular" color={colors.muted} />
      );
    if (!interactive) return <View key={index}>{glyph}</View>;
    return (
      <View key={index} style={{ width: px, height: px }}>
        {glyph}
        <View style={[StyleSheet.absoluteFill, styles.halves]}>
          <Pressable
            testID={`rating-star-${index + 0.5}`}
            accessible={false}
            style={styles.half}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => commit(index + 0.5)}
          />
          <Pressable
            testID={`rating-star-${index + 1}`}
            accessible={false}
            style={styles.half}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => commit(index + 1)}
          />
        </View>
      </View>
    );
  });

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole={interactive ? 'adjustable' : 'image'}
      accessibilityLabel={label}
      accessibilityValue={{ text: valueText }}
      accessibilityState={{ disabled }}
      accessibilityActions={
        interactive ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
      }
      onAccessibilityAction={interactive ? onAccessibilityAction : undefined}
    >
      <View style={[styles.row, { gap: size === 'sm' ? 1 : 4 }]}>{stars}</View>
      {showValue ? (
        <Text
          variant="mono"
          size={size === 'lg' ? 'xl' : 'sm'}
          tone={current > 0 ? 'primary' : 'muted'}
        >
          {current > 0 ? formatStars(current) : '—'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  halves: { flexDirection: 'row' },
  half: { flex: 1 },
});
