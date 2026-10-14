import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Star, CheckCircle, X, FloppyDisk } from 'phosphor-react-native';
import { THEME, type CreateReviewInput } from '@openmusic/shared';

interface ReviewComposerProps {
  releaseId?: string;
  trackId?: string;
  itemTitle: string;
  artistName: string;
  isVerifiedListen: boolean;
  initialRating?: number; // 10..100
  initialContent?: string;
  initialVibes?: string[];
  onSubmit: (review: CreateReviewInput) => void;
  onClose: () => void;
}

const AVAILABLE_VIBE_TAGS = [
  'Notturno',
  'Energico',
  'Malinconico',
  'Sperimentale',
  'Rilassante',
  'Capolavoro',
  'Da Viaggio',
  'Grezzo / Lo-Fi',
];

export const ReviewComposer: React.FC<ReviewComposerProps> = ({
  releaseId,
  trackId,
  itemTitle,
  artistName,
  isVerifiedListen,
  initialRating = 70, // 3.5 stelle di default
  initialContent = '',
  initialVibes = [],
  onSubmit,
  onClose,
}) => {
  const [rating, setRating] = useState<number>(initialRating); // salvato 10..100
  const [content, setContent] = useState<string>(initialContent);
  const [selectedVibes, setSelectedVibes] = useState<string[]>(initialVibes);

  // Calcola le stelle correnti in scala 0.5 - 5.0
  const starsValue = rating / 20;

  const handleStarSelect = useCallback((targetStars: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRating(Math.round(targetStars * 20));
  }, []);

  const handleToggleVibe = useCallback((vibe: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedVibes((prev) => {
      if (prev.includes(vibe)) {
        return prev.filter((v) => v !== vibe);
      }
      if (prev.length >= 5) return prev; // Massimo 5 tag
      return [...prev, vibe];
    });
  }, []);

  const handleSubmit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSubmit({
      releaseId,
      trackId,
      rating,
      content: content.trim() || undefined,
      vibeTags: selectedVibes,
    });
  }, [releaseId, trackId, rating, content, selectedVibes, onSubmit]);

  return (
    <View style={styles.container}>
      {/* Intestazione del Modale / Composer */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.title} numberOfLines={1}>
            {itemTitle}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {artistName}
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Chiudi">
          <X size={20} color={THEME.colors.textSecondary} weight="bold" />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Euristica #1 di Nielsen: Badge Ascolto Verificato (ADR-004) */}
        {isVerifiedListen && (
          <View style={styles.verifiedBadge}>
            <CheckCircle size={14} color={THEME.colors.accentFresh} weight="fill" />
            <Text style={styles.verifiedText}>Ascolto Verificato tramite Scrobble</Text>
          </View>
        )}

        {/* Selettore Voto con Stelline (Scala 0.5..5.0, salvato 10..100) */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionLabel}>Il tuo voto</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((starIdx) => {
              const isFull = starsValue >= starIdx;
              const isHalf = starsValue >= starIdx - 0.5 && starsValue < starIdx;

              return (
                <Pressable
                  key={starIdx}
                  onPress={() => {
                    // Tap sulla stella: alterna tra mezza stella e stella intera
                    if (starsValue === starIdx) {
                      handleStarSelect(starIdx - 0.5);
                    } else {
                      handleStarSelect(starIdx);
                    }
                  }}
                  style={styles.starPressable}
                  accessibilityLabel={`${starIdx} stelle`}
                >
                  <Star
                    size={28}
                    color={
                      isFull || isHalf ? THEME.colors.accentWarm : THEME.colors.borderSubtle
                    }
                    weight={isFull ? 'fill' : isHalf ? 'duotone' : 'regular'}
                  />
                </Pressable>
              );
            })}
            <Text style={styles.numericRating}>
              {starsValue.toFixed(1)} <Text style={styles.numericRatingMax}>★</Text>
            </Text>
          </View>
        </View>

        {/* Selettore Vibe Tags */}
        <View style={styles.vibesSection}>
          <Text style={styles.sectionLabel}>Tag Atmosfera (Max 5)</Text>
          <View style={styles.vibesContainer}>
            {AVAILABLE_VIBE_TAGS.map((tag) => {
              const isSelected = selectedVibes.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => handleToggleVibe(tag)}
                  style={[
                    styles.vibeChip,
                    isSelected && styles.vibeChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.vibeChipText,
                      isSelected && styles.vibeChipTextSelected,
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Input Recensione Testuale */}
        <View style={styles.inputSection}>
          <View style={styles.inputHeader}>
            <Text style={styles.sectionLabel}>Recensione (Opzionale)</Text>
            {/* Euristica #5 di Nielsen: Salvataggio automatico visivo */}
            <View style={styles.autoSaveIndicator}>
              <FloppyDisk size={12} color={THEME.colors.textMuted} weight="duotone" />
              <Text style={styles.autoSaveText}>Bozza salvata</Text>
            </View>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Cosa ti ha lasciato quest'opera? Quali passaggi ti hanno colpito?"
            placeholderTextColor={THEME.colors.textMuted}
            multiline
            numberOfLines={5}
            maxLength={3000}
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
          />
        </View>

        {/* Pulsante Pubblica (Legge di Fitts nella Thumb Zone) */}
        <Pressable onPress={handleSubmit} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>Pubblica Recensione</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontFamily: THEME.typography.fontEditorial,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  artistName: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  closeButton: {
    padding: 6,
  },
  scrollBody: {
    padding: 18,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${THEME.colors.accentFresh}15`,
    borderColor: THEME.colors.accentFresh,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.accentFresh,
  },
  ratingSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starPressable: {
    padding: 2,
  },
  numericRating: {
    fontFamily: THEME.typography.fontMono,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.accentWarm,
    marginLeft: 12,
    fontVariant: ['tabular-nums'],
  },
  numericRatingMax: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  vibesSection: {
    marginBottom: 20,
  },
  vibesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vibeChip: {
    backgroundColor: THEME.colors.bgInteractive,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  vibeChipSelected: {
    borderColor: THEME.colors.accentWarm,
    backgroundColor: `${THEME.colors.accentWarm}25`,
  },
  vibeChipText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  vibeChipTextSelected: {
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoSaveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  autoSaveText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  textInput: {
    backgroundColor: THEME.colors.bgInteractive,
    borderColor: THEME.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.typography.fontSans,
    fontSize: 14,
    minHeight: 110,
  },
  submitButton: {
    backgroundColor: THEME.colors.accentWarm,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    fontFamily: THEME.typography.fontSans,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.bgPrimary,
  },
});
