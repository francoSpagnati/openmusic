import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowClockwise, SmileySad } from '../icons';
import { useTheme, withAlpha } from '../../theme';
import { isApiError } from '../../lib/api/errors';
import { Button } from './Button';
import { Text } from './Text';

export interface ErrorStateProps {
  /** Human, calm, specific. Never an HTTP code. */
  title?: string;
  description?: string;
  /** When given, the description is derived from it (network vs server) unless set explicitly. */
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  /** `inline` is a slim banner for lists/cards. */
  variant?: 'block' | 'inline';
}

/** Friendly copy for an unknown error (used by screens and by `ErrorState`). */
export function describeError(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'NETWORK_ERROR')
      return 'Sembra che tu sia offline o che il server non risponda.';
    if (error.code === 'INVALID_RESPONSE')
      return "L'app e il server non si capiscono: aggiorna l'app.";
    return error.message;
  }
  return 'La puntina è saltata. Riprova tra un attimo.';
}

export function ErrorState({
  title = 'Qualcosa si è inceppato',
  description,
  error,
  onRetry,
  retryLabel = 'Riprova',
  retrying = false,
  variant = 'block',
}: ErrorStateProps) {
  const { colors, radii } = useTheme();
  const body = description ?? describeError(error);
  const inline = variant === 'inline';
  return (
    <View
      accessibilityRole="alert"
      style={[
        inline ? styles.inline : styles.block,
        {
          borderRadius: radii.lg,
          borderColor: withAlpha(colors.rotten, 0.4),
          backgroundColor: withAlpha(colors.rotten, 0.08),
        },
      ]}
    >
      {!inline ? <SmileySad size={40} color={colors.rotten} weight="duotone" /> : null}
      <View style={inline ? styles.inlineText : styles.blockText}>
        <Text
          variant={inline ? 'bodyStrong' : 'headline'}
          size={inline ? 'sm' : 'xl'}
          style={!inline && styles.center}
        >
          {title}
        </Text>
        <Text size="sm" tone="secondary" style={!inline && styles.center}>
          {body}
        </Text>
      </View>
      {onRetry ? (
        <Button
          label={retryLabel}
          variant="secondary"
          size="sm"
          loading={retrying}
          onPress={onRetry}
          leadingIcon={<ArrowClockwise size={14} weight="bold" color={colors.text} />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', gap: 12, padding: 24, borderWidth: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1 },
  blockText: { gap: 4, alignItems: 'center' },
  inlineText: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
});
