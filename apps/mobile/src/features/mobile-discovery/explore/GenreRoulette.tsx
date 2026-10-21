import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { GenreRouletteResult } from '@openmusic/shared';
import { api } from '../../../lib/api';
import { useTheme, withAlpha } from '../../../theme';
import { Button, Card, ErrorState, Text } from '../../../components/ui';
import { Disc } from '../../../components/icons';
import { MagnifyingGlass, Shuffle } from '../icons';
import { haptics } from '../haptics';
import { PreviewButton } from '../components/PreviewButton';

export interface GenreRouletteProps {
  /** Search the catalog for a starter track ("Artist Title"). */
  onSearch: (query: string) => void;
  /** Injected in tests. */
  spin?: () => Promise<GenreRouletteResult>;
}

type RouletteState =
  | { status: 'idle' }
  | { status: 'spinning'; previous: GenreRouletteResult | null }
  | { status: 'done'; result: GenreRouletteResult }
  | { status: 'error'; error: unknown; previous: GenreRouletteResult | null };

/**
 * "Roulette dei generi" (out of the bubble): `GET /api/discovery/roulette` picks a curated genre
 * the listener has not scrobbled yet and three starter tracks with 30s previews. The disc spins
 * while the API answers and lands with a haptic thud.
 */
export function GenreRoulette({
  onSearch,
  spin = () => api.discovery.roulette(),
}: GenreRouletteProps) {
  const { colors, space, radii } = useTheme();
  const [state, setState] = useState<RouletteState>({ status: 'idle' });
  const rotation = useSharedValue(0);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  const discStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const current =
    state.status === 'done' ? state.result : state.status === 'idle' ? null : state.previous;

  const onSpin = useCallback(async () => {
    haptics.tap();
    setState({ status: 'spinning', previous: current });
    rotation.value = withRepeat(
      withTiming(rotation.value + 360, { duration: 700, easing: Easing.linear }),
      -1
    );
    try {
      const result = await spin();
      if (!mounted.current) return;
      cancelAnimation(rotation);
      rotation.value = withTiming(Math.ceil(rotation.value / 360) * 360 + 540, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      });
      haptics.thud();
      setState({ status: 'done', result });
    } catch (error) {
      if (!mounted.current) return;
      cancelAnimation(rotation);
      haptics.error();
      setState({ status: 'error', error, previous: current });
    }
  }, [current, rotation, spin]);

  const spinning = state.status === 'spinning';

  return (
    <Card variant="sleeve" padding="md" style={{ gap: space[3] }}>
      <View style={[styles.head, { gap: space[3] }]}>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.disc,
            { backgroundColor: withAlpha(colors.accent, 0.12), borderRadius: radii.pill },
            discStyle,
          ]}
        >
          <Disc size={40} color={colors.accent} weight="duotone" />
        </Animated.View>
        <View style={styles.flex}>
          <Text variant="eyebrow">Roulette dei generi</Text>
          <Text variant="title" accessibilityRole="header">
            {current ? current.genre : 'Esci dalla tua bolla'}
          </Text>
          <Text size="sm" tone="secondary">
            {current ? current.tagline : 'Un genere che non ascolti mai, tre brani per iniziare.'}
          </Text>
        </View>
      </View>

      {current?.context ? (
        <Text size="sm" tone="secondary">
          {current.context}
        </Text>
      ) : null}

      {current
        ? current.starterTracks.map((track) => (
            <View key={track.id} style={[styles.track, { gap: space[3] }]}>
              <PreviewButton track={track} size={44} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" size="sm" numberOfLines={1}>
                  {track.title}
                </Text>
                <Text size="sm" tone="secondary" numberOfLines={1}>
                  {track.artistName}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cerca ${track.title} di ${track.artistName} nel catalogo`}
                hitSlop={8}
                onPress={() => {
                  haptics.select();
                  onSearch(`${track.artistName} ${track.title}`);
                }}
                style={styles.searchBtn}
              >
                <MagnifyingGlass size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))
        : null}

      {state.status === 'error' ? (
        <ErrorState
          variant="inline"
          title="La roulette si è inceppata"
          error={state.error}
          onRetry={() => void onSpin()}
        />
      ) : null}

      <Button
        label={spinning ? 'Gira…' : current ? 'Gira ancora' : 'Gira la roulette'}
        loading={spinning}
        leadingIcon={<Shuffle size={18} color={colors.onAccent} weight="bold" />}
        onPress={() => void onSpin()}
        fullWidth
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  disc: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  track: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  searchBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
