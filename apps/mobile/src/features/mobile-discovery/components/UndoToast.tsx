import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useTheme } from '../../../theme';
import { Text } from '../../../components/ui';

export interface UndoToastProps {
  /** Changes on every new toast so the timer restarts. */
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Snackbar in the thumb zone (bottom of the screen) with an optional "Annulla" action. Announced
 * to screen readers; disappears after `durationMs`.
 */
export function UndoToast({
  id,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 5000,
}: UndoToastProps) {
  const { colors, radii, space } = useTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      actionLabel ? `${message}. ${actionLabel} disponibile.` : message
    );
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [id, message, actionLabel, onDismiss, durationMs]);

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.borderStrong,
          borderRadius: radii.lg,
          padding: space[3],
        },
      ]}
    >
      <Text size="sm" style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={styles.action}
        >
          <Text variant="bodyStrong" size="sm" tone="accent">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  message: { flex: 1 },
  action: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
});
