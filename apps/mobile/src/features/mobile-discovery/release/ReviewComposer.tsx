import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CreateReviewInput, ReviewItem } from '@openmusic/shared';
import { api, isApiError } from '../../../lib/api';
import { useTheme } from '../../../theme';
import {
  Badge,
  Button,
  Card,
  Field,
  RatingStars,
  Text,
  describeError,
  ratingFromStars,
  starsFromRating,
} from '../../../components/ui';
import { parseVibeTags } from '../catalog';
import { haptics } from '../haptics';

export const REVIEW_MAX_LENGTH = 3000;

export interface ReviewComposerProps {
  releaseId: string;
  releaseTitle: string;
  /** The viewer's existing review: the composer edits it (the API upserts by user + release). */
  existing: ReviewItem | null;
  onSaved: (review: ReviewItem) => void;
  /** Injected in tests. */
  submit?: (input: CreateReviewInput) => Promise<ReviewItem>;
}

/**
 * Write or edit the viewer's review: half-star rating (stored 10..100, ADR-001), optional text
 * and up to five vibe tags. Server field errors are shown inline.
 */
export function ReviewComposer({
  releaseId,
  releaseTitle,
  existing,
  onSaved,
  submit = (input) => api.reviews.upsert(input),
}: ReviewComposerProps) {
  const { space } = useTheme();
  const [open, setOpen] = useState(existing === null);
  const [stars, setStars] = useState<number | null>(
    existing ? starsFromRating(existing.rating) : null
  );
  const [content, setContent] = useState(existing?.content ?? '');
  const [tagsText, setTagsText] = useState(existing ? existing.vibeTags.join(' ') : '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    rating?: string;
    content?: string;
    tags?: string;
    form?: string;
  }>({});

  // A review saved elsewhere (pull to refresh) resets the form.
  useEffect(() => {
    if (!existing) return;
    setStars(starsFromRating(existing.rating));
    setContent(existing.content ?? '');
    setTagsText(existing.vibeTags.join(' '));
  }, [existing]);

  const tags = parseVibeTags(tagsText);

  const onSubmit = async () => {
    if (stars === null || stars <= 0) {
      setErrors({ rating: 'Scegli un voto da mezza a cinque stelle.' });
      haptics.error();
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const trimmed = content.trim();
      const saved = await submit({
        releaseId,
        rating: ratingFromStars(stars),
        ...(trimmed ? { content: trimmed } : {}),
        vibeTags: tags,
      });
      haptics.success();
      onSaved(saved);
      setOpen(false);
    } catch (err) {
      haptics.error();
      if (isApiError(err) && err.code === 'VALIDATION_ERROR') {
        setErrors({
          rating: err.fieldError('rating'),
          content: err.fieldError('content'),
          tags: err.fieldError('vibeTags'),
          form:
            err.fieldError('releaseId') ??
            (Object.keys(err.fieldErrors).length === 0 ? err.message : undefined),
        });
      } else {
        setErrors({ form: describeError(err) });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Card variant="outline" padding="sm" style={[styles.collapsed, { gap: space[3] }]}>
        <View style={styles.flex}>
          <Text variant="eyebrow">La tua recensione</Text>
          {existing ? (
            <RatingStars value={starsFromRating(existing.rating)} size="sm" label="Il tuo voto" />
          ) : null}
        </View>
        <Button
          label={existing ? 'Modifica' : 'Scrivi'}
          variant="secondary"
          size="sm"
          onPress={() => setOpen(true)}
        />
      </Card>
    );
  }

  return (
    <Card variant="surface" padding="md" style={{ gap: space[3] }}>
      <Text variant="title" accessibilityRole="header">
        {existing ? 'Modifica la tua recensione' : `Com'è ${releaseTitle}?`}
      </Text>
      <View style={{ gap: space[1] }}>
        <RatingStars value={stars} onChange={setStars} size="lg" label="Il tuo voto" showValue />
        {errors.rating ? (
          <Text variant="caption" tone="rotten" accessibilityLiveRegion="polite">
            {errors.rating}
          </Text>
        ) : null}
      </View>
      <Field
        label="Recensione"
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={REVIEW_MAX_LENGTH}
        placeholder="Cosa ti è rimasto in testa?"
        aside={`${content.length}/${REVIEW_MAX_LENGTH}`}
        error={errors.content}
      />
      <Field
        label="Vibe tag"
        value={tagsText}
        onChangeText={setTagsText}
        placeholder="notturno malinconico pioggia"
        autoCapitalize="none"
        autoCorrect={false}
        hint="Fino a 5, separati da spazio o virgola."
        error={errors.tags}
      />
      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <Badge key={tag} label={`#${tag}`} size="sm" mono />
          ))}
        </View>
      ) : null}
      {errors.form ? (
        <Text variant="caption" tone="rotten" accessibilityLiveRegion="polite">
          {errors.form}
        </Text>
      ) : null}
      <View style={[styles.actions, { gap: space[2] }]}>
        {existing ? (
          <Button
            label="Annulla"
            variant="ghost"
            onPress={() => setOpen(false)}
            disabled={saving}
          />
        ) : null}
        <Button
          label={existing ? 'Aggiorna' : 'Pubblica'}
          onPress={() => void onSubmit()}
          loading={saving}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  collapsed: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
