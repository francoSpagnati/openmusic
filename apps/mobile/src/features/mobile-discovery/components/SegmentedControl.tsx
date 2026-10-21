import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';
import { Text } from '../../../components/ui';
import { haptics } from '../haptics';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (value: T) => void;
}

/** Tab-like switch (screen readers: a tab list with the selected tab announced). */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[
        styles.row,
        { backgroundColor: colors.sunken, borderColor: colors.border, borderRadius: radii.md },
      ]}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(segment.value);
            }}
            style={[
              styles.segment,
              { borderRadius: radii.md - 2 },
              selected && { backgroundColor: colors.elevated, borderColor: colors.borderStrong },
            ]}
          >
            <Text variant="bodyStrong" size="sm" tone={selected ? 'primary' : 'secondary'}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 3, borderWidth: 1, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
