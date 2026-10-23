import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, withAlpha, type AppTheme } from '../../theme';
import { Text } from './Text';

/** `primary` is the only clay fill: one per screen. `link` is an inline text action. */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner and blocks presses while keeping the label for layout. */
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const heights: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const paddings: Record<ButtonSize, number> = { sm: 12, md: 16, lg: 24 };

function palette(variant: ButtonVariant, t: AppTheme, pressed: boolean) {
  const c = t.colors;
  switch (variant) {
    case 'primary':
      return {
        bg: pressed ? c.accentHover : c.accent,
        border: 'transparent',
        fg: c.accentContrast,
      };
    case 'secondary':
      return { bg: pressed ? c.surface : c.surfaceRaised, border: c.border, fg: c.text };
    case 'outline':
      return {
        bg: pressed ? withAlpha(c.text, 0.06) : 'transparent',
        border: c.borderStrong,
        fg: c.text,
      };
    case 'ghost':
      return {
        bg: pressed ? withAlpha(c.text, 0.06) : 'transparent',
        border: 'transparent',
        fg: c.textMuted,
      };
    case 'link':
      return { bg: 'transparent', border: 'transparent', fg: pressed ? c.accentHover : c.accent };
    case 'danger':
      return {
        bg: pressed ? withAlpha(c.rotten, 0.12) : 'transparent',
        border: withAlpha(c.rotten, 0.6),
        fg: c.rotten,
      };
  }
}

/**
 * Mirrors the web `<Button>`: same variants/sizes, 44pt min touch target for `md`. Calm press
 * feedback (colour only, no lift); `primary` is the single clay action of a screen.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled) || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={size === 'sm' ? 4 : 0}
      {...rest}
      style={({ pressed }) => {
        const p = palette(variant, theme, pressed);
        return [
          styles.base,
          {
            height: heights[size],
            paddingHorizontal: variant === 'link' ? 4 : paddings[size],
            borderRadius: size === 'lg' ? theme.radii.lg : theme.radii.md,
            backgroundColor: p.bg,
            borderColor: p.border,
            opacity: disabled ? 0.5 : 1,
          },
          fullWidth && styles.fullWidth,
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const p = palette(variant, theme, pressed);
        return (
          <>
            <View style={[styles.content, loading && styles.hidden]}>
              {leadingIcon}
              <Text
                variant="bodyStrong"
                size={size === 'lg' ? 'base' : 'sm'}
                style={[{ color: p.fg }, variant === 'link' && styles.underline]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {trailingIcon}
            </View>
            {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={p.fg} />}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hidden: { opacity: 0 },
  underline: { textDecorationLine: 'underline' },
});
