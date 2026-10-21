import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { CatalogRelease, CatalogTrack } from '@openmusic/shared';
import { Badge, CoverArt, ScoreBadge, Text } from '../../../components/ui';
import { formatDuration } from '../../../lib/format';
import { useTheme } from '../../../theme';
import { releaseMeta, sourceLabel } from '../catalog';
import { PreviewButton } from '../components/PreviewButton';

/** A release in the search results / browse list, with where its cover came from. */
export function ReleaseResultRow({ release }: { release: CatalogRelease }) {
  const { space } = useTheme();
  const source =
    release.coverSource && release.coverSource !== 'LOCAL'
      ? sourceLabel(release.coverSource)
      : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${release.title} di ${release.artistName}, ${releaseMeta(release)}`}
      accessibilityHint="Apre la pagina del disco"
      onPress={() => router.push(`/release/${release.id}`)}
      style={({ pressed }) => [styles.row, { gap: space[3], opacity: pressed ? 0.7 : 1 }]}
    >
      <CoverArt key={release.coverUrl ?? 'none'} uri={release.coverUrl} size={64} />
      <View style={styles.text}>
        <Text variant="title" size="base" numberOfLines={1}>
          {release.title}
        </Text>
        <Text size="sm" tone="secondary" numberOfLines={1}>
          {release.artistName}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="eyebrow" numberOfLines={1} style={styles.shrink}>
            {[releaseMeta(release), release.genres[0]].filter(Boolean).join(' · ')}
          </Text>
          {source ? <Badge label={source} size="sm" mono variant="outline" /> : null}
        </View>
      </View>
      <ScoreBadge
        kind="audience"
        size="sm"
        percentage={release.audienceCount > 0 ? (release.audienceFreshPct ?? null) : null}
      />
    </Pressable>
  );
}

/** A track in the search results: cover, preview button and a link to its release. */
export function TrackResultRow({ track }: { track: CatalogTrack }) {
  const { space } = useTheme();
  const releaseId = track.releaseId;
  return (
    <View style={[styles.row, { gap: space[3] }]}>
      <PreviewButton track={track} size={44} />
      <Pressable
        accessibilityRole={releaseId ? 'link' : 'text'}
        accessibilityLabel={`${track.title} di ${track.artistName}, ${formatDuration(track.durationMs)}`}
        accessibilityHint={releaseId ? 'Apre il disco che contiene il brano' : undefined}
        disabled={!releaseId}
        onPress={() => releaseId && router.push(`/release/${releaseId}`)}
        style={({ pressed }) => [styles.trackBody, { gap: space[3], opacity: pressed ? 0.7 : 1 }]}
      >
        <CoverArt key={track.coverUrl ?? 'none'} uri={track.coverUrl} size={48} />
        <View style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {track.title}
          </Text>
          <Text size="sm" tone="secondary" numberOfLines={1}>
            {track.artistName}
          </Text>
        </View>
        <Text variant="mono" size="xs" tone="muted">
          {formatDuration(track.durationMs)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, minHeight: 56 },
  trackBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
