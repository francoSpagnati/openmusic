import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReleaseGroupType } from '@openmusic/shared';
import { api } from '../../src/lib/api';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { useTheme } from '../../src/theme';
import {
  Badge,
  CoverArt,
  Divider,
  EmptyState,
  Enter,
  ErrorState,
  Skeleton,
  SkeletonText,
  Text,
} from '../../src/components/ui';
import { DualScoreCard } from '../../src/features/mobile-discovery/release/DualScoreCard';
import { EditionRow } from '../../src/features/mobile-discovery/editions/EditionCards';

const GROUP_TYPE_LABEL: Record<ReleaseGroupType, string> = {
  ALBUM: 'Album',
  EP: 'EP',
  SINGLE: 'Singolo',
  LIVE: 'Live',
  COMPILATION: 'Raccolta',
  OTHER: 'Altro',
};

/** The background MusicBrainz sync is one request: reload once after this delay. */
const SYNC_RELOAD_MS = 8_000;

/**
 * Album as a work (ADR-012): cover, scores pooled across every edition (one vote per person) and
 * the list of editions, each with its own scores, linking to its release page.
 */
export default function AlbumScreen() {
  const { colors, space } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = typeof id === 'string' ? id : '';
  const group = useApiQuery(() => api.catalog.releaseGroup(groupId), [groupId], {
    enabled: groupId.length > 0,
  });
  const syncReloaded = useRef(false);
  const syncing = group.data?.editionsSyncing === true;
  const { reload } = group;

  useEffect(() => {
    if (!syncing || syncReloaded.current) return;
    const timer = setTimeout(() => {
      syncReloaded.current = true;
      void reload();
    }, SYNC_RELOAD_MS);
    return () => clearTimeout(timer);
  }, [syncing, reload]);

  if (group.loading) {
    return (
      <SafeAreaView
        edges={[]}
        style={[styles.flex, { backgroundColor: colors.bg, padding: space[4], gap: space[4] }]}
      >
        <View
          accessible
          accessibilityLabel="Caricamento dell'album"
          style={[styles.center, { gap: space[4] }]}
        >
          <Skeleton width={200} height={200} />
          <SkeletonText lines={3} />
          <Skeleton height={120} />
        </View>
      </SafeAreaView>
    );
  }
  if (group.error || !group.data) {
    return (
      <SafeAreaView
        edges={[]}
        style={[styles.flex, { backgroundColor: colors.bg, padding: space[4] }]}
      >
        <Stack.Screen options={{ title: 'Album' }} />
        <ErrorState
          title="Album non disponibile"
          error={group.error}
          onRetry={group.reload}
          retrying={group.refreshing}
        />
      </SafeAreaView>
    );
  }

  const data = group.data;
  const count = data.editions.length;

  return (
    <SafeAreaView edges={[]} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: data.title }} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingTop: space[6],
          paddingBottom: space[12],
          gap: space[8],
        }}
        refreshControl={
          <RefreshControl
            refreshing={group.refreshing}
            onRefresh={group.reload}
            tintColor={colors.accent}
          />
        }
      >
        <View style={[styles.center, { gap: space[3] }]}>
          <CoverArt
            key={data.coverUrl ?? 'none'}
            uri={data.coverUrl}
            size={200}
            label={`Copertina di ${data.title}, ${data.artistName}`}
          />
        </View>
        <View style={{ gap: space[2] }}>
          <Text variant="eyebrow">
            {[
              GROUP_TYPE_LABEL[data.primaryType],
              data.firstYear ? `prima uscita ${data.firstYear}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {data.title}
          </Text>
          <Text variant="deck" tone="secondary">
            {data.artistName}
          </Text>
          <View style={styles.badges}>
            <Badge
              label={count === 1 ? '1 edizione' : `${count} edizioni`}
              variant="outline"
              size="sm"
            />
            {data.genres.slice(0, 3).map((g) => (
              <Badge key={g} label={g} size="sm" />
            ))}
          </View>
        </View>

        <DualScoreCard
          score={data.scores}
          title="Voto complessivo · tutte le edizioni"
          note="Somma le recensioni di tutte le edizioni contando ogni persona una volta sola (la sua recensione più recente)."
        />

        <View style={{ gap: space[3] }}>
          <Divider />
          <Text variant="title" size="xl" accessibilityRole="header">
            Edizioni
          </Text>
          <Text variant="caption" tone="muted">
            Dalla più vecchia alla più recente. Ognuna ha tracklist, recensioni e voti propri.
          </Text>
          {syncing ? (
            <View
              accessible
              accessibilityLiveRegion="polite"
              style={[styles.syncRow, { gap: space[2] }]}
            >
              <ActivityIndicator color={colors.accent} />
              <Text variant="caption" tone="secondary" style={styles.flex}>
                Sto cercando altre edizioni su MusicBrainz: tira giù per aggiornare.
              </Text>
            </View>
          ) : null}
          {count > 0 ? (
            data.editions.map((edition, i) => (
              <Enter key={edition.id} index={i}>
                {i > 0 ? <Divider /> : null}
                <EditionRow edition={edition} />
              </Enter>
            ))
          ) : (
            <EmptyState
              size="compact"
              title="Ancora nessuna edizione nel catalogo"
              description={
                syncing
                  ? 'Le stiamo importando adesso: aggiorna tra qualche secondo.'
                  : 'Cerca il disco in Esplora per importarne un’edizione.'
              }
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  syncRow: { flexDirection: 'row', alignItems: 'center' },
});
