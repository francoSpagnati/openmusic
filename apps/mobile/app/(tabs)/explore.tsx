import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CatalogRelease, CatalogTrack } from '@openmusic/shared';
import { api } from '../../src/lib/api';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { useTheme } from '../../src/theme';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
  Text,
} from '../../src/components/ui';
import { PreviewPlayerProvider } from '../../src/features/mobile-discovery/PreviewPlayer';
import { groupEditions, sourceLabel } from '../../src/features/mobile-discovery/catalog';
import { SegmentedControl } from '../../src/features/mobile-discovery/components/SegmentedControl';
import { GenreChips } from '../../src/features/mobile-discovery/explore/GenreChips';
import { GenreRoulette } from '../../src/features/mobile-discovery/explore/GenreRoulette';
import {
  ReleaseResultRow,
  TrackResultRow,
} from '../../src/features/mobile-discovery/explore/ResultRows';
import { useBrowsePages } from '../../src/features/mobile-discovery/explore/useBrowsePages';
import {
  useSearchPages,
  type SearchKind,
} from '../../src/features/mobile-discovery/explore/useSearchPages';

const SEARCH_DEBOUNCE_MS = 350;

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Row =
  | { kind: 'release'; release: CatalogRelease; editionCount: number }
  | { kind: 'track'; track: CatalogTrack };

const SEGMENTS = [
  { value: 'releases', label: 'Dischi' },
  { value: 'tracks', label: 'Brani' },
] as const;

/**
 * Esplora. Without a query: genre roulette, genre filter and popular releases (cursor paging).
 * With a query: paged catalog search, discs or tracks. Search reaches the local catalog plus the
 * external databases (Deezer, iTunes, MusicBrainz, Cover Art Archive) that the API imports on the
 * fly, so covers and metadata are real; each result shows where its cover came from.
 */
export default function ExploreScreen() {
  return (
    <PreviewPlayerProvider>
      <ExploreContent />
    </PreviewPlayerProvider>
  );
}

function ExploreContent() {
  const { colors, space } = useTheme();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('releases');
  const [genre, setGenre] = useState<string | null>(null);
  const q = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const searching = q.length > 0;

  const search = useSearchPages(q, kind);
  const browse = useBrowsePages(genre, !searching);
  const genres = useApiQuery(() => api.catalog.genres(), []);

  const rows = useMemo<Row[]>(() => {
    if (!searching) {
      return browse.items.map((release) => ({ kind: 'release', release, editionCount: 1 }));
    }
    return kind === 'releases'
      ? // Editions of the same album become one row (ADR-012).
        groupEditions(search.releases).map((entry) => ({ kind: 'release', ...entry }))
      : search.tracks.map((track) => ({ kind: 'track', track }));
  }, [searching, kind, browse.items, search.releases, search.tracks]);

  const loading = searching ? search.loading : browse.loading;
  const error = searching ? search.error : browse.error;
  const loadingMore = searching ? search.loadingMore : browse.loadingMore;
  const hasMore = searching ? search.hasMore : browse.hasMore;

  const header = (
    <View style={{ gap: space[3], marginBottom: space[3] }}>
      <Text variant="headline" accessibilityRole="header">
        Esplora
      </Text>
      <Field
        label="Cerca album, artisti, brani"
        value={query}
        onChangeText={setQuery}
        placeholder="es. OK Computer"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        hint={searching ? undefined : 'Cerchiamo anche su Deezer, iTunes e MusicBrainz.'}
      />
      {searching ? (
        <>
          <SegmentedControl
            label="Tipo di risultato"
            segments={SEGMENTS}
            value={kind}
            onChange={setKind}
          />
          {search.sources.length > 0 ? (
            <View
              style={styles.sources}
              accessible
              accessibilityLabel={`Fonti: ${search.sources.map(sourceLabel).join(', ')}`}
            >
              <Text variant="eyebrow">Fonti</Text>
              {search.sources.map((s) => (
                <Badge
                  key={s}
                  label={sourceLabel(s)}
                  mono
                  size="sm"
                  tone={s === 'LOCAL' ? 'accent' : 'neutral'}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <GenreRoulette onSearch={(text) => setQuery(text)} />
          {genres.data && genres.data.length > 0 ? (
            <GenreChips genres={genres.data} selected={genre} onSelect={setGenre} />
          ) : null}
          <Text variant="eyebrow">{genre ? `Più ascoltati · ${genre}` : 'Più ascoltati'}</Text>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) =>
          row.kind === 'release' ? `r-${row.release.id}` : `t-${row.track.id}`
        }
        contentContainerStyle={{ padding: space[4], paddingBottom: space[10] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={searching ? search.loadMore : browse.loadMore}
        refreshControl={
          searching ? undefined : (
            <RefreshControl
              refreshing={browse.refreshing}
              onRefresh={browse.reload}
              tintColor={colors.accent}
            />
          )
        }
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.kind === 'release' ? (
            <ReleaseResultRow release={item.release} editionCount={item.editionCount} />
          ) : (
            <TrackResultRow track={item.track} />
          )
        }
        ListEmptyComponent={
          loading ? (
            <View
              accessible
              accessibilityLabel={searching ? 'Ricerca in corso' : 'Caricamento del catalogo'}
              style={{ gap: space[3] }}
            >
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={64} />
              ))}
            </View>
          ) : error ? (
            <ErrorState
              title="Catalogo non raggiungibile"
              error={error}
              onRetry={searching ? search.retry : browse.reload}
            />
          ) : searching ? (
            <EmptyState
              title={kind === 'releases' ? 'Nessun disco trovato' : 'Nessun brano trovato'}
              description="Prova con un altro titolo o artista, o controlla l'ortografia."
              size="compact"
            />
          ) : (
            <EmptyState
              title="Il catalogo è vuoto"
              description="Cerca un artista: ogni ricerca aggiunge dischi."
              size="compact"
            />
          )
        }
        ListFooterComponent={
          rows.length === 0 ? undefined : loadingMore ? (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginTop: space[3] }}
              accessibilityLabel="Carico altri risultati"
            />
          ) : error ? (
            <ErrorState
              variant="inline"
              title="Non ho caricato altri risultati"
              error={error}
              onRetry={searching ? search.retry : browse.reload}
            />
          ) : hasMore ? (
            <Button
              label="Carica altri"
              variant="ghost"
              onPress={searching ? search.loadMore : browse.loadMore}
              style={{ marginTop: space[2] }}
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sources: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
});
