import React from 'react';
import { View } from 'react-native';
import { Badge } from '../../../components/ui';
import { useTheme } from '../../../theme';
import { editionName } from '../catalog';
import { VinylRecord } from '../icons';

/**
 * Which edition of an album this is ("Remaster 2011", "Deluxe", "Edizione standard"): a record
 * icon plus text, never colour alone. Screen readers hear "Edizione: …".
 */
export function EditionChip({
  label,
  size = 'md',
}: {
  label: string | null | undefined;
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const name = editionName(label);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`Edizione: ${name}`}>
      <Badge
        label={name}
        tone={label ? 'accent' : 'neutral'}
        variant="outline"
        size={size}
        icon={
          <VinylRecord
            size={size === 'sm' ? 12 : 14}
            weight="duotone"
            color={label ? colors.accent : colors.textSecondary}
          />
        }
      />
    </View>
  );
}
