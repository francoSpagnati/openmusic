import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { EditionSummary } from '@openmusic/shared';
import { CoverArt, Text } from '../../../components/ui';
import { useTheme } from '../../../theme';
import { editionFacts, editionName } from '../catalog';
import { EditionChip } from './EditionChip';

const TYPE_LABEL: Record<EditionSummary['releaseType'], string> = {
  ALBUM: 'Album',
  EP: 'EP',
  SINGLE: 'Singolo',
};

function scoreText(name: string, avg: number | null, count: number): string {
  if (count === 0 || avg === null) return `${name}: nessuna recensione`;
  const reviews = count === 1 ? '1 recensione' : `${count} recensioni`;
  return `${name}: media ${avg.toFixed(1).replace('.', ',')} su 5, ${reviews}`;
}

/** One edition's own averages; never mixed with the other editions'. */
export function EditionScores({ edition }: { edition: EditionSummary }) {
  const critic = scoreText('Critica', edition.criticAvg, edition.criticCount);
  const audience = scoreText('Pubblico', edition.audienceAvg, edition.audienceCount);
  const short = (avg: number | null, count: number) =>
    count > 0 && avg !== null ? `★ ${avg.toFixed(1).replace('.', ',')} · ${count}` : '—';
  return (
    <Text
      variant="mono"
      size="xs"
      tone="secondary"
      accessibilityLabel={`${critic}. ${audience}.`}
      numberOfLines={1}
    >
      {`Critica ${short(edition.criticAvg, edition.criticCount)}   Pubblico ${short(edition.audienceAvg, edition.audienceCount)}`}
    </Text>
  );
}

function a11yLabel(edition: EditionSummary): string {
  return [edition.title, editionName(edition.editionLabel), ...editionFacts(edition)].join(', ');
}

/** Sideways row of record-sleeve cards (release page, "Altre edizioni"). */
export function EditionStrip({ editions }: { editions: EditionSummary[] }) {
  const { space, colors, radii } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[3] }}
      accessibilityLabel="Altre edizioni"
    >
      {editions.map((edition) => (
        <Pressable
          key={edition.id}
          accessibilityRole="link"
          accessibilityLabel={a11yLabel(edition)}
          accessibilityHint="Apre questa edizione"
          onPress={() => router.push(`/release/${edition.id}`)}
          style={({ pressed }) => [
            styles.card,
            {
              gap: space[2],
              padding: space[3],
              borderRadius: radii.sleeve,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <CoverArt key={edition.coverUrl ?? 'none'} uri={edition.coverUrl} size={136} />
          <EditionChip label={edition.editionLabel} size="sm" />
          <Text variant="bodyStrong" size="sm" numberOfLines={2}>
            {edition.title}
          </Text>
          <Text variant="eyebrow" numberOfLines={1}>
            {[TYPE_LABEL[edition.releaseType], ...editionFacts(edition)].join(' · ')}
          </Text>
          <EditionScores edition={edition} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Full-width edition row (album screen): thumbnail, edition, facts, track count, own scores. */
export function EditionRow({ edition }: { edition: EditionSummary }) {
  const { space } = useTheme();
  const facts = [
    TYPE_LABEL[edition.releaseType],
    ...editionFacts(edition),
    edition.trackCount ? `${edition.trackCount} brani` : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={a11yLabel(edition)}
      accessibilityHint="Apre questa edizione"
      onPress={() => router.push(`/release/${edition.id}`)}
      style={({ pressed }) => [styles.row, { gap: space[3], opacity: pressed ? 0.7 : 1 }]}
    >
      <CoverArt key={edition.coverUrl ?? 'none'} uri={edition.coverUrl} size={64} />
      <View style={[styles.text, { gap: space[1] }]}>
        <EditionChip label={edition.editionLabel} size="sm" />
        <Text variant="title" size="base" numberOfLines={2}>
          {edition.title}
        </Text>
        <Text variant="eyebrow" numberOfLines={2}>
          {facts.join(' · ')}
        </Text>
        <EditionScores edition={edition} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 162, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, minHeight: 64 },
  text: { flex: 1, minWidth: 0 },
});
