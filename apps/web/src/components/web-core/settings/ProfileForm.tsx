'use client';

import React, { useMemo, useState } from 'react';
import { FloppyDisk, ImageSquare, UserCircle } from '@phosphor-icons/react';
import { UpdateProfileSchema, type AuthUser } from '@openmusic/shared';
import { useAuth } from '@/lib/auth';
import { Avatar, Button, Input, Textarea, useToast } from '@/components/ui';
import { FormAlert } from '../auth/FormAlert';
import { GenrePicker } from '../auth/GenrePicker';
import { FORM_ERROR, apiFormErrors, zodFormErrors, type FormErrors } from '../formErrors';

const BIO_MAX = 280;

interface Draft {
  displayName: string;
  bio: string;
  avatarUrl: string;
  favoriteGenres: string[];
}

function draftOf(user: AuthUser): Draft {
  return {
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl ?? '',
    favoriteGenres: user.favoriteGenres,
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.displayName === b.displayName &&
    a.bio === b.bio &&
    a.avatarUrl === b.avatarUrl &&
    a.favoriteGenres.join('\u0000') === b.favoriteGenres.join('\u0000')
  );
}

/** Public profile fields. Save is enabled only with changes; "Annulla" restores the saved values. */
export function ProfileForm({ user }: { user: AuthUser }) {
  const { updateProfile } = useAuth();
  const { notify } = useToast();
  const saved = useMemo(() => draftOf(user), [user]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const dirty = !sameDraft(draft, saved);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.displayName.trim() === '') {
      setErrors({ displayName: 'Scrivi un nome: è quello che vedono gli altri.' });
      return;
    }
    const parsed = UpdateProfileSchema.safeParse({
      displayName: draft.displayName,
      bio: draft.bio,
      avatarUrl: draft.avatarUrl.trim() === '' ? null : draft.avatarUrl.trim(),
      favoriteGenres: draft.favoriteGenres,
    });
    if (!parsed.success) {
      const next = zodFormErrors(parsed.error);
      if (next.avatarUrl)
        next.avatarUrl = 'Inserisci un indirizzo completo, es. https://…/foto.jpg';
      setErrors(next);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const updated = await updateProfile(parsed.data);
      setDraft(draftOf(updated));
      notify({ tone: 'success', title: 'Profilo aggiornato' });
    } catch (err) {
      setErrors(apiFormErrors(err, 'Salvataggio non riuscito. Le modifiche sono ancora qui.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      {errors[FORM_ERROR] && <FormAlert>{errors[FORM_ERROR]}</FormAlert>}
      <div className="flex items-center gap-4">
        <Avatar
          name={draft.displayName || user.username}
          src={draft.avatarUrl || null}
          size="lg"
          decorative
        />
        <p className="text-sm text-ink-secondary">
          Anteprima di come ti vedono gli altri, <span className="font-mono">@{user.username}</span>
          .
        </p>
      </div>
      <Input
        name="displayName"
        label="Nome visualizzato"
        autoComplete="name"
        maxLength={50}
        value={draft.displayName}
        onChange={(e) => set('displayName', e.target.value)}
        error={errors.displayName}
        leadingIcon={<UserCircle />}
      />
      <Textarea
        name="bio"
        label="Bio"
        rows={3}
        maxLength={BIO_MAX}
        aside={`${draft.bio.length}/${BIO_MAX}`}
        placeholder="Cosa non manca mai sul tuo piatto?"
        value={draft.bio}
        onChange={(e) => set('bio', e.target.value)}
        error={errors.bio}
      />
      <Input
        name="avatarUrl"
        type="url"
        inputMode="url"
        label="Immagine del profilo (URL)"
        autoComplete="photo"
        spellCheck={false}
        placeholder="https://"
        value={draft.avatarUrl}
        onChange={(e) => set('avatarUrl', e.target.value)}
        error={errors.avatarUrl}
        hint="Lascia vuoto per usare le tue iniziali."
        leadingIcon={<ImageSquare />}
      />
      <GenrePicker
        value={draft.favoriteGenres}
        onChange={(next) => set('favoriteGenres', next)}
        hint="Compaiono sul profilo e orientano i suggerimenti."
        disabled={saving}
      />
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
        {dirty && !saving && (
          <p role="status" className="mr-auto text-sm text-ink-muted">
            Modifiche non salvate
          </p>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            setDraft(saved);
            setErrors({});
          }}
          disabled={!dirty || saving}
        >
          Annulla modifiche
        </Button>
        <Button
          type="submit"
          disabled={!dirty}
          loading={saving}
          loadingLabel="Salvataggio…"
          leadingIcon={<FloppyDisk aria-hidden="true" weight="bold" />}
        >
          Salva profilo
        </Button>
      </div>
    </form>
  );
}
