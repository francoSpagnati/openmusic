import React from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView (default). Use `false` for screens that own a FlashList. */
  scroll?: boolean;
  /** Safe-area edges to pad. Tab screens skip `bottom` (the tab bar handles it). */
  edges?: Edge[];
  /** Horizontal padding; set to 0 for edge-to-edge content. */
  padded?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
}

/** Page container: themed background, safe areas, 16px gutters. */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  padded = true,
  refreshControl,
}: ScreenProps) {
  const { colors, space } = useTheme();
  const pad = padded ? space[4] : 0;
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.bg }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: pad, gap: space[4], paddingBottom: space[8] }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, { paddingHorizontal: pad }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
