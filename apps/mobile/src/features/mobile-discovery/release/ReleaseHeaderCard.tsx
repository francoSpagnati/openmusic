import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { CatalogRelease, CatalogTrack } from '@openmusic/shared';
import { useTheme } from '../../../theme';
import { Badge, CoverArt, Text } from '../../../components/ui';
import { releaseMeta, sourceLabel, tintAlpha } from '../catalog';
import { PreviewButton } from '../components/PreviewButton';

export interface ReleaseHeaderCardProps {
  release: CatalogRelease;
  /** First track with something to preview (plays from the header). */
  previewTrack?: CatalogTrack | null;
}

/**
 * Release hero: the cover over a wash of its dominant colour (`release.dominantColor`, computed by
 * the API from the real cover) fading into the page, then type · year · label, title, artist,
 * genres and the database the cover came from.
 */
export function ReleaseHeaderCard({ release, previewTrack }: ReleaseHeaderCardProps) {
  const theme = useTheme();
  const { colors, space } = theme;
  const { width } = useWindowDimensions();
  const coverSize = Math.min(260, width - space[16] * 2);
  const alpha = tintAlpha(release.dominantColor, theme.name);
  const source = release.coverSource ? sourceLabel(release.coverSource) : null;

  return (
    <View style={[styles.wrap, { paddingTop: space[6], paddingBottom: space[4], gap: space[4] }]}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <LinearGradient id="tint" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={release.dominantColor} stopOpacity={alpha} />
            <Stop offset="0.7" stopColor={release.dominantColor} stopOpacity={alpha * 0.35} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tint)" />
      </Svg>

      <View style={styles.center}>
        <CoverArt
          key={release.coverUrl ?? 'none'}
          uri={release.coverUrl}
          size={coverSize}
          label={`Copertina di ${release.title}, ${release.artistName}`}
        />
      </View>

      <View style={[styles.meta, { paddingHorizontal: space[4] }]}>
        <Text variant="eyebrow">{releaseMeta(release)}</Text>
        <Text variant="display" accessibilityRole="header">
          {release.title}
        </Text>
        <View style={styles.artistRow}>
          <Text variant="deck" tone="secondary" style={styles.flex} numberOfLines={2}>
            {release.artistName}
          </Text>
          {previewTrack ? <PreviewButton track={previewTrack} size={56} caption /> : null}
        </View>
        <View style={styles.badges}>
          {release.genres.slice(0, 4).map((g) => (
            <Badge key={g} label={g} mono size="sm" />
          ))}
          {source ? <Badge label={`Copertina: ${source}`} size="sm" variant="outline" /> : null}
          {release.trackCount ? (
            <Badge label={`${release.trackCount} brani`} size="sm" variant="outline" mono />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  center: { alignItems: 'center' },
  meta: { gap: 6 },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
});
