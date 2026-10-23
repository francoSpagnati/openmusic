import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Disc } from '../icons';
import { useTheme } from '../../theme';

export interface CoverArtProps {
  /** Cover URL from the catalog (`CatalogRelease.coverUrl`). Null shows the vinyl placeholder. */
  uri: string | null | undefined;
  /** Accessible description, e.g. "Copertina di OK Computer, Radiohead". Omit if decorative. */
  label?: string;
  /** Edge length in px (covers are square). Omit and pass a width in `style` to fill a cell. */
  size?: number;
  rounded?: 'sleeve' | 'none';
  style?: StyleProp<ViewStyle>;
}

/**
 * Square album cover via expo-image (memory+disk cache, fade-in). Falls back to a grooved-disc
 * placeholder when there is no URL or the image fails to load (e.g. offline CDN).
 */
export function CoverArt({ uri, label, size, rounded = 'sleeve', style }: CoverArtProps) {
  const { colors, radii } = useTheme();
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;
  const radius = rounded === 'sleeve' ? radii.sleeve : 0;
  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      style={[
        styles.box,
        size !== undefined ? { width: size, height: size } : styles.fill,
        { borderRadius: radius, backgroundColor: colors.sunken, borderColor: colors.border },
        style,
      ]}
    >
      {showImage && uri ? (
        <Image
          testID="cover-image"
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : (
        <View testID="cover-placeholder">
          <Disc size={Math.max(20, (size ?? 96) * 0.36)} color={colors.textSubtle} weight="light" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: { width: '100%', aspectRatio: 1 },
});
