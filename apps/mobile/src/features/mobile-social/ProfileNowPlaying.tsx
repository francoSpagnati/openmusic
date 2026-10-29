import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MusicProvider, NowPlayingTrack } from '@openmusic/shared';
import { useUserPresence } from '../../lib/socket';
import { formatDuration } from '../../lib/format';
import { useTheme } from '../../theme';
import { Badge, Card, CoverArt, Enter, Text } from '../../components/ui';
import { Headphones } from './icons';

const PROVIDER_LABEL: Record<MusicProvider, string> = {
  SPOTIFY: 'Spotify',
  APPLE_MUSIC: 'Apple Music',
  LASTFM: 'Last.fm',
  OS_MEDIA_SESSION: 'il telefono',
};

/** Where the playhead is now, extrapolated from the last update while the track is playing. */
export function estimatedProgressMs(track: NowPlayingTrack, now: number): number {
  const elapsed = track.isPlaying ? Math.max(0, now - track.updatedAt) : 0;
  return Math.min(track.durationMs, track.progressMs + elapsed);
}

/** Current time in ms, refreshed every second while `enabled` (a live progress bar). */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

/**
 * "In ascolto ora" on a profile: what the user plays right now, with a progress bar that moves
 * by itself between server updates. Hidden when nothing is playing, in Ghost Mode, or when the
 * viewer neither is nor follows the user (the API answers 404). The bar is not animated, so it
 * is the same under reduced motion.
 */
export function ProfileNowPlaying({ userId, name }: { userId: string; name: string }) {
  const presence = useUserPresence(userId);
  const track = presence?.currentlyPlaying;
  if (!presence || presence.isGhostMode || !track) return null;
  return <NowPlayingCard track={track} name={name} />;
}

function NowPlayingCard({ track, name }: { track: NowPlayingTrack; name: string }) {
  const { colors, radii } = useTheme();
  const now = useNow(track.isPlaying);
  const progress = estimatedProgressMs(track, now);
  const hasDuration = track.durationMs > 0;
  const percent = hasDuration ? Math.min(100, (progress / track.durationMs) * 100) : 0;
  const provider = PROVIDER_LABEL[track.provider];

  return (
    <Enter kind="fade">
      <Card variant="sleeve" padding="sm" style={styles.card}>
        <CoverArt uri={track.coverUrl ?? null} size={72} />
        <View style={styles.body}>
          <View style={styles.head}>
            <Headphones size={14} color={colors.textMuted} />
            <Text variant="eyebrow" size="xs" tone="secondary" accessibilityRole="header">
              In ascolto ora
            </Text>
            {!track.isPlaying ? <Badge label="In pausa" size="sm" /> : null}
          </View>
          <Text variant="bodyStrong" numberOfLines={1}>
            {track.title}
          </Text>
          <Text size="sm" tone="secondary" numberOfLines={1}>
            {track.albumTitle ? `${track.artistName} · ${track.albumTitle}` : track.artistName}
          </Text>

          {/* Last.fm "now playing" has no duration (0): no progress bar to draw. */}
          {hasDuration ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Punto di ascolto di ${name}`}
              accessibilityValue={{
                min: 0,
                max: Math.round(track.durationMs / 1000),
                now: Math.round(progress / 1000),
                text: `${formatDuration(progress)} di ${formatDuration(track.durationMs)}`,
              }}
              style={styles.progress}
            >
              <View
                style={[
                  styles.track,
                  { backgroundColor: colors.sunken, borderRadius: radii.pill },
                ]}
              >
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${percent}%`,
                      backgroundColor: colors.textMuted,
                      borderRadius: radii.pill,
                    },
                  ]}
                />
              </View>
              <View style={styles.times}>
                <Text variant="mono" size="xs" tone="muted">
                  {formatDuration(progress)}
                </Text>
                <Text size="xs" tone="muted">
                  {provider}
                </Text>
                <Text variant="mono" size="xs" tone="muted">
                  {formatDuration(track.durationMs)}
                </Text>
              </View>
            </View>
          ) : (
            <Text size="xs" tone="muted" style={styles.progress}>
              Via {provider}
            </Text>
          )}
        </View>
      </Card>
    </Enter>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progress: { marginTop: 8, gap: 6 },
  track: { height: 4, overflow: 'hidden' },
  fill: { height: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
