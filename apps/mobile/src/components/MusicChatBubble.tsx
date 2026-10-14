import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Play,
  ArrowSquareOut,
  Fire,
  Heart,
  ThumbsDown,
  CheckCircle,
} from 'phosphor-react-native';
import {
  THEME,
  type ChatMessage,
  type ChatReactionType,
  type CatalogTrack,
} from '@openmusic/shared';

interface MusicChatBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  onPlayPreview?: (track: CatalogTrack) => void;
  onOpenExternal?: (url: string) => void;
  onReact?: (messageId: string, reaction: ChatReactionType | null) => void;
}

export const MusicChatBubble: React.FC<MusicChatBubbleProps> = ({
  message,
  isMine,
  onPlayPreview,
  onOpenExternal,
  onReact,
}) => {
  const { track, universalLinks, isListened, reaction, content } = message;

  const handlePlayPress = useCallback(() => {
    if (track) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPlayPreview?.(track);
    }
  }, [track, onPlayPreview]);

  const handleReactionPress = useCallback(
    (targetReaction: ChatReactionType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const nextReaction = reaction === targetReaction ? null : targetReaction;
      onReact?.(message.id, nextReaction);
    },
    [message.id, reaction, onReact]
  );

  const handleOpenLink = useCallback(() => {
    // Sceglie il miglior deep-link disponibile
    const targetUrl =
      universalLinks?.spotify ||
      universalLinks?.appleMusic ||
      universalLinks?.deezer ||
      universalLinks?.openmusic;

    if (targetUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onOpenExternal?.(targetUrl);
    }
  }, [universalLinks, onOpenExternal]);

  return (
    <View
      style={[
        styles.wrapper,
        isMine ? styles.wrapperMine : styles.wrapperFriend,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleFriend,
        ]}
      >
        {/* Testo opzionale del messaggio */}
        {content ? <Text style={styles.messageText}>{content}</Text> : null}

        {/* Card della canzone consigliata (ISRC Recommendation) */}
        {track && (
          <View style={styles.trackCard}>
            <View style={styles.trackRow}>
              {track.coverUrl ? (
                <Image source={{ uri: track.coverUrl }} style={styles.trackCover} />
              ) : (
                <View style={[styles.trackCover, styles.coverFallback]} />
              )}

              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  {track.artistName}
                </Text>

                {/* Badge Stato Ascolto */}
                <View style={styles.statusRow}>
                  {isListened ? (
                    <View style={styles.listenedBadge}>
                      <CheckCircle size={12} color={THEME.colors.accentFresh} weight="fill" />
                      <Text style={styles.listenedText}>Ascoltato</Text>
                    </View>
                  ) : (
                    <Text style={styles.pendingText}>Non ancora ascoltato</Text>
                  )}
                </View>
              </View>

              {/* Tasto Play Anteprima 30s */}
              {track.previewUrl && (
                <Pressable
                  onPress={handlePlayPress}
                  style={styles.playPreviewBtn}
                  accessibilityLabel="Ascolta anteprima 30 secondi"
                >
                  <Play size={16} color={THEME.colors.bgPrimary} weight="fill" />
                </Pressable>
              )}
            </View>

            {/* Traduzione Universale Link (ISRC) */}
            <Pressable onPress={handleOpenLink} style={styles.openExternalBtn}>
              <ArrowSquareOut size={14} color={THEME.colors.textPrimary} weight="bold" />
              <Text style={styles.openExternalText}>Apri nella tua app musicale</Text>
            </Pressable>
          </View>
        )}

        {/* Reazioni Rapide ("🔥", "❤️", "👎 Non fa per me") */}
        {track && (
          <View style={styles.reactionsBar}>
            <Pressable
              onPress={() => handleReactionPress('FIRE')}
              style={[
                styles.reactionPill,
                reaction === 'FIRE' && styles.reactionPillActive,
              ]}
              accessibilityLabel="Reazione Fuoco"
            >
              <Fire
                size={16}
                color={reaction === 'FIRE' ? THEME.colors.accentWarm : THEME.colors.textSecondary}
                weight={reaction === 'FIRE' ? 'fill' : 'regular'}
              />
            </Pressable>

            <Pressable
              onPress={() => handleReactionPress('HEART')}
              style={[
                styles.reactionPill,
                reaction === 'HEART' && styles.reactionPillActive,
              ]}
              accessibilityLabel="Reazione Cuore"
            >
              <Heart
                size={16}
                color={reaction === 'HEART' ? THEME.colors.accentRotten : THEME.colors.textSecondary}
                weight={reaction === 'HEART' ? 'fill' : 'regular'}
              />
            </Pressable>

            <Pressable
              onPress={() => handleReactionPress('NOT_FOR_ME')}
              style={[
                styles.reactionPill,
                reaction === 'NOT_FOR_ME' && styles.reactionPillActive,
              ]}
              accessibilityLabel="Reazione Non fa per me"
            >
              <ThumbsDown
                size={16}
                color={reaction === 'NOT_FOR_ME' ? THEME.colors.textPrimary : THEME.colors.textSecondary}
                weight={reaction === 'NOT_FOR_ME' ? 'fill' : 'regular'}
              />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    marginVertical: 6,
    flexDirection: 'row',
  },
  wrapperMine: {
    justifyContent: 'flex-end',
  },
  wrapperFriend: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: THEME.colors.bgElevated,
    borderColor: THEME.colors.borderSubtle,
  },
  bubbleFriend: {
    backgroundColor: THEME.colors.bgInteractive,
    borderColor: THEME.colors.borderSubtle,
  },
  messageText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    lineHeight: 19,
    marginBottom: 10,
  },
  trackCard: {
    backgroundColor: THEME.colors.bgPrimary,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackCover: {
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  coverFallback: {
    backgroundColor: THEME.colors.bgInteractive,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  artistName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  statusRow: {
    marginTop: 4,
  },
  listenedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listenedText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.accentFresh,
  },
  pendingText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  playPreviewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.accentWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openExternalBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.bgInteractive,
    paddingVertical: 7,
    borderRadius: 8,
  },
  openExternalText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  reactionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  reactionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: THEME.colors.bgPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  reactionPillActive: {
    borderColor: THEME.colors.accentWarm,
    backgroundColor: `${THEME.colors.accentWarm}20`,
  },
});
