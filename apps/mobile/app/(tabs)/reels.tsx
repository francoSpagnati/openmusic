import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { DiscoveryReelItem } from '@openmusic/shared';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useApiQuery } from '../../src/lib/useApiQuery';
import { useTheme } from '../../src/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Text,
  describeError,
} from '../../src/components/ui';
import { PreviewPlayerProvider } from '../../src/features/mobile-discovery/PreviewPlayer';
import { DiscoveryReelsFeed } from '../../src/features/mobile-discovery/reels/DiscoveryReelsFeed';
import {
  initialReelsState,
  reelsReducer,
} from '../../src/features/mobile-discovery/reels/reelsState';
import {
  REELS_PLAYLIST_TITLE,
  useReelsLibrary,
} from '../../src/features/mobile-discovery/reels/useReelsLibrary';
import { UndoToast } from '../../src/features/mobile-discovery/components/UndoToast';
import { haptics } from '../../src/features/mobile-discovery/haptics';

interface Toast {
  id: number;
  message: string;
  undo: boolean;
}

/**
 * Reels: vertical feed of 30s previews from `/api/discovery/reels` (FlashList, autoplay, N+1/N+2
 * pre-buffer). Save adds the track to the private "Scoperte dai Reels" playlist; "Non fa per me"
 * hides a reel with undo; "Indietro" goes back one reel.
 */
export default function ReelsScreen() {
  return (
    <PreviewPlayerProvider loop>
      <ReelsContent />
    </PreviewPlayerProvider>
  );
}

function ReelsContent() {
  const { colors, space } = useTheme();
  const { user } = useAuth();
  const reels = useApiQuery(() => api.discovery.reels(), []);
  const [state, dispatch] = useReducer(reelsReducer, initialReelsState);
  const library = useReelsLibrary(user?.id ?? null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [focusIndex, setFocusIndex] = useState<{ index: number; nonce: number } | null>(null);

  useEffect(() => {
    if (reels.data) dispatch({ type: 'load', items: reels.data.items });
  }, [reels.data]);

  const show = useCallback((message: string, undo = false) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message, undo }));
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const onSave = useCallback(
    (item: DiscoveryReelItem) => {
      if (item.isSaved || library.savedTrackIds.has(item.track.id)) {
        show(`Già in “${REELS_PLAYLIST_TITLE}”`);
        return;
      }
      haptics.tap();
      library
        .save(item.track.id)
        .then(() => {
          haptics.success();
          show(`Salvato in “${REELS_PLAYLIST_TITLE}”`);
        })
        .catch((err: unknown) => {
          haptics.error();
          show(`Non salvato: ${describeError(err)}`);
        });
    },
    [library, show]
  );

  const onHide = useCallback(
    (item: DiscoveryReelItem) => {
      dispatch({ type: 'hide', id: item.id });
      show(`Nascosto: ${item.track.title}`, true);
    },
    [show]
  );

  const undoHide = useCallback(() => {
    const last = state.hidden[state.hidden.length - 1];
    if (!last) return;
    haptics.thud();
    dispatch({ type: 'undoHide' });
    setFocusIndex((prev) => ({ index: last.index, nonce: (prev?.nonce ?? 0) + 1 }));
    setToast(null);
  }, [state.hidden]);

  if (reels.loading) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[
          styles.flex,
          styles.center,
          { backgroundColor: colors.bg, padding: space[6], gap: space[4] },
        ]}
      >
        <View accessible accessibilityLabel="Caricamento dei reels" style={styles.skeleton}>
          <Skeleton width={260} height={260} />
          <Skeleton width={200} height={28} />
          <Skeleton width={140} height={16} />
        </View>
      </SafeAreaView>
    );
  }
  if (reels.error) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg, padding: space[4] }]}>
        <ErrorState
          title="I reels non sono partiti"
          error={reels.error}
          onRetry={reels.reload}
          retrying={reels.refreshing}
        />
      </SafeAreaView>
    );
  }
  if (state.items.length === 0 && state.hidden.length === 0) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg, padding: space[4] }]}>
        <EmptyState
          title="Nessun brano da far girare"
          description="Il catalogo è ancora vuoto. Cerca un artista in Esplora: ogni ricerca aggiunge dischi."
          action={<Button label="Vai a Esplora" onPress={() => router.push('/explore')} />}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <DiscoveryReelsFeed
        items={state.items}
        savedTrackIds={library.savedTrackIds}
        onSave={onSave}
        onHide={onHide}
        focusIndex={focusIndex}
        footer={
          <View style={[styles.flex, styles.center, { padding: space[6], gap: space[3] }]}>
            <Text variant="eyebrow">Fine del lato B</Text>
            <Text variant="headline" style={styles.centerText}>
              Hai girato tutti i dischi di oggi
            </Text>
            <Text tone="secondary" style={styles.centerText}>
              Ricarica per un nuovo giro o cerca qualcosa in Esplora.
            </Text>
            <View style={[styles.row, { gap: space[2] }]}>
              <Button
                label="Ricarica"
                variant="secondary"
                onPress={() => void reels.reload()}
                loading={reels.refreshing}
              />
              <Button label="Esplora" onPress={() => router.push('/explore')} />
            </View>
          </View>
        }
      />
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[styles.toastWrap, { left: space[4], right: space[4] + 72, bottom: space[4] }]}
        >
          <UndoToast
            id={toast.id}
            message={toast.message}
            actionLabel={toast.undo ? 'Annulla' : undefined}
            onAction={toast.undo ? undoHide : undefined}
            onDismiss={dismissToast}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  row: { flexDirection: 'row' },
  skeleton: { alignItems: 'center', gap: 16 },
  toastWrap: { position: 'absolute' },
});
