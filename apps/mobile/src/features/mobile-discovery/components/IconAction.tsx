import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { THEME } from '@openmusic/shared';
import { useTheme, withAlpha } from '../../../theme';
import { Text } from '../../../components/ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface IconActionProps {
  /** Accessible name (also the visible caption when `caption` is true). */
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  /** Diameter in pt; 56 by default (thumb-zone controls), never below 44. */
  size?: number;
  active?: boolean;
  disabled?: boolean;
  busy?: boolean;
  caption?: string;
  /** Translucent fill for controls over artwork. */
  overlay?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Round icon button that springs on press (UI thread, Reanimated; springs follow the OS "reduce
 * motion" setting). Used for the Reels action rail and the play buttons.
 */
export function IconAction({
  label,
  icon,
  onPress,
  size = 56,
  active = false,
  disabled = false,
  busy = false,
  caption,
  overlay = false,
  accessibilityHint,
  testID,
  style,
}: IconActionProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const diameter = Math.max(44, size);
  return (
    <View style={[styles.wrap, style]}>
      <AnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, selected: active, busy }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.9, THEME.spring.snappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, THEME.spring.snappy);
        }}
        style={[
          styles.button,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: active
              ? withAlpha(colors.accent, overlay ? 0.9 : 0.16)
              : overlay
                ? withAlpha(colors.bg, 0.72)
                : colors.elevated,
            borderColor: active ? colors.accent : colors.border,
            opacity: disabled ? 0.5 : 1,
          },
          animated,
        ]}
      >
        {icon}
      </AnimatedPressable>
      {caption ? (
        <Text
          variant="caption"
          size="xs"
          tone="secondary"
          numberOfLines={1}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
