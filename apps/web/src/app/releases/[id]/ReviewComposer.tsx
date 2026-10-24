'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FloppyDisk, PaperPlaneTilt, SealCheck } from '@phosphor-icons/react';
import type { ReviewItem } from '@openmusic/shared';
import { api, isApiError } from '../../../lib/api';
import {
  Button,
  Input,
  RatingStars,
  Textarea,
  ratingFromStars,
  starsFromRating,
  useToast,
} from '../../../components/ui';
import { VibeTagsInput } from '../../../components/web-core/feed/VibeTagsInput';
import { EditionChip } from '../../../components/discovery/EditionChip';
import { editionName } from '../../../components/discovery/editions';

const MAX_CONTENT = 3000;
const MIN_CRITIC_CONTENT = 10;

interface Draft {
  stars: number | null;
  content: string;
  vibeTags: string[];
}

interface Errors {
  rating?: string;
  content?: string;
  url?: string;
  form?: string;
}

const draftKey = (releaseId: string) => `om:review-draft:${releaseId}`;

function readDraft(releaseId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(releaseId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const d = parsed as Partial<Draft>;
    return {
      stars: typeof d.stars === 'number' ? d.stars : null,
      content: typeof d.content === 'string' ? d.content : '',
      vibeTags: Array.isArray(d.vibeTags)
        ? d.vibeTags.filter((t): t is string => typeof t === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

function writeDraft(releaseId: string, draft: Draft | null): void {
  try {
    if (draft) window.localStorage.setItem(draftKey(releaseId), JSON.stringify(draft));
    else window.localStorage.removeItem(draftKey(releaseId));
  } catch {
    // Private mode or blocked storage: drafts are a convenience only.
  }
}

interface ReviewComposerProps {
  releaseId: string;
  releaseTitle: string;
  /**
   * ADR-012: set when the album has several editions (or this one is marked). Reviews belong to
   * one edition, so the composer names it; null hides the notice for single-edition albums.
   */
  edition: { label: string | null } | null;
  /** The viewer's existing community review, to edit in place. */
  existing: ReviewItem | null;
  /** Accredited critics publish to the critic score instead. */
  asCritic: boolean;
  onSaved: (review: ReviewItem | null) => void;
}

export function ReviewComposer({
  releaseId,
  releaseTitle,
  edition,
  existing,
  asCritic,
  onSaved,
}: ReviewComposerProps) {
  const { notify } = useToast();
  const [stars, setStars] = useState<number | null>(
    existing ? starsFromRating(existing.rating) : null
  );
  const [content, setContent] = useState(existing?.content ?? '');
  const [vibeTags, setVibeTags] = useState<string[]>(existing?.vibeTags ?? []);
  const [sourceUrl, setSourceUrl] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = useRef(false);

  // Restore an unsent draft once (only when there is no published review to edit).
  useEffect(() => {
    if (existing) return;
    const draft = readDraft(releaseId);
    if (draft && (draft.stars !== null || draft.content)) {
      setStars(draft.stars);
      setContent(draft.content);
      setVibeTags(draft.vibeTags);
      setRestored(true);
    }
  }, [existing, releaseId]);

  useEffect(() => {
    if (!dirty.current || existing) return;
    const id = window.setTimeout(() => writeDraft(releaseId, { stars, content, vibeTags }), 400);
    return () => window.clearTimeout(id);
  }, [stars, content, vibeTags, existing, releaseId]);

  const touch = () => {
    dirty.current = true;
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (stars === null) next.rating = 'Scegli un voto da mezza stella a cinque stelle.';
    if (content.length > MAX_CONTENT) next.content = `Massimo ${MAX_CONTENT} caratteri.`;
    if (asCritic && content.trim().length < MIN_CRITIC_CONTENT) {
      next.content = `Per la critica serve un estratto di almeno ${MIN_CRITIC_CONTENT} caratteri.`;
    }
    if (asCritic && sourceUrl.trim()) {
      try {
        const url = new URL(sourceUrl.trim());
        if (!/^https?:$/.test(url.protocol)) throw new Error('protocol');
      } catch {
        next.url = 'Inserisci un indirizzo completo, es. https://testata.it/recensione.';
      }
    }
    return next;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || stars === null) {
      // Send focus to the first problem so keyboard and screen-reader users find it.
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>(
            '[data-invalid="true"] [role="slider"], [aria-invalid="true"]'
          )
          ?.focus()
      );
      return;
    }
    setSaving(true);
    try {
      const rating = ratingFromStars(stars);
      if (asCritic) {
        await api.critic.publishReview({
          releaseId,
          rating,
          content: content.trim(),
          originalReviewUrl: sourceUrl.trim() || undefined,
        });
        notify({ title: 'Recensione della critica pubblicata', tone: 'success' });
        onSaved(null);
      } else {
        const saved = await api.reviews.upsert({
          releaseId,
          rating,
          content: content.trim() || undefined,
          vibeTags,
        });
        notify({
          title: existing ? 'Recensione aggiornata' : 'Recensione pubblicata',
          description: saved.isVerifiedListen
            ? 'Ascolto verificato: il tuo voto pesa 1,5×.'
            : 'Ascolta almeno 3 brani del disco per ottenere l’ascolto verificato.',
          tone: 'success',
        });
        onSaved(saved);
      }
      dirty.current = false;
      writeDraft(releaseId, null);
      setRestored(false);
    } catch (err) {
      if (isApiError(err)) {
        setErrors({
          rating: err.fieldError('rating'),
          content: err.fieldError('content'),
          url: err.fieldError('originalReviewUrl'),
          form: err.code === 'VALIDATION_ERROR' ? undefined : err.message,
        });
      } else {
        setErrors({ form: 'Qualcosa è andato storto. La bozza è salvata: riprova tra poco.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const discardDraft = () => {
    writeDraft(releaseId, null);
    dirty.current = false;
    setStars(null);
    setContent('');
    setVibeTags([]);
    setRestored(false);
    setErrors({});
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="space-y-5"
      aria-labelledby="composer-heading"
      aria-describedby={edition ? 'composer-edition' : undefined}
    >
      <div>
        <h3 id="composer-heading" className="om-headline flex items-center gap-2 text-xl text-fg">
          {asCritic && (
            <SealCheck aria-hidden="true" weight="duotone" className="h-5 w-5 text-fresh" />
          )}
          {asCritic
            ? 'Pubblica il voto della critica'
            : existing
              ? 'La tua recensione'
              : 'Com’è questo disco?'}
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          {asCritic
            ? 'Il tuo voto entra nel Critic Score con la firma della tua testata.'
            : `Il tuo voto conta nel voto del pubblico di ${releaseTitle}.`}
        </p>
      </div>

      {edition && (
        <div
          id="composer-edition"
          className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-line bg-sunken px-3 py-2 text-sm text-fg-muted"
        >
          <span>Stai recensendo</span>
          <EditionChip label={edition.label} size="sm" />
          <span className="basis-full text-xs text-fg-subtle">
            Il voto resta su questa edizione. Nel voto complessivo dell’album conti una volta sola:
            se recensisci più edizioni vale la recensione più recente.
          </span>
        </div>
      )}

      {restored && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-sm text-fg-muted"
        >
          Abbiamo ripreso la bozza che non avevi pubblicato.
          <button
            type="button"
            onClick={discardDraft}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            Scarta la bozza
          </button>
        </p>
      )}

      <div className="space-y-1.5">
        <p id="composer-rating-label" className="text-sm font-semibold text-fg">
          Voto{' '}
          <span className="text-accent" aria-hidden="true">
            *
          </span>
        </p>
        <div data-invalid={errors.rating ? 'true' : undefined}>
          <RatingStars
            value={stars}
            onChange={(next) => {
              touch();
              setStars(next);
              setErrors((e) => ({ ...e, rating: undefined }));
            }}
            size="lg"
            showValue
            label={`Il tuo voto per ${releaseTitle}${edition ? ` (${editionName(edition.label)})` : ''}`}
            disabled={saving}
          />
        </div>
        <p className="text-xs text-fg-subtle">
          Frecce per mezze stelle, Pagina su/giù per stelle intere. Da 3,5 stelle il voto è
          “fresco”.
        </p>
        {errors.rating && (
          <p role="alert" className="text-sm text-rotten">
            {errors.rating}
          </p>
        )}
      </div>

      <Textarea
        label={asCritic ? 'Estratto della recensione' : 'Cosa ne pensi?'}
        hint={
          asCritic
            ? 'Una citazione dalla tua recensione: comparirà come pull-quote.'
            : 'Facoltativo. Racconta cosa ti ha colpito: niente spoiler sui testi.'
        }
        required={asCritic}
        rows={5}
        maxLength={MAX_CONTENT}
        aside={`${content.length}/${MAX_CONTENT}`}
        value={content}
        disabled={saving}
        error={errors.content}
        onChange={(e) => {
          touch();
          setContent(e.target.value);
          if (errors.content) setErrors((x) => ({ ...x, content: undefined }));
        }}
      />

      {asCritic ? (
        <Input
          label="Link all’articolo completo"
          hint="Facoltativo, ma i lettori lo apprezzano: portiamo traffico alla tua testata."
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          value={sourceUrl}
          disabled={saving}
          error={errors.url}
          onChange={(e) => {
            setSourceUrl(e.target.value);
            if (errors.url) setErrors((x) => ({ ...x, url: undefined }));
          }}
        />
      ) : (
        <VibeTagsInput
          value={vibeTags}
          disabled={saving}
          onChange={(tags) => {
            touch();
            setVibeTags(tags);
          }}
        />
      )}

      {errors.form && (
        <p
          role="alert"
          className="rounded-md border border-rotten/50 bg-rotten/10 px-3 py-2 text-sm text-fg"
        >
          {errors.form}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          loading={saving}
          loadingLabel="Pubblicazione…"
          leadingIcon={existing ? <FloppyDisk weight="bold" /> : <PaperPlaneTilt weight="bold" />}
        >
          {existing ? 'Aggiorna recensione' : 'Pubblica'}
        </Button>
        {!existing && !asCritic && (
          <span className="text-xs text-fg-subtle">
            La bozza si salva da sola su questo dispositivo.
          </span>
        )}
      </div>
    </form>
  );
}
