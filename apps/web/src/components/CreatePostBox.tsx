'use client';

import React, { useState } from 'react';
import { PaperPlaneTilt, X } from '@phosphor-icons/react';
import { CreatePostInputSchema, type Post } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar, Button, RatingStars, Textarea, ratingFromStars, useToast } from '@/components/ui';
import { displayNameOf, errorMessage } from './web-core/format';
import { FORM_ERROR, apiFormErrors, zodFormErrors, type FormErrors } from './web-core/formErrors';
import { FormAlert } from './web-core/auth/FormAlert';
import { ReleasePicker, type PickedRelease } from './web-core/feed/ReleasePicker';
import { VibeTagsInput } from './web-core/feed/VibeTagsInput';

const MAX_LENGTH = 2000;

export interface CreatePostBoxProps {
  onPostCreated: (post: Post) => void;
  /** Called when the author undoes a just-published post from the toast. */
  onPostRemoved?: (postId: string) => void;
}

/**
 * Composer for the home feed. The draft survives failures (nothing is lost on a network error)
 * and a published post can be undone from the confirmation toast.
 */
export const CreatePostBox = React.forwardRef<HTMLTextAreaElement, CreatePostBoxProps>(
  function CreatePostBox({ onPostCreated, onPostRemoved }, ref) {
    const { user } = useAuth();
    const { notify } = useToast();
    const [content, setContent] = useState('');
    const [release, setRelease] = useState<PickedRelease | null>(null);
    const [stars, setStars] = useState<number | null>(null);
    const [vibeTags, setVibeTags] = useState<string[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);

    if (!user) return null;
    const name = displayNameOf(user);
    const trimmedLength = content.trim().length;

    function reset() {
      setContent('');
      setRelease(null);
      setStars(null);
      setVibeTags([]);
      setErrors({});
      setExpanded(false);
    }

    /** Discarding is reversible from the toast (Nielsen #3). */
    function discard() {
      const snapshot = { content, release, stars, vibeTags };
      const hadDraft = trimmedLength > 0 || release !== null || vibeTags.length > 0;
      reset();
      if (!hadDraft) return;
      notify({
        title: 'Bozza scartata',
        action: {
          label: 'Ripristina',
          onAction: () => {
            setContent(snapshot.content);
            setRelease(snapshot.release);
            setStars(snapshot.stars);
            setVibeTags(snapshot.vibeTags);
            setExpanded(true);
          },
        },
      });
    }

    async function undo(post: Post) {
      try {
        await api.feed.remove(post.id);
        onPostRemoved?.(post.id);
        notify({ title: 'Post annullato' });
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Non siamo riusciti ad annullare',
          description: errorMessage(err),
        });
      }
    }

    async function submit() {
      const parsed = CreatePostInputSchema.safeParse({
        content,
        releaseId: release?.id,
        rating: release && stars ? ratingFromStars(stars) : undefined,
        vibeTags,
      });
      if (!parsed.success) {
        setErrors(zodFormErrors(parsed.error));
        return;
      }
      setSubmitting(true);
      setErrors({});
      try {
        const post = await api.feed.create(parsed.data);
        onPostCreated(post);
        reset();
        notify({
          tone: 'success',
          title: 'Pubblicato nel feed',
          action: { label: 'Annulla', onAction: () => void undo(post) },
        });
      } catch (err) {
        setErrors(
          apiFormErrors(err, 'Pubblicazione non riuscita. Il testo è ancora qui: riprova.')
        );
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <section
        id="compose"
        aria-label="Nuovo post"
        className="scroll-mt-20 border-b border-line bg-surface/60 p-4 sm:p-5"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex gap-3"
        >
          <Avatar
            name={name}
            src={user.avatarUrl}
            size="md"
            decorative
            className="hidden sm:inline-flex"
          />
          <div className="min-w-0 flex-1 space-y-4">
            {errors[FORM_ERROR] && <FormAlert>{errors[FORM_ERROR]}</FormAlert>}
            <Textarea
              ref={ref}
              name="content"
              label="Cosa stai ascoltando?"
              hideLabel={!expanded}
              placeholder="Cosa stai ascoltando? Racconta un disco ai tuoi amici…"
              rows={expanded ? 4 : 2}
              maxLength={MAX_LENGTH}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setExpanded(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              error={errors.content}
              aside={expanded ? `${content.length}/${MAX_LENGTH}` : undefined}
              disabled={submitting}
              className="min-h-0"
            />

            {expanded && (
              <div className="space-y-4">
                <ReleasePicker
                  value={release}
                  onChange={(next) => {
                    setRelease(next);
                    if (!next) setStars(null);
                  }}
                  disabled={submitting}
                />
                {release && (
                  <div className="flex flex-wrap items-center gap-3">
                    <RatingStars
                      label={`Il tuo voto per ${release.title}`}
                      value={stars}
                      onChange={setStars}
                      showValue
                      disabled={submitting}
                    />
                    {stars !== null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStars(null)}
                        leadingIcon={<X aria-hidden="true" />}
                      >
                        Togli voto
                      </Button>
                    )}
                    {errors.rating && <p className="w-full text-sm text-rotten">{errors.rating}</p>}
                  </div>
                )}
                <VibeTagsInput value={vibeTags} onChange={setVibeTags} disabled={submitting} />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hidden font-mono text-xs text-ink-muted sm:block">
                {expanded ? 'Ctrl/⌘ + Invio per pubblicare' : 'Visibile a chi ti segue'}
              </p>
              <div className="ml-auto flex items-center gap-2">
                {expanded && (
                  <Button variant="ghost" size="sm" onClick={discard} disabled={submitting}>
                    {trimmedLength > 0 || release || vibeTags.length > 0 ? 'Scarta' : 'Chiudi'}
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={trimmedLength === 0}
                  loading={submitting}
                  loadingLabel="Pubblicazione…"
                  leadingIcon={<PaperPlaneTilt aria-hidden="true" weight="bold" />}
                >
                  Pubblica
                </Button>
              </div>
            </div>
          </div>
        </form>
      </section>
    );
  }
);
