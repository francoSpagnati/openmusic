import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'live' | 'online' | 'ghost' | 'offline';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** `live` draws a quiet, still green ring and dot: the user is listening right now. */
  status?: AvatarStatus;
  /** Hide from assistive tech when the name is already written next to it. */
  decorative?: boolean;
}

const dims: Record<AvatarSize, { box: number; text: number; dot: number }> = {
  xs: { box: 24, text: 10, dot: 8 },
  sm: { box: 32, text: 12, dot: 10 },
  md: { box: 40, text: 14, dot: 12 },
  lg: { box: 56, text: 18, dot: 14 },
  xl: { box: 80, text: 25, dot: 16 },
};

const statusLabel: Record<AvatarStatus, string> = {
  live: 'in ascolto ora',
  online: 'online',
  ghost: 'in Ghost Mode',
  offline: 'offline',
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export function Avatar({ name, src, size = 'md', status, decorative = false }: AvatarProps) {
  const { colors, font } = useTheme();
  const [failed, setFailed] = useState(false);
  const d = dims[size];
  const label = status ? `${name}, ${statusLabel[status]}` : name;
  const showImage = Boolean(src) && !failed;

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : label}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={{ width: d.box, height: d.box }}
    >
      <View
        style={[
          styles.circle,
          {
            width: d.box,
            height: d.box,
            borderRadius: d.box / 2,
            backgroundColor: colors.surface,
            borderColor: status === 'live' ? colors.fresh : colors.border,
            borderWidth: status === 'live' ? 2 : StyleSheet.hairlineWidth,
            opacity: status === 'ghost' ? 0.6 : 1,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: font.editorial,
            fontSize: d.text,
            lineHeight: d.text * 1.2,
            color: colors.textMuted,
          }}
        >
          {initials(name)}
        </Text>
        {showImage && src ? (
          <Image
            source={{ uri: src }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
            onError={() => setFailed(true)}
            accessible={false}
          />
        ) : null}
      </View>
      {status && status !== 'offline' ? (
        <View
          style={[
            styles.dot,
            {
              width: d.dot,
              height: d.dot,
              borderRadius: d.dot / 2,
              backgroundColor: status === 'ghost' ? colors.textSubtle : colors.fresh,
              borderColor: colors.bg,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
});
