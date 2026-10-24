'use client';

import React, { useId, useState } from 'react';
import {
  CreateVideoContentInputSchema,
  type CatalogRelease,
  type MusicVideoItem,
  type VideoCategory,
} from '@openmusic/shared';
import { api, isApiError } from '../../lib/api';
import { Button, Dialog, Field, Input, controlClasses, useToast } from '../../components/ui';
import { ReleasePicker } from '../../components/discovery/ReleasePicker';
import { VIDEO_CATEGORIES } from './videoMeta';

type FieldName = 'title' | 'creatorName' | 'videoUrl' | 'thumbnailUrl' | 'durationSeconds' | 'form';
type Errors = Partial<Record<FieldName, string>>;

const MESSAGES: Record<Exclude<FieldName, 'form'>, string> = {
  title: 'Il titolo deve avere tra 3 e 150 caratteri.',
  creatorName: 'Indica il canale o l’autore (2–100 caratteri).',
  videoUrl: 'Incolla l’indirizzo completo del video, es. https://youtube.com/watch?v=…',
  thumbnailUrl: 'L’anteprima deve essere un indirizzo completo, oppure lasciala vuota.',
  durationSeconds: 'Scrivi la durata come 12:30 oppure 1:05:00.',
};

/** "12:30" or "1:05:00" → seconds; null when malformed. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n > 59)) return null;
  const seconds = nums.reduce((total, n) => total * 60 + n, 0);
  return seconds > 0 ? seconds : null;
}

export function PublishVideoDialog({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: (video: MusicVideoItem) => void;
}) {
  const formId = useId();
  const { notify } = useToast();
  const [title, setTitle] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState<VideoCategory>('ESSAY');
  const [release, setRelease] = useState<CatalogRelease | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setCreatorName('');
    setVideoUrl('');
    setThumbnailUrl('');
    setDuration('');
    setCategory('ESSAY');
    setRelease(null);
    setErrors({});
  };

  const clear = (name: FieldName) => setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const seconds = parseDuration(duration);
    const parsed = CreateVideoContentInputSchema.safeParse({
      title: title.trim(),
      creatorName: creatorName.trim(),
      videoUrl: videoUrl.trim(),
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      durationSeconds: seconds ?? 0,
      releaseId: release?.id,
      category,
    });
    const found: Errors = {};
    if (seconds === null) found.durationSeconds = MESSAGES.durationSeconds;
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && key in MESSAGES && !found[key as keyof typeof MESSAGES]) {
          found[key as keyof typeof MESSAGES] = MESSAGES[key as keyof typeof MESSAGES];
        }
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !parsed.success) {
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
      return;
    }

    setSaving(true);
    try {
      const video = await api.videos.publish(parsed.data);
      notify({ title: 'Video pubblicato', description: video.title, tone: 'success' });
      onPublished(video);
      reset();
      onClose();
    } catch (err) {
      setErrors({
        form: isApiError(err)
          ? err.status === 403
            ? 'Solo critici accreditati e staff possono pubblicare video.'
            : err.message
          : 'Pubblicazione non riuscita. Riprova.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      dismissible={!saving}
      size="lg"
      title="Pubblica un video"
      description="Video-saggi, recensioni, interviste e live session: rimandiamo sempre al video originale."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button type="submit" form={formId} loading={saving} loadingLabel="Pubblicazione…">
            Pubblica video
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-4">
        <Input
          label="Titolo"
          required
          maxLength={150}
          value={title}
          error={errors.title}
          disabled={saving}
          onChange={(e) => {
            setTitle(e.target.value);
            clear('title');
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Canale o autore"
            required
            maxLength={100}
            value={creatorName}
            error={errors.creatorName}
            disabled={saving}
            onChange={(e) => {
              setCreatorName(e.target.value);
              clear('creatorName');
            }}
          />
          <Field label="Categoria" required>
            {(control) => (
              <select
                {...control}
                value={category}
                disabled={saving}
                onChange={(e) => setCategory(e.target.value as VideoCategory)}
                className={`${controlClasses} h-11 text-base sm:text-sm`}
              >
                {VIDEO_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Input
          label="Link al video"
          required
          type="url"
          inputMode="url"
          placeholder="https://"
          value={videoUrl}
          error={errors.videoUrl}
          disabled={saving}
          onChange={(e) => {
            setVideoUrl(e.target.value);
            clear('videoUrl');
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Durata"
            required
            placeholder="12:30"
            inputMode="numeric"
            hint="Minuti:secondi o ore:minuti:secondi."
            value={duration}
            error={errors.durationSeconds}
            disabled={saving}
            onChange={(e) => {
              setDuration(e.target.value);
              clear('durationSeconds');
            }}
          />
          <Input
            label="Immagine di anteprima"
            type="url"
            inputMode="url"
            placeholder="https://"
            hint="Facoltativa: per YouTube la ricaviamo noi."
            value={thumbnailUrl}
            error={errors.thumbnailUrl}
            disabled={saving}
            onChange={(e) => {
              setThumbnailUrl(e.target.value);
              clear('thumbnailUrl');
            }}
          />
        </div>
        <ReleasePicker value={release} onChange={setRelease} disabled={saving} />
        {errors.form && (
          <p
            role="alert"
            className="rounded-md border border-rotten/50 bg-rotten/10 px-3 py-2 text-sm text-fg"
          >
            {errors.form}
          </p>
        )}
      </form>
    </Dialog>
  );
}
