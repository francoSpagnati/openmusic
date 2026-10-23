import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { CatalogRelease, CatalogTrack } from '@openmusic/shared';
import { Badge, CoverArt, ScoreBadge, Text } from '../../../components/ui';
import { formatDuration } from '../../../lib/format';
import { useTheme } from '../../../theme';
import { releaseMeta, sourceLabel, workTitle } from '../catalog';
import { EditionChip } from '../editions/EditionChip';
import { PreviewButton } from '../components/PreviewButton';

/**
 * A release in the search results / browse list, with where its cover came from. `editionCount`
 * > 1 (search folds editions of the same album, ADR-012) opens the album page instead.
 */
export function ReleaseResultRow({
  release,
  editionCount = 1,
}: {
  release: CatalogRelease;
  editionCount?: number;
}) {
  const { space } = useTheme();
  const title = workTitle(release);
  const groupId = release.group?.id;
  const folded = Boolean(groupId) && editionCount > 1;
  const editions = folded ? `, ${editionCount} edizioni` : '';
  const edition = release.editionLabel ? `, ${release.editionLabel}` : '';
  const source =
    release.coverSource && release.coverSource !== 'LOCAL'
      ? sourceLabel(release.coverSource)
      : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}${edition} di ${release.artistName}, ${releaseMeta(release)}${editions}`}
      accessibilityHint={folded ? "Apre l'album con tutte le edizioni" : 'Apre la pagina del disco'}
      onPress={() =>
        router.push(folded && groupId ? `/album/${groupId}` : `/release/${release.id}`)
      }
      style={({ pressed }) => [styles.row, { gap: space[3], opacity: pressed ? 0.7 : 1 }]}
    >
      <CoverArt key={release.coverUrl ?? 'none'} uri={release.coverUrl} size={64} />
      <View style={styles.text}>
        <Text variant="title" size="base" numberOfLines={1}>
          {title}
        </Text>
        <Text size="sm" tone="secondary" numberOfLines={1}>
          {release.artistName}
        </Text>
        {release.editionLabel || folded ? (
          <View style={styles.metaRow}>
            {release.editionLabel ? <EditionChip label={release.editionLabel} size="sm" /> : null}
            {folded ? (
              <Text variant="eyebrow" tone="secondary">
                {`${editionCount} edizioni`}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Text variant="eyebrow" numberOfLines={1} style={styles.shrink}>
            {[releaseMeta(release), release.genres[0]].filter(Boolean).join(' · ')}
          </Text>
          {source ? <Badge label={source} size="sm" variant="outline" /> : null}
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, minHeight: 56 },
  trackBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
