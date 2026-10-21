import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import type { GenreList } from '@openmusic/shared';
import { useTheme, withAlpha } from '../../../theme';
import { Text } from '../../../components/ui';
import { haptics } from '../haptics';

export interface GenreChipsProps {
  genres: GenreList;
  selected: string | null;
  onSelect: (genre: string | null) => void;
  max?: number;
}

/** Horizontal genre filter for the browse list ("Tutti" + the biggest genres in the catalog). */
export function GenreChips({ genres, selected, onSelect, max = 15 }: GenreChipsProps) {
  const { colors, radii, space } = useTheme();
  const top = genres
    .slice()
    .sort((a, b) => b.releaseCount - a.releaseCount)
    .slice(0, max);
  const chips: Array<{ name: string | null; label: string }> = [
    { name: null, label: 'Tutti' },
    ...top.map((g) => ({ name: g.name, label: g.name })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel="Filtra per genere"
      contentContainerStyle={{ gap: space[2] }}
    >
      {chips.map((chip) => {
        const active = chip.name === selected;
        return (
          <Pressable
            key={chip.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptics.select();
              onSelect(chip.name);
            }}
            style={[
              styles.chip,
              {
                borderRadius: radii.pill,
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: active ? withAlpha(colors.accent, 0.16) : colors.surface,
                paddingHorizontal: space[3],
              },
            ]}
          >
            <Text variant="bodyStrong" size="sm" tone={active ? 'accent' : 'secondary'}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 40, justifyContent: 'center', borderWidth: 1 },
});
