import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DeviceMobile, Moon, Sun, type IconProps } from '../icons';
import { useTheme, useThemePreference, type ThemePreference } from '../../theme';
import { Text } from './Text';

const OPTIONS: { value: ThemePreference; label: string; Icon: React.ComponentType<IconProps> }[] = [
  { value: 'light', label: 'Chiaro', Icon: Sun },
  { value: 'dark', label: 'Scuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: DeviceMobile },
];

const SCHEME_WORD = { light: 'chiaro', dark: 'scuro' } as const;

/**
 * Appearance picker for Settings (twin of the web `<ThemeToggle />`): three radios, Chiaro /
 * Scuro / Sistema, plus a help line saying what "Sistema" currently resolves to.
 */
export function ThemeToggle() {
  const { colors, radii } = useTheme();
  const { preference, systemScheme, setPreference } = useThemePreference();
  const systemWord = SCHEME_WORD[systemScheme];

  return (
    <View style={styles.wrap}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Tema"
        style={[
          styles.row,
          { backgroundColor: colors.sunken, borderColor: colors.border, borderRadius: radii.md },
        ]}
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = preference === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={value === 'system' ? `${label}, ora ${systemWord}` : label}
              onPress={() => setPreference(value)}
              style={[
                styles.option,
                { borderRadius: radii.md - 2 },
                selected && {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.borderStrong,
                },
              ]}
            >
              <Icon
                size={18}
                color={selected ? colors.text : colors.textMuted}
                weight={selected ? 'fill' : 'regular'}
              />
              <Text variant="eyebrow" size="sm" tone={selected ? 'primary' : 'secondary'}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text size="sm" tone="muted">
        {preference === 'system'
          ? `Segue il sistema, ora ${systemWord}.`
          : `Sempre ${SCHEME_WORD[preference]}, qualunque sia il tema del telefono.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', padding: 3, gap: 3, borderWidth: StyleSheet.hairlineWidth },
  option: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
