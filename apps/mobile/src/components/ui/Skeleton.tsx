import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { THEME } from '@openmusic/shared';
import { useTheme } from '../../theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  /** `circle` for avatars, `text` for a line of copy. */
  shape?: 'rect' | 'circle' | 'text';
}

/** Placeholder block with a slow "groove" pulse (disabled when the OS asks for reduced motion). */
export function Skeleton({ width = '100%', height = 16, shape = 'rect' }: SkeletonProps) {
  const { colors, radii } = useTheme();
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      const half = THEME.motion.duration.groove / 2;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: half, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: half, useNativeDriver: true }),
        ])
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  const size = typeof height === 'number' ? height : 16;
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: shape === 'circle' ? size : width,
        height,
        borderRadius: shape === 'circle' ? size / 2 : shape === 'text' ? radii.xs : radii.sleeve,
        backgroundColor: colors.surface,
        opacity,
      }}
    />
  );
}

/** A few text lines, the last one shorter. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.lines} accessibilityLabel="Caricamento" accessibilityRole="progressbar">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} shape="text" height={14} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ lines: { gap: 8 } });
