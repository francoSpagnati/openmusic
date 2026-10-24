import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { isApiError } from '../../src/lib/api';
import {
  Button,
  Enter,
  ErrorState,
  Field,
  Screen,
  Text,
  describeError,
} from '../../src/components/ui';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fieldError = (name: string) => (isApiError(error) ? error.fieldError(name) : undefined);
  const formError =
    error && !fieldError('email') && !fieldError('password')
      ? isApiError(error) && error.code === 'INVALID_CREDENTIALS'
        ? 'Email o password non corrette.'
        : describeError(error)
      : null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // On success the root Stack.Protected swaps the (auth) stack for the tabs.
      await login({ email, password });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Enter style={styles.hero}>
        <Text variant="eyebrow">OpenMusic</Text>
        <Text variant="display" accessibilityRole="header">
          Bentornato
        </Text>
        <Text variant="deck" tone="secondary">
          Accedi per vedere cosa gira sui piatti dei tuoi amici.
        </Text>
      </Enter>
      {formError ? (
        <ErrorState variant="inline" title="Accesso non riuscito" description={formError} />
      ) : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={fieldError('email')}
        required
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={fieldError('password')}
        onSubmitEditing={submit}
        required
      />
      <Button label="Accedi" onPress={submit} loading={submitting} fullWidth size="lg" />
      <Link href="/register" style={styles.link}>
        <Text tone="accent" variant="bodyStrong">
          Non hai un account? Registrati
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 12, marginTop: 48, marginBottom: 8 },
  link: { alignSelf: 'center', paddingVertical: 12 },
});
