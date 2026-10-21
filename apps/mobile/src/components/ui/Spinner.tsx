import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

/** Centered loading indicator with an optional caption. */
export function Spinner({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.center}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Caricamento'}
    >
      <ActivityIndicator color={colors.accent} />
      {label ? (
        <Text size="sm" tone="secondary">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
