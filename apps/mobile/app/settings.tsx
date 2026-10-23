import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import type { ConnectedAccountInfo, NowPlayingSyncStatus } from '@openmusic/shared';
import { api, isApiError } from '../src/lib/api';
import { formatRelative } from '../src/lib/format';
import { useApiQuery } from '../src/lib/useApiQuery';
import { useAuth } from '../src/lib/auth';
import { useTheme } from '../src/theme';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Screen,
  Text,
  ThemeToggle,
  describeError,
} from '../src/components/ui';
import { haptics } from '../src/features/mobile-social/haptics';
import { Ghost, SignOut } from '../src/features/mobile-social/icons';
import { useGhostMode } from '../src/features/mobile-social/useGhostMode';

/**
 * Settings: profile fields (validated by the API, field errors inline), one-tap Ghost Mode (same
 * state as the Home friends bar), password change and logout with confirmation.
 */
export default function SettingsScreen() {
  const { user, updateProfile, changePassword, logout, connectedAccounts } = useAuth();
  const { colors } = useTheme();
  const ghost = useGhostMode();
  const hasLinked = connectedAccounts.length > 0;
  const accountsKey = connectedAccounts.map((a) => a.id).join(',');
  const syncStatus = useApiQuery(() => api.nowPlaying.syncStatus(), [accountsKey], {
    enabled: hasLinked,
  });

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<unknown>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<unknown>(null);
  const [pwDone, setPwDone] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    setProfileMsg(null);
    setProfileError(null);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        bio,
        avatarUrl: avatarUrl.trim() || null,
      });
      haptics.success();
      setProfileMsg('Profilo salvato');
    } catch (err) {
      haptics.error();
      setProfileError(err);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setPwBusy(true);
    setPwError(null);
    setPwDone(false);
    try {
      await changePassword({ currentPassword, newPassword });
      haptics.success();
      setCurrentPassword('');
      setNewPassword('');
      setPwDone(true);
    } catch (err) {
      haptics.error();
      setPwError(err);
    } finally {
      setPwBusy(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert('Uscire da OpenMusic?', 'Dovrai accedere di nuovo con email e password.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: () => void logout() },
    ]);

  const pwField = (name: string) => (isApiError(pwError) ? pwError.fieldError(name) : undefined);
  const profileField = (name: string) =>
    isApiError(profileError) ? profileError.fieldError(name) : undefined;
  const profileGeneralError =
    profileError &&
    !profileField('displayName') &&
    !profileField('bio') &&
    !profileField('avatarUrl')
      ? describeError(profileError)
      : null;

  return (
    <Screen edges={['bottom']}>
      <Card>
        <CardHeader eyebrow="Account" title={user ? `@${user.username}` : 'Account'} />
        <View style={styles.gap}>
          <Field
            label="Nome visualizzato"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={50}
            error={profileField('displayName')}
          />
          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={280}
            aside={`${bio.length}/280`}
            error={profileField('bio')}
          />
          <Field
            label="Immagine profilo (URL)"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://…"
            error={profileField('avatarUrl')}
          />
          {profileGeneralError ? (
            <Text size="sm" tone="rotten" accessibilityLiveRegion="polite">
              {profileGeneralError}
            </Text>
          ) : null}
          {profileMsg ? (
            <Text size="sm" tone="fresh" accessibilityLiveRegion="polite">
              {profileMsg}
            </Text>
          ) : null}
          <Button label="Salva profilo" onPress={saveProfile} loading={saving} />
        </View>
      </Card>

      <Card>
        <CardHeader eyebrow="Aspetto" title="Tema" />
        <ThemeToggle />
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <Ghost
            size={24}
            color={ghost.isGhostMode ? colors.accent : colors.textSubtle}
            weight={ghost.isGhostMode ? 'fill' : 'regular'}
          />
          <View style={styles.flex}>
            <Text variant="bodyStrong">Ghost Mode</Text>
            <Text size="sm" tone="secondary">
              Nasconde ai follower cosa stai ascoltando.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Ghost Mode"
            accessibilityHint="Nasconde ai follower cosa stai ascoltando"
            value={ghost.isGhostMode}
            disabled={ghost.pending}
            onValueChange={(v) => void ghost.setGhostMode(v)}
            trackColor={{ true: colors.accent, false: colors.borderStrong }}
            thumbColor={colors.surfaceRaised}
          />
        </View>
        {ghost.error ? (
          <Text size="sm" tone="rotten" accessibilityLiveRegion="polite" style={styles.mt}>
            {ghost.error}
          </Text>
        ) : null}
      </Card>

      <Card>
        <CardHeader eyebrow="Sicurezza" title="Password" />
        <View style={styles.gap}>
          <Field
            label="Password attuale"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            error={pwField('currentPassword')}
          />
          <Field
            label="Nuova password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            hint="Almeno 10 caratteri. Gli altri dispositivi verranno disconnessi."
            error={pwField('newPassword')}
          />
          {pwError && !pwField('currentPassword') && !pwField('newPassword') ? (
            <Text size="sm" tone="rotten">
              {describeError(pwError)}
            </Text>
          ) : null}
          {pwDone ? (
            <Text size="sm" tone="fresh">
              Password aggiornata.
            </Text>
          ) : null}
          <Button
            label="Cambia password"
            variant="secondary"
            onPress={savePassword}
            loading={pwBusy}
          />
        </View>
      </Card>

      <Card>
        <CardHeader eyebrow="Servizi collegati" title="Spotify e Last.fm" />
        {connectedAccounts.length === 0 ? (
          <Text size="sm" tone="secondary">
            Nessun servizio collegato. Il collegamento si fa per ora dal sito web.
          </Text>
        ) : (
          <View style={styles.gap}>
            {connectedAccounts.map((a) => (
              <ProviderSyncRow key={a.id} account={a} status={syncStatus.data} />
            ))}
          </View>
        )}
      </Card>

      <Button
        label="Esci"
        variant="danger"
        size="lg"
        leadingIcon={<SignOut size={18} color={colors.rotten} />}
        onPress={confirmLogout}
        fullWidth
      />
    </Screen>
  );
}

const PROVIDER_NAME: Record<ConnectedAccountInfo['provider'], string> = {
  SPOTIFY: 'Spotify',
  LASTFM: 'Last.fm',
  APPLE_MUSIC: 'Apple Music',
};

/**
 * ADR-013: automatic sync state of one linked service (same data as the web settings). Linking
 * and relinking happen on the web for now, so an interrupted sync points there.
 */
function ProviderSyncRow({
  account,
  status,
}: {
  account: ConnectedAccountInfo;
  status: NowPlayingSyncStatus | undefined;
}) {
  const name = PROVIDER_NAME[account.provider];
  const info =
    account.provider === 'APPLE_MUSIC' ? null : (status?.providers[account.provider] ?? null);
  const badge = !info
    ? { label: 'Collegato', tone: 'fresh' as const }
    : info.status === 'ERROR'
      ? { label: 'Sincronizzazione interrotta', tone: 'rotten' as const }
      : !status?.autoSyncEnabled
        ? { label: 'Solo manuale', tone: 'neutral' as const }
        : info.status === 'PAUSED'
          ? { label: 'In pausa', tone: 'neutral' as const }
          : { label: 'Sincronizzazione automatica attiva', tone: 'fresh' as const };

  return (
    <View style={styles.providerRow} accessible accessibilityLabel={`${name}: ${badge.label}`}>
      <View style={styles.row}>
        <Text variant="bodyStrong">{name}</Text>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      {info ? (
        <Text size="sm" tone="secondary">
          {info.lastSyncedAt ? 'Ultimo aggiornamento ' : 'Nessuna lettura ancora'}
          {info.lastSyncedAt ? (
            <Text size="sm" tone="primary">
              {formatRelative(info.lastSyncedAt)}
            </Text>
          ) : null}
        </Text>
      ) : null}
      {info?.status === 'ERROR' ? (
        <Text size="sm" tone="rotten">
          {info.lastError ?? `Non riusciamo più a leggere ${name}.`} Ricollegalo dal sito web
          (Impostazioni → Servizi collegati).
        </Text>
      ) : info?.lastError ? (
        <Text size="sm" tone="muted">
          {info.lastError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  providerRow: { gap: 4 },
  gap: { gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mt: { marginTop: 8 },
});
