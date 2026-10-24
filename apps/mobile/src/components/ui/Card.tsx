import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type CardVariant = 'surface' | 'sleeve' | 'outline' | 'sunken';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends ViewProps {
  /** `sleeve` is the hairline card on the raised paper layer (web `.om-sleeve`). */
  variant?: CardVariant;
  padding?: CardPadding;
}

const paddings: Record<CardPadding, number> = { none: 0, sm: 12, md: 20, lg: 24 };

export function Card({ variant = 'surface', padding = 'md', style, children, ...rest }: CardProps) {
  const { colors, radii } = useTheme();
  const look = {
    surface: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.lg,
    },
    sleeve: {
      // Hairline card (web `.om-sleeve`): structure from the border, no drop shadow.
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.sleeve,
    },
    outline: {
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.lg,
    },
    sunken: { backgroundColor: colors.sunken, borderRadius: radii.lg },
  }[variant];
  return (
    <View style={[look, { padding: paddings[padding] }, style]} {...rest}>
      {children}
    </View>
  );
}

export interface CardHeaderProps {
  /** Small sentence-case label above the title, e.g. "Lato A". */
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}

export function CardHeader({ eyebrow, title, action }: CardHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
        <Text variant="title" size="lg" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
});
