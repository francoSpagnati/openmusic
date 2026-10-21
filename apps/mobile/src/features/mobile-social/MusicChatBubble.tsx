import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { ChatMessage, ChatReactionType, UniversalTrackLinks } from '@openmusic/shared';
import { Heart, ThumbsDown } from '../../components/icons';
import { useTheme, withAlpha } from '../../theme';
import { CoverArt, Text } from '../../components/ui';
import { formatDuration, formatRelative } from '../../lib/format';
import { ArrowSquareOut, CheckCircle, Checks, Fire } from './icons';
import { haptics } from './haptics';

export interface MusicChatBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  /** Receiver only (the API rejects reactions from the sender). */
  onReact?: (message: ChatMessage, reaction: ChatReactionType | null) => void;
  /** Receiver only. */
  onMarkListened?: (message: ChatMessage) => void;
  /** Animate in (new live messages); history renders without animation. */
  animateIn?: boolean;
}

const REACTIONS: { type: ChatReactionType; label: string }[] = [
  { type: 'FIRE', label: 'Fuoco' },
  { type: 'HEART', label: 'Cuore' },
  { type: 'NOT_FOR_ME', label: 'Non fa per me' },
];

/** Best deep link for the shared track: the streaming apps first, OpenMusic as fallback. */
export function bestTrackLink(links: UniversalTrackLinks | null | undefined): string | null {
  if (!links) return null;
  return links.spotify ?? links.appleMusic ?? links.deezer ?? links.openmusic ?? null;
}

function ReactionIcon({
  type,
  active,
  color,
}: {
  type: ChatReactionType;
  active: boolean;
  color: string;
}) {
  const weight = active ? 'fill' : 'regular';
  if (type === 'FIRE') return <Fire size={16} color={color} weight={weight} />;
  if (type === 'HEART') return <Heart size={16} color={color} weight={weight} />;
  return <ThumbsDown size={16} color={color} weight={weight} />;
}

/**
 * Chat bubble with an optional shared track (cover, duration, "ascoltato" state, deep link via the
 * ISRC-based universal links) and quick reactions. The receiver can react and mark the track as
 * listened; the sender sees both read-only.
 */
