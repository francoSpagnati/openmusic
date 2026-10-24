import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserSummary } from '@openmusic/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../theme';
import { Avatar, EmptyState, ErrorState, Field, Skeleton, Text } from '../../components/ui';
import { X } from './icons';
import { haptics } from './haptics';

export interface UserPickerSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (user: UserSummary) => void;
}

interface State {
  users: UserSummary[];
  loading: boolean;
  error: unknown;
}

/** People search (`/api/users/search`); with an empty query it lists the people you follow. */
export function UserPickerSheet({ visible, title, onClose, onPick }: UserPickerSheetProps) {
  const { colors, space, radii } = useTheme();
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ users: [], loading: false, error: null });
  const q = query.trim();

  useEffect(() => {
    if (!visible || !me) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(
      () => {
        const request =
          q.length > 0
            ? api.users.search({ q, limit: 20 })
            : api.users.following(me.id, { limit: 30 });
        request
          .then((page) => {
            if (!cancelled)
              setState({
                users: page.items.filter((u) => u.id !== me.id),
                loading: false,
                error: null,
              });
          })
          .catch((error: unknown) => {
            if (!cancelled) setState({ users: [], loading: false, error });
          });
      },
      q.length > 0 ? 300 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, q, me]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { paddingHorizontal: space[5], paddingTop: space[3] }]}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chiudi"
            hitSlop={10}
            onPress={close}
            style={styles.close}
          >
            <X size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ padding: space[5] }}>
          <Field
            label="Cerca persone"
            placeholder="Nome o @username"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={state.users}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: space[5],
            paddingBottom: space[8],
            gap: space[1],
          }}
          ListHeaderComponent={
            q.length === 0 && state.users.length > 0 ? (
              <Text variant="eyebrow" style={{ marginBottom: space[2] }}>
                Persone che segui
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => {
            const name = item.displayName ?? item.username;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${name}, @${item.username}`}
                onPress={() => {
                  haptics.select();
                  setQuery('');
                  onPick(item);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderRadius: radii.md,
                    backgroundColor: pressed ? colors.surface : 'transparent',
                  },
                ]}
              >
                <Avatar name={name} src={item.avatarUrl} decorative />
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text size="xs" tone="muted">
                    @{item.username}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            state.loading ? (
              <View style={{ gap: space[2] }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} height={56} />
                ))}
              </View>
            ) : state.error ? (
              <ErrorState title="Ricerca non riuscita" error={state.error} />
            ) : (
              <EmptyState
                size="compact"
                title={q.length > 0 ? 'Nessuno con questo nome' : 'Non segui ancora nessuno'}
                description={q.length > 0 ? undefined : 'Cerca una persona per nome o username.'}
              />
            )
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 56 },
});
