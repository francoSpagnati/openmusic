import React, { useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, StatusBar } from 'react-native';
import { THEME, type FriendPresence } from '@openmusic/shared';
import { LiveFriendsBar } from './src/components/LiveFriendsBar';
import { useNowPlayingSocket } from './src/hooks/useNowPlayingSocket';

export default function App() {
  const [selectedFriend, setSelectedFriend] = useState<FriendPresence | null>(null);

  // Per lo sviluppo locale: puntiamo all'API Fastify su porta 4000
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
  const mockUserId = '11111111-2222-3333-4444-555555555555';

  const {
    friends,
    isGhostMode,
    isConnected,
    toggleGhostMode,
  } = useNowPlayingSocket({
    serverUrl: API_URL,
    userId: mockUserId,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.bgPrimary} />

      {/* Header Editoriale */}
      <View style={styles.header}>
        <Text style={styles.logoText}>OpenMusic</Text>
        <View style={styles.connectionBadge}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: isConnected ? THEME.colors.accentFresh : THEME.colors.accentRotten },
            ]}
          />
          <Text style={styles.connectionLabel}>
            {isConnected ? 'Real-Time' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Live Friends Bar con Phosphor Icons + Reanimated + Haptics */}
      <LiveFriendsBar
        friends={friends}
        isMyGhostModeActive={isGhostMode}
        onToggleGhostMode={toggleGhostMode}
        onPressFriendTrack={(friend) => setSelectedFriend(friend)}
      />

      {/* Main Container / Feed Placeholder */}
      <View style={styles.content}>
        {selectedFriend?.currentlyPlaying ? (
          <View style={styles.nowPlayingCard}>
            <Text style={styles.cardHeader}>Ascolto Selezionato</Text>
            <Text style={styles.trackTitle}>{selectedFriend.currentlyPlaying.title}</Text>
            <Text style={styles.artistName}>{selectedFriend.currentlyPlaying.artistName}</Text>
            <Text style={styles.providerBadge}>
              Riproduzione da {selectedFriend.currentlyPlaying.provider}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nessuna canzone selezionata</Text>
            <Text style={styles.emptySubtitle}>
              Tocca un amico nella barra superiore per visualizzarne i dettagli o ascoltare la preview da 30s.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  logoText: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionLabel: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  nowPlayingCard: {
    backgroundColor: THEME.colors.bgElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  cardHeader: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trackTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  artistName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 15,
    color: THEME.colors.accentWarm,
    textAlign: 'center',
    marginBottom: 12,
  },
  providerBadge: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
