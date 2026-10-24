import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme, withAlpha } from '../../theme';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'accent' | 'fresh' | 'mixed' | 'rotten' | 'live';
export type BadgeVariant = 'soft' | 'outline' | 'solid';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Pair colour with an icon or text, never colour alone. */
  icon?: React.ReactNode;
  /** Tabular monospace, only for numeric labels (counters). Words stay in the sans. */
  mono?: boolean;
}

export function Badge({
  label,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon,
  mono = false,
}: BadgeProps) {
  const { colors, radii, font } = useTheme();
  const base = {
    neutral: colors.textMuted,
    accent: colors.accent,
    fresh: colors.fresh,
    mixed: colors.warning,
    rotten: colors.rotten,
    live: colors.fresh,
  }[tone];
  const solidFg = tone === 'accent' ? colors.accentContrast : colors.bg;
  const look =
    variant === 'solid'
      ? {
          backgroundColor: tone === 'neutral' ? colors.text : base,
          borderColor: 'transparent',
          color: solidFg,
        }
      : variant === 'outline'
        ? {
            backgroundColor: 'transparent',
            borderColor: tone === 'neutral' ? colors.borderStrong : withAlpha(base, 0.6),
            color: base,
          }
        : {
            backgroundColor: withAlpha(
              tone === 'neutral' ? colors.text : base,
              tone === 'neutral' ? 0.06 : 0.12
            ),
            borderColor: 'transparent',
            color: base,
          };
  const fontSize = size === 'sm' ? 12 : 13;
  return (
    <View
      style={[
        styles.badge,
        {
          height: size === 'sm' ? 20 : 24,
          paddingHorizontal: size === 'sm' ? 6 : 8,
          borderRadius: radii.sm,
          backgroundColor: look.backgroundColor,
          borderColor: look.borderColor,
        },
      ]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={{
          color: look.color,
          fontSize,
          lineHeight: fontSize + 2,
          fontFamily: mono ? font.mono : font.sansMedium,
          fontVariant: mono ? ['tabular-nums'] : undefined,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
