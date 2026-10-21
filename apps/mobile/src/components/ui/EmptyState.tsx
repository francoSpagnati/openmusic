import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Disc } from '../icons';
import { useTheme } from '../../theme';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Phosphor icon element; defaults to a vinyl disc. */
  icon?: React.ReactNode;
  /** Primary next step, usually a `<Button>`. */
  action?: React.ReactNode;
  size?: 'compact' | 'default';
}

/** "Empty crate": what is missing and what to do next. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  size = 'default',
}: EmptyStateProps) {
  const { colors, radii } = useTheme();
  const compact = size === 'compact';
  return (
    <View
      style={[
        styles.box,
        {
          borderColor: colors.border,
          borderRadius: radii.lg,
          paddingVertical: compact ? 24 : 48,
          gap: compact ? 8 : 12,
        },
      ]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icon ?? <Disc size={compact ? 32 : 48} color={colors.muted} weight="duotone" />}
      </View>
      <Text
        variant="headline"
        size={compact ? 'lg' : '2xl'}
        style={styles.center}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {description ? (
        <Text size="sm" tone="secondary" style={styles.center}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 24 },
  center: { textAlign: 'center' },
  action: { marginTop: 4 },
});
