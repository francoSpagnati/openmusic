import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Disc, Play, ArrowClockwise, Sparkle, Compass } from 'phosphor-react-native';
import {
  THEME,
  type GenreRouletteResult,
  type CatalogTrack,
} from '@openmusic/shared';

interface GenreRouletteWheelProps {
  onSpin: () => Promise<GenreRouletteResult>;
  onSelectTrack?: (track: CatalogTrack) => void;
}

export const GenreRouletteWheel: React.FC<GenreRouletteWheelProps> = ({
  onSpin,
  onSelectTrack,
}) => {
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [result, setResult] = useState<GenreRouletteResult | null>(null);

  const rotation = useSharedValue(0);
  const resultScale = useSharedValue(0.9);

  const animatedVinylStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animatedResultStyle = useAnimatedStyle(() => ({
    transform: [{ scale: resultScale.value }],
    opacity: withTiming(result ? 1 : 0, { duration: 300 }),
  }));

  const handleSpin = useCallback(async () => {
    if (isSpinning) return;

    setIsSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Animazione di rotazione vinile a 60/120fps
    rotation.value = 0;
    rotation.value = withTiming(720 + Math.random() * 360, {
      duration: 1800,
      easing: Easing.out(Easing.cubic),
    });

    try {
      const res = await onSpin();
      // Piccolo delay per far sincronizzare l'atterraggio del disco con i risultati
      setTimeout(() => {
        setResult(res);
        setIsSpinning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        resultScale.value = withSpring(1, THEME.spring.snappy);
      }, 1600);
    } catch {
      setIsSpinning(false);
    }
  }, [isSpinning, onSpin, rotation, resultScale]);

  return (
    <View style={styles.container}>
      {/* Header Roulette */}
      <View style={styles.header}>
        <Compass size={20} color={THEME.colors.accentWarm} weight="duotone" />
        <Text style={styles.headerTitle}>Roulette Russa dei Generi</Text>
      </View>
      <Text style={styles.headerSubtitle}>
        Rompi la tua bolla algoritmica. Pesca un genere lontano dai tuoi ascolti abituali.
      </Text>

      {/* Disco Vinile Analogico Animato (Reanimated v3) */}
      <View style={styles.vinylContainer}>
        <Animated.View style={[styles.vinylRecord, animatedVinylStyle]}>
          <View style={styles.vinylGrooveOuter}>
            <View style={styles.vinylGrooveInner}>
              <View style={styles.vinylCenterLabel}>
                <Disc size={32} color={THEME.colors.accentWarm} weight="fill" />
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Pulsante Gira la Roulette */}
      <Pressable
        onPress={handleSpin}
        disabled={isSpinning}
        style={[styles.spinButton, isSpinning && styles.spinButtonDisabled]}
      >
        {isSpinning ? (
          <ActivityIndicator color={THEME.colors.bgPrimary} />
        ) : (
          <>
            <ArrowClockwise size={18} color={THEME.colors.bgPrimary} weight="bold" />
            <Text style={styles.spinButtonText}>
              {result ? 'Pesca un altro genere' : 'Gira la Roulette'}
            </Text>
          </>
        )}
      </Pressable>

      {/* Scheda Risultato (Out-of-the-bubble Starter Pack) */}
      {result && (
        <Animated.View style={[styles.resultCard, animatedResultStyle]}>
          <View style={styles.genreBadgeRow}>
            <Sparkle size={16} color={THEME.colors.accentWarm} weight="fill" />
            <Text style={styles.genreName}>{result.genre}</Text>
          </View>

          <Text style={styles.genreTagline}>{result.tagline}</Text>
          {result.context ? (
            <Text style={styles.genreContext}>{result.context}</Text>
          ) : null}

          {/* Starter Pack: 3 Brani Consigliati con Preview 30s */}
          <Text style={styles.starterTitle}>Brani Consigliati per Iniziare:</Text>
          <View style={styles.tracksList}>
            {result.starterTracks.map((track, i) => (
              <Pressable
                key={track.id || i}
                onPress={() => onSelectTrack?.(track)}
                style={styles.trackRow}
              >
                <View style={styles.trackPlayIcon}>
                  <Play size={14} color={THEME.colors.accentWarm} weight="fill" />
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitleText} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackArtistText} numberOfLines={1}>
                    {track.artistName}
                  </Text>
                </View>
                <Text style={styles.previewTag}>0:30 clip</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  vinylContainer: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylRecord: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#0D0D0F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  vinylGrooveOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: '#222226',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylGrooveInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: '#19191D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylCenterLabel: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.bgElevated,
    borderWidth: 2,
    borderColor: THEME.colors.accentWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.accentWarm,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  spinButtonDisabled: {
    opacity: 0.7,
  },
  spinButtonText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.bgPrimary,
  },
  resultCard: {
    marginTop: 22,
    backgroundColor: THEME.colors.bgInteractive,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: 16,
    width: '100%',
  },
  genreBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  genreName: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  genreTagline: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.accentWarm,
    fontWeight: '600',
    marginBottom: 6,
  },
  genreContext: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 14,
  },
  starterTitle: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tracksList: {
    gap: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  trackPlayIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${THEME.colors.accentWarm}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitleText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  trackArtistText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  previewTag: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
