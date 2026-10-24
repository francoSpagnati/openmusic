import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CatalogRelease, CatalogTrack } from '@openmusic/shared';
import { useTheme } from '../../theme';
import {
  Badge,
  CoverArt,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
  Text,
} from '../../components/ui';
import { formatDuration } from '../../lib/format';
import { Disc } from '../../components/icons';
import { MusicNote, X } from './icons';
import { haptics } from './haptics';
import { useCatalogSearch } from './useCatalogSearch';

export type CatalogPick =
  { kind: 'track'; track: CatalogTrack } | { kind: 'release'; release: CatalogRelease };

const RELEASE_TYPE_LABEL: Record<CatalogRelease['releaseType'], string> = {
  ALBUM: 'Album',
  SINGLE: 'Singolo',
  EP: 'EP',
};

type Row = { key: string; pick: CatalogPick };

export interface CatalogPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (pick: CatalogPick) => void;
  /** `tracks` for chat (only tracks can be shared), `all` for posts. */
  mode: 'tracks' | 'all';
  title?: string;
}

/** Bottom sheet that searches the catalog (local + external databases) and returns a pick. */
export function CatalogPickerSheet({
  visible,
  onClose,
  onPick,
  mode,
  title,
}: CatalogPickerSheetProps) {
  const { colors, space, radii } = useTheme();
  const [query, setQuery] = useState('');
  const search = useCatalogSearch(visible ? query : '', mode);

  const rows: Row[] = search.result
    ? [
        ...(mode === 'all'
          ? search.result.releases.map((release): Row => ({
              key: `r:${release.id}`,
              pick: { kind: 'release', release },
            }))
          : []),
        ...search.result.tracks.map((track): Row => ({
          key: `t:${track.id}`,
          pick: { kind: 'track', track },
        })),
      ]
    : [];

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
            {title ?? (mode === 'tracks' ? 'Scegli un brano' : 'Allega un disco o un brano')}
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
        <View style={{ paddingHorizontal: space[5], paddingVertical: space[3] }}>
          <Field
            label="Cerca nel catalogo"
            placeholder="Titolo, artista…"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            hint="Cerchiamo anche su Deezer, iTunes e MusicBrainz."
          />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: space[5],
            paddingBottom: space[8],
            gap: space[2],
          }}
          renderItem={({ item }) => {
            const p = item.pick;
            const titleText = p.kind === 'track' ? p.track.title : p.release.title;
            const artist = p.kind === 'track' ? p.track.artistName : p.release.artistName;
            const cover = p.kind === 'track' ? p.track.coverUrl : p.release.coverUrl;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${p.kind === 'track' ? 'Brano' : 'Disco'}: ${titleText} di ${artist}`}
                onPress={() => {
                  haptics.select();
                  setQuery('');
                  onPick(p);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderRadius: radii.md,
                    backgroundColor: pressed ? colors.surface : colors.surfaceRaised,
                  },
                ]}
              >
                <CoverArt uri={cover ?? null} size={48} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {titleText}
                  </Text>
                  <Text size="sm" tone="secondary" numberOfLines={1}>
                    {artist}
                    {p.kind === 'track' ? ` · ${formatDuration(p.track.durationMs)}` : ''}
                  </Text>
                </View>
                <Badge
                  label={p.kind === 'track' ? 'Brano' : RELEASE_TYPE_LABEL[p.release.releaseType]}
                  size="sm"
                  icon={
                    p.kind === 'track' ? (
                      <MusicNote size={12} color={colors.textMuted} />
                    ) : (
                      <Disc size={12} color={colors.textMuted} />
                    )
                  }
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            search.loading ? (
              <View style={{ gap: space[2] }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height={64} />
                ))}
              </View>
            ) : search.error ? (
              <ErrorState title="Ricerca non riuscita" error={search.error} />
            ) : query.trim().length >= 2 && search.result ? (
              <EmptyState
                title="Nessun risultato"
                description="Prova con il titolo esatto o il nome dell'artista."
                size="compact"
              />
            ) : (
              <EmptyState
                title="Cerca un brano"
                description="Scrivi almeno due lettere."
                size="compact"
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 64 },
});
