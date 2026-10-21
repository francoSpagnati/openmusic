import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { isApiError } from '../../src/lib/api';
import { Button, ErrorState, Field, Screen, Text, describeError } from '../../src/components/ui';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fieldError = (name: string) => (isApiError(error) ? error.fieldError(name) : undefined);
  const hasFieldErrors = isApiError(error) && Object.keys(error.fieldErrors).length > 0;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await register({
        email,
        username,
        password,
        displayName: displayName.trim() ? displayName.trim() : undefined,
      });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Text variant="eyebrow">OpenMusic · Nuovo iscritto</Text>
        <Text variant="display" accessibilityRole="header">
          Apri il tuo negozio di dischi
        </Text>
      </View>
      {error && !hasFieldErrors ? (
        <ErrorState
          variant="inline"
          title="Registrazione non riuscita"
          description={describeError(error)}
        />
      ) : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={fieldError('email')}
        required
      />
      <Field
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
        hint="Lettere, numeri e underscore. Sarà il tuo @handle."
        error={fieldError('username')}
        required
      />
      <Field
        label="Nome visualizzato"
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
        error={fieldError('displayName')}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="Almeno 10 caratteri."
        error={fieldError('password')}
        required
      />
      <Button label="Crea account" onPress={submit} loading={submitting} fullWidth size="lg" />
      <Link href="/login" style={styles.link}>
        <Text tone="accent" variant="bodyStrong">
          Hai già un account? Accedi
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, marginTop: 32, marginBottom: 8 },
  link: { alignSelf: 'center', paddingVertical: 12 },
});
