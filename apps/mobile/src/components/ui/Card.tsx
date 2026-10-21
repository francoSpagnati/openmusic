import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type CardVariant = 'surface' | 'sleeve' | 'outline' | 'sunken';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends ViewProps {
  /** `sleeve` is the record-sleeve look: sleeve radius, open right edge, cardboard lift. */
  variant?: CardVariant;
  padding?: CardPadding;
}

const paddings: Record<CardPadding, number> = { none: 0, sm: 12, md: 16, lg: 24 };

export function Card({ variant = 'surface', padding = 'md', style, children, ...rest }: CardProps) {
  const { colors, radii } = useTheme();
  const look = {
    surface: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.lg,
    },
    sleeve: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRightWidth: 0,
      borderRadius: radii.sleeve,
      shadowColor: '#0A0805',
      shadowOpacity: 0.5,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    outline: { borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg },
    sunken: { backgroundColor: colors.sunken, borderRadius: radii.lg },
  }[variant];
  return (
    <View style={[look, { padding: paddings[padding] }, style]} {...rest}>
      {children}
    </View>
  );
}

export interface CardHeaderProps {
  /** Small mono catalogue label above the title, e.g. "LATO A · 1997". */
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}

export function CardHeader({ eyebrow, title, action }: CardHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
        <Text variant="title" size="xl" numberOfLines={1} accessibilityRole="header">
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