export function MusicChatBubble({
  message,
  isMine,
  onReact,
  onMarkListened,
  animateIn = false,
}: MusicChatBubbleProps) {
  const { colors, radii } = useTheme();
  const { track, content, reaction, isListened } = message;
  const link = bestTrackLink(message.universalLinks);
  const fg = isMine ? 'onAccent' : 'primary';
  const subtle = isMine ? 'onAccent' : 'muted';
  const canInteract = !isMine;

  const time = formatRelative(message.createdAt);
  const a11y = [
    isMine ? 'Tu' : 'Messaggio ricevuto',
    content ?? null,
    track ? `brano ${track.title} di ${track.artistName}${isListened ? ', ascoltato' : ''}` : null,
    reaction ? `reazione ${REACTIONS.find((r) => r.type === reaction)?.label ?? ''}` : null,
    time,
    isMine && message.readAt ? 'letto' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Animated.View
      entering={animateIn ? FadeInUp.springify().damping(18) : undefined}
      style={[styles.wrapper, { justifyContent: isMine ? 'flex-end' : 'flex-start' }]}
    >
      <View
        accessible={!track}
        accessibilityLabel={!track ? a11y : undefined}
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? colors.accent : colors.surface,
            borderColor: isMine ? colors.accent : colors.border,
            borderRadius: radii.lg,
            borderBottomRightRadius: isMine ? radii.sm : radii.lg,
            borderBottomLeftRadius: isMine ? radii.lg : radii.sm,
          },
        ]}
      >
        {track ? (
          <View
            accessible
            accessibilityLabel={a11y}
            style={[
              styles.track,
              {
                backgroundColor: isMine ? withAlpha(colors.bg, 0.18) : colors.sunken,
                borderRadius: radii.md,
              },
            ]}
          >
            <View style={styles.trackRow}>
              <CoverArt uri={track.coverUrl ?? null} size={52} />
              <View style={styles.flex}>
                <Text variant="title" size="sm" tone={fg} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text size="xs" tone={isMine ? 'onAccent' : 'secondary'} numberOfLines={1}>
                  {track.artistName} · {formatDuration(track.durationMs)}
                </Text>
                {isListened ? (
                  <View style={styles.inline}>
                    <CheckCircle
                      size={12}
                      color={isMine ? colors.onAccent : colors.fresh}
                      weight="fill"
                    />
                    <Text size="xs" tone={isMine ? 'onAccent' : 'fresh'}>
                      Ascoltato
                    </Text>
                  </View>
                ) : (
                  <Text size="xs" tone={subtle}>
                    Non ancora ascoltato
                  </Text>
                )}
              </View>
            </View>
          </View>
        ) : null}

        {track ? (
          <View style={styles.trackActions}>
            {link ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Apri ${track.title} nella tua app musicale`}
                onPress={() => {
                  haptics.tap();
                  void Linking.openURL(link).catch(() => undefined);
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: isMine ? colors.onAccent : colors.border,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <ArrowSquareOut
                  size={14}
                  color={isMine ? colors.onAccent : colors.text}
                  weight="bold"
                />
                <Text size="xs" variant="bodyStrong" tone={fg}>
                  Apri
                </Text>
              </Pressable>
            ) : null}
            {track.releaseId ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Apri il disco"
                onPress={() => router.push(`/release/${track.releaseId}`)}
                style={[
                  styles.chip,
                  {
                    borderColor: isMine ? colors.onAccent : colors.border,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <Text size="xs" variant="bodyStrong" tone={fg}>
                  Disco
                </Text>
              </Pressable>
            ) : null}
            {canInteract && !isListened && onMarkListened ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Segna come ascoltato"
                onPress={() => {
                  haptics.success();
                  onMarkListened(message);
                }}
                style={[styles.chip, { borderColor: colors.fresh, borderRadius: radii.pill }]}
              >
                <CheckCircle size={14} color={colors.fresh} />
                <Text size="xs" variant="bodyStrong" tone="fresh">
                  Ascoltato
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {content ? <Text tone={fg}>{content}</Text> : null}

        <View style={styles.meta}>
          <Text variant="mono" size="xs" tone={subtle}>
            {time}
          </Text>
          {isMine ? (
            <Checks
              size={14}
              color={colors.onAccent}
              weight={message.readAt ? 'bold' : 'regular'}
            />
          ) : null}
        </View>

        {track && (canInteract || reaction) ? (
          <View style={styles.reactions} accessibilityRole={canInteract ? 'radiogroup' : undefined}>
            {REACTIONS.filter((r) => canInteract || r.type === reaction).map((r) => {
              const active = reaction === r.type;
              const color = active
                ? colors.accent
                : isMine
                  ? colors.onAccent
                  : colors.textSecondary;
              return (
                <Pressable
                  key={r.type}
                  disabled={!canInteract || !onReact}
                  accessibilityRole={canInteract ? 'radio' : undefined}
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Reazione ${r.label}`}
                  onPress={() => {
                    haptics.tap();
                    onReact?.(message, active ? null : r.type);
                  }}
                  hitSlop={4}
                  style={[
                    styles.reaction,
                    {
                      borderRadius: radii.pill,
                      borderColor: active
                        ? colors.accent
                        : isMine
                          ? colors.onAccent
                          : colors.border,
                      backgroundColor: active ? withAlpha(colors.accent, 0.16) : 'transparent',
                    },
                  ]}
                >
                  <ReactionIcon type={r.type} active={active} color={color} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', marginVertical: 3 },
  bubble: { maxWidth: '84%', paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderWidth: 1 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  track: { padding: 8 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    minHeight: 32,
  },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  reactions: { flexDirection: 'row', gap: 6, alignSelf: 'flex-end' },
  reaction: {
    borderWidth: 1,
    minWidth: 40,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
