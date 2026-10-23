import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useEntering, useTheme } from '../../theme';

export interface EnterProps extends Pick<ViewProps, 'testID'> {
  children: React.ReactNode;
  /** `up`: fade + 6px rise (default); `fade`: opacity only. */
  kind?: 'up' | 'fade';
  /** Position in a list: items enter 40ms apart (first 8 only). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps content in a calm entering animation (web `.om-enter` / `.om-stagger`). Under reduced
 * motion the content simply appears.
 */
export function Enter({ children, kind = 'up', index = 0, style, testID }: EnterProps) {
  const entering = useEntering(kind, index);
  return (
    <Animated.View entering={entering} style={style} testID={testID}>
      {children}
    </Animated.View>
  );
}

/** Hairline separator (web `.om-rule`). */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]}
    />
  );
}
