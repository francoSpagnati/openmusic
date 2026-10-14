import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Disc,
  Play,
  ShareNetwork,
  Plus,
  Clock,
} from 'phosphor-react-native';
import {
  THEME,
  type PlaylistDetails,
  type PlaylistSide,
  type CatalogTrack,
} from '@openmusic/shared';

interface ThemedPlaylistViewProps {
  playlist: PlaylistDetails;
  onPlayTrack?: (track: CatalogTrack) => void;
  onExport?: () => void;
  onAddTrack?: (side: PlaylistSide) => void;
}

export const ThemedPlaylistView: React.FC<ThemedPlaylistViewProps> = ({
  playlist,
  onPlayTrack,
  onExport,
  onAddTrack,
}) => {
  const [selectedSide, setSelectedSide] = useState<PlaylistSide>('A');
  const sideIndicatorPos = useSharedValue(0);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sideIndicatorPos.value }],
  }));

  const handleSideChange = useCallback(
    (side: PlaylistSide) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedSide(side);
      sideIndicatorPos.value = withSpring(side === 'A' ? 0 : 130, THEME.spring.snappy);
    },
    [sideIndicatorPos]
  );

  const currentTracks = selectedSide === 'A' ? playlist.sideATracks : playlist.sideBTracks;
  const totalMinutes = Math.round(playlist.totalDurationMs / 60000);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Playlist Vinilica */}
      <View style={styles.headerCard}>
        <View style={styles.vinylIconWrapper}>
          <Disc size={48} color={THEME.colors.accentWarm} weight="duotone" />
        </View>

        <Text style={styles.playlistTitle}>{playlist.title}</Text>
        <Text style={styles.authorText}>Curata da @{playlist.user.username}</Text>

        {playlist.description ? (
          <Text style={styles.descriptionText}>{playlist.description}</Text>
        ) : null}

        {/* Metadati tabulari di durata */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock size={14} color={THEME.colors.textMuted} />
            <Text style={styles.metaText}>{totalMinutes} min totali</Text>
          </View>
          <Text style={styles.metaDivider}>•</Text>
          <Text style={styles.metaText}>
            {playlist.sideATracks.length + playlist.sideBTracks.length} tracce
          </Text>
        </View>

        {/* Pulsante Esporta Playlist (ISRC Export) */}
        {onExport && (
          <Pressable onPress={onExport} style={styles.exportButton}>
            <ShareNetwork size={16} color={THEME.colors.textPrimary} weight="bold" />
            <Text style={styles.exportButtonText}>
              Esporta su Spotify / Apple Music (ISRC)
            </Text>
          </Pressable>
        )}
      </View>

      {/* Switcher Vinilico: Lato A / Lato B */}
      <View style={styles.sideSwitcherContainer}>
        <View style={styles.sideSwitcher}>
          <Animated.View style={[styles.activeIndicator, animatedIndicatorStyle]} />
          <Pressable
            onPress={() => handleSideChange('A')}
            style={styles.sideTab}
            accessibilityLabel="Seleziona Lato A"
          >
            <Text
              style={[
                styles.sideTabText,
                selectedSide === 'A' && styles.sideTabTextActive,
              ]}
            >
              Lato A ({playlist.sideATracks.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSideChange('B')}
            style={styles.sideTab}
            accessibilityLabel="Seleziona Lato B"
          >
            <Text
              style={[
                styles.sideTabText,
                selectedSide === 'B' && styles.sideTabTextActive,
              ]}
            >
              Lato B ({playlist.sideBTracks.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Lista Tracce del Lato Selezionato */}
      <View style={styles.trackListContainer}>
        {currentTracks.length === 0 ? (
          <View style={styles.emptySide}>
            <Text style={styles.emptySideText}>
              Nessun brano sul Lato {selectedSide}.
            </Text>
          </View>
        ) : (
          currentTracks.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => onPlayTrack?.(item.track)}
              style={styles.trackRow}
            >
              <Text style={styles.trackIndex}>
                {selectedSide}
                {index + 1}
              </Text>
              <View style={styles.trackDetails}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {item.track.title}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  {item.track.artistName}
                </Text>
              </View>

              <View style={styles.trackTrailing}>
                <Text style={styles.trackDuration}>
                  {Math.floor(item.track.durationMs / 60000)}:
                  {String(Math.floor((item.track.durationMs % 60000) / 1000)).padStart(2, '0')}
                </Text>
                <Play size={14} color={THEME.colors.accentWarm} weight="fill" />
              </View>
            </Pressable>
          ))
        )}

        {/* Tasto Aggiungi Traccia al Lato Corrente */}
        {onAddTrack && (
          <Pressable
            onPress={() => onAddTrack(selectedSide)}
            style={styles.addTrackBtn}
          >
            <Plus size={16} color={THEME.colors.textSecondary} weight="bold" />
            <Text style={styles.addTrackText}>Aggiungi brano al Lato {selectedSide}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgPrimary,
  },
  headerCard: {
    backgroundColor: THEME.colors.bgElevated,
    margin: 16,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  vinylIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.bgInteractive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  playlistTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  authorText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  descriptionText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  metaDivider: {
    color: THEME.colors.textMuted,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.bgInteractive,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  exportButtonText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  sideSwitcherContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sideSwitcher: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    width: 268,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 130,
    height: '100%',
    backgroundColor: THEME.colors.bgInteractive,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.accentWarm,
  },
  sideTab: {
    width: 130,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sideTabText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  sideTabTextActive: {
    color: THEME.colors.accentWarm,
  },
  trackListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  emptySide: {
    padding: 24,
    alignItems: 'center',
  },
  emptySideText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  trackIndex: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.accentWarm,
    width: 32,
    fontVariant: ['tabular-nums'],
  },
  trackDetails: {
    flex: 1,
  },
  trackTitle: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  artistName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  trackTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackDuration: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  addTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addTrackText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
});
