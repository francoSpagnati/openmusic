'use client';

import React, { useState } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import {
  CriticAccreditationRequestSchema,
  type CriticAccreditationStatus,
} from '@openmusic/shared';
import { api, isApiError } from '../../lib/api';
import { Button, Input, Textarea } from '../../components/ui';

type FieldName = 'outletName' | 'portfolioUrl' | 'bio';
type Errors = Partial<Record<FieldName | 'form', string>>;

const MESSAGES: Record<FieldName, string> = {
  outletName: 'Scrivi il nome della testata (da 2 a 100 caratteri).',
  portfolioUrl: 'Serve un indirizzo completo, es. https://testata.it/autore/nome.',
  bio: 'Massimo 500 caratteri.',
};

const isField = (key: unknown): key is FieldName =>
  key === 'outletName' || key === 'portfolioUrl' || key === 'bio';

export function AccreditationForm({
  initialOutlet,
  onSubmitted,
  submitLabel = 'Invia la richiesta',
}: {
  initialOutlet?: string | null;
  onSubmitted: (status: CriticAccreditationStatus) => void;
  submitLabel?: string;
}) {
  const [outletName, setOutletName] = useState(initialOutlet ?? '');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const clear = (name: FieldName) => setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = CriticAccreditationRequestSchema.safeParse({
      outletName: outletName.trim(),
      portfolioUrl: portfolioUrl.trim(),
      bio: bio.trim() || undefined,
    });
    if (!parsed.success) {
      const found: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (isField(key) && !found[key]) found[key] = MESSAGES[key];
      }
      setErrors(found);
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      onSubmitted(await api.critic.requestAccreditation(parsed.data));
    } catch (err) {
      if (isApiError(err) && err.code === 'VALIDATION_ERROR') {
        setErrors({
          outletName: err.fieldError('outletName'),
          portfolioUrl: err.fieldError('portfolioUrl'),
          bio: err.fieldError('bio'),
        });
      } else {
        setErrors({
          form: isApiError(err)
            ? err.message
            : 'Invio non riuscito. Riprova tra poco: i dati restano qui.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <Input
        label="Testata o webzine"
        required
        autoComplete="organization"
        placeholder="Es. OndaRock, Rumore, Pitchfork"
        maxLength={100}
        value={outletName}
        error={errors.outletName}
        disabled={saving}
        onChange={(e) => {
          setOutletName(e.target.value);
          clear('outletName');
        }}
      />
      <Input
        label="Pagina autore o portfolio"
        required
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://"
        hint="Un link dove si vedono articoli firmati da te: è così che verifichiamo l’identità."
        value={portfolioUrl}
        error={errors.portfolioUrl}
        disabled={saving}
        onChange={(e) => {
          setPortfolioUrl(e.target.value);
          clear('portfolioUrl');
        }}
      />
      <Textarea
        label="Presentazione"
        hint="Facoltativa. Generi di cui scrivi, da quanto tempo. Diventa anche la bio del tuo profilo."
        rows={3}
        maxLength={500}
        aside={`${bio.length}/500`}
        value={bio}
        error={errors.bio}
        disabled={saving}
        onChange={(e) => {
          setBio(e.target.value);
          clear('bio');
        }}
      />
      {errors.form && (
        <p
          role="alert"
          className="rounded-md border border-rotten/50 bg-rotten/10 px-3 py-2 text-sm text-ink"
        >
          {errors.form}
        </p>
      )}
      <Button
        type="submit"
        loading={saving}
        loadingLabel="Invio in corso…"
        leadingIcon={<PaperPlaneTilt weight="bold" />}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
