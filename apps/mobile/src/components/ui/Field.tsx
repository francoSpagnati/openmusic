import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { WarningCircle } from '../icons';
import { typeScale, useTheme } from '../../theme';
import { Text } from './Text';

export interface FieldProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label: string;
  /** Help text under the control. */
  hint?: string;
  /** Human, actionable message (e.g. from `ApiError.fieldError('password')`), never a code. */
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Counter or action on the label row (e.g. "120/3000"). */
  aside?: string;
  ref?: React.Ref<TextInputInstance>;
}

/** Labelled text input mirroring the web `<Field>`: label, hint and error announced together. */
export function Field({
  label,
  hint,
  error,
  required,
  disabled,
  aside,
  onFocus,
  onBlur,
  ref,
  ...inputProps
}: FieldProps) {
  const { colors, radii, font } = useTheme();
  const [focused, setFocused] = useState(false);
  const a11yLabel = [label, required ? 'obbligatorio' : null, error ?? null, hint ?? null]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="eyebrow" tone="primary" size="sm" importantForAccessibility="no">
          {label}
          {required ? <Text tone="accent"> *</Text> : null}
        </Text>
        {aside ? (
          <Text variant="mono" size="xs" tone="muted">
            {aside}
          </Text>
        ) : null}
      </View>
      <TextInput
        ref={ref}
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
        editable={!disabled}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...inputProps}
        style={[
          styles.input,
          typeScale('base'),
          {
            fontFamily: font.sans,
            color: colors.text,
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.md,
            borderColor: error ? colors.rotten : focused ? colors.focus : colors.borderStrong,
            borderWidth: focused || error ? 2 : 1,
            opacity: disabled ? 0.5 : 1,
          },
          inputProps.multiline ? styles.multiline : null,
        ]}
      />
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <WarningCircle size={16} weight="fill" color={colors.rotten} />
          <Text size="sm" tone="rotten" style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : null}
      {hint ? (
        <Text size="sm" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  flex: { flex: 1 },
});
