import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreatePostInputSchema, type CreatePostInput, type Post } from '@openmusic/shared';
import { api, isApiError } from '../../lib/api';
import { useTheme } from '../../theme';
import {
  Button,
  CoverArt,
  Field,
  RatingStars,
  Text,
  describeError,
  ratingFromStars,
} from '../../components/ui';
import { CatalogPickerSheet, type CatalogPick } from './CatalogPickerSheet';
import { MusicNote, X } from './icons';
import { haptics } from './haptics';

export interface PostComposerSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (post: Post) => void;
}

/** "#notturno, Malinconico" -> ["notturno", "Malinconico"] (the shared schema strips `#`). */
export function parseVibeTags(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.replace(/^#+/, '').length > 0);
}

type FieldErrors = Partial<Record<'content' | 'rating' | 'vibeTags', string>>;

/**
 * New post: text, optional disc/track from the catalog (local or imported from external
 * databases), optional half-star rating (only with an attachment, as the contract requires) and
 * up to five vibe tags. Validated with the shared `CreatePostInputSchema` before sending.
 */
export function PostComposerSheet({ visible, onClose, onCreated }: PostComposerSheetProps) {
  const { colors, space, radii } = useTheme();
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<CatalogPick | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [tags, setTags] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setContent('');
    setAttachment(null);
    setStars(null);
    setTags('');
    setErrors({});
    setFormError(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async () => {
    const input: CreatePostInput = {
      content,
      releaseId: attachment?.kind === 'release' ? attachment.release.id : undefined,
      trackId: attachment?.kind === 'track' ? attachment.track.id : undefined,
      rating: attachment && stars ? ratingFromStars(stars) : undefined,
      vibeTags: parseVibeTags(tags),
    };
    const parsed = CreatePostInputSchema.safeParse(input);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        content: flat.content?.[0] ? 'Scrivi qualcosa (massimo 2000 caratteri).' : undefined,
        rating: flat.rating?.[0],
        vibeTags: flat.vibeTags?.[0] ? 'Massimo 5 vibe, 30 caratteri ciascuna.' : undefined,
      });
      haptics.error();
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const post = await api.feed.create(input);
      haptics.success();
      reset();
      onCreated(post);
    } catch (err) {
      haptics.error();
      if (
        isApiError(err) &&
        (err.fieldError('content') || err.fieldError('rating') || err.fieldError('vibeTags'))
      ) {
        setErrors({
          content: err.fieldError('content'),
          rating: err.fieldError('rating'),
          vibeTags: err.fieldError('vibeTags'),
        });
      } else {
        setFormError(describeError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const attachedTitle = attachment
    ? attachment.kind === 'track'
      ? attachment.track.title
      : attachment.release.title
    : '';
  const attachedArtist = attachment
    ? attachment.kind === 'track'
      ? attachment.track.artistName
      : attachment.release.artistName
    : '';
  const attachedCover = attachment
    ? attachment.kind === 'track'
      ? attachment.track.coverUrl
      : attachment.release.coverUrl
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.bg }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { paddingHorizontal: space[5], paddingTop: space[3] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annulla"
              hitSlop={10}
              onPress={close}
              style={styles.icon}
            >
              <X size={22} color={colors.text} />
            </Pressable>
            <Text variant="title" accessibilityRole="header">
              Nuovo post
            </Text>
            <View style={styles.icon} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: space[5], gap: space[4] }}
            keyboardShouldPersistTaps="handled"
          >
            <Field
              label="Cosa stai ascoltando?"
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={2000}
              aside={`${content.length}/2000`}
              error={errors.content}
              autoFocus
            />

            {attachment ? (
              <View
                style={[
                  styles.attachment,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radii.md,
                    borderColor: colors.border,
                  },
                ]}
              >
                <CoverArt uri={attachedCover ?? null} size={52} />
                <View style={styles.flexShrink}>
                  <Text variant="eyebrow">{attachment.kind === 'track' ? 'Brano' : 'Disco'}</Text>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {attachedTitle}
                  </Text>
                  <Text size="sm" tone="secondary" numberOfLines={1}>
                    {attachedArtist}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Rimuovi allegato"
                  hitSlop={8}
                  onPress={() => {
                    setAttachment(null);
                    setStars(null);
                  }}
                  style={styles.icon}
                >
                  <X size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <Button
                label="Allega un disco o un brano"
                variant="secondary"
                leadingIcon={<MusicNote size={18} color={colors.text} />}
                onPress={() => setPickerOpen(true)}
              />
            )}

            {attachment ? (
              <View style={styles.gap}>
                <Text variant="bodyStrong" size="sm">
                  Voto (facoltativo)
                </Text>
                <RatingStars
                  value={stars}
                  onChange={setStars}
                  size="md"
                  showValue
                  label={`Il tuo voto per ${attachedTitle}`}
                />
                {errors.rating ? (
                  <Text size="sm" tone="rotten">
                    {errors.rating}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Field
              label="Vibe"
              placeholder="#notturno, #malinconico"
              value={tags}
              onChangeText={setTags}
              autoCapitalize="none"
              autoCorrect={false}
              hint="Fino a 5, separate da virgola o spazio."
              error={errors.vibeTags}
            />

            {formError ? (
              <Text size="sm" tone="rotten" accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}
          </ScrollView>
          {/* Primary action in the thumb zone, above the keyboard. */}
          <View style={[styles.footer, { padding: space[5], borderTopColor: colors.border }]}>
            <Button
              label="Pubblica"
              size="lg"
              fullWidth
              onPress={submit}
              loading={busy}
              disabled={content.trim().length === 0}
            />
          </View>
        </KeyboardAvoidingView>
        <CatalogPickerSheet
          visible={pickerOpen}
          mode="all"
          onClose={() => setPickerOpen(false)}
          onPick={(pick) => {
            setAttachment(pick);
            setPickerOpen(false);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  gap: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderWidth: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
