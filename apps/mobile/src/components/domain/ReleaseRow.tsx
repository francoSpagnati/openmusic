import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { CatalogRelease } from '@openmusic/shared';
import { CoverArt, ScoreBadge, Text } from '../ui';

/** One catalog release in a list: cover, title, artist, year, audience score. */
export function ReleaseRow({ release }: { release: CatalogRelease }) {
  const year = release.releaseDate ? release.releaseDate.slice(0, 4) : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${release.title} di ${release.artistName}`}
      onPress={() => router.push(`/release/${release.id}`)}
      style={styles.row}
    >
      <CoverArt uri={release.coverUrl} size={64} />
      <View style={styles.text}>
        <Text variant="title" size="base" numberOfLines={1}>
          {release.title}
        </Text>
        <Text size="sm" tone="secondary" numberOfLines={1}>
          {release.artistName}
        </Text>
        <Text variant="eyebrow" numberOfLines={1}>
          {[release.releaseType, year, release.genres[0]].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <ScoreBadge
        kind="audience"
        size="sm"
        percentage={release.audienceCount > 0 ? (release.audienceFreshPct ?? null) : null}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
