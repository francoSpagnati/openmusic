'use client';

import React, { useRef, useState } from 'react';
import { Key } from '@phosphor-icons/react';
import { ChangePasswordInputSchema } from '@openmusic/shared';
import { api, isApiError } from '@/lib/api';
import { Button, useToast } from '@/components/ui';
import { FormAlert } from '../auth/FormAlert';
import { PasswordInput } from '../auth/PasswordInput';
import {
  FORM_ERROR,
  apiFormErrors,
  focusFirstError,
  zodFormErrors,
  type FormErrors,
} from '../formErrors';

const FIELDS = [
  ['currentPassword', 'current-password'],
  ['newPassword', 'new-password'],
] as const;

/** Change (or, for Spotify-only accounts, set) the account password. */
export function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = ChangePasswordInputSchema.safeParse({
      // OAuth-only accounts have no current password; the API ignores this value for them.
      currentPassword: hasPassword ? current : 'not-set',
      newPassword: next,
    });
    if (!parsed.success) {
      const found = zodFormErrors(parsed.error);
      if (found.currentPassword) found.currentPassword = 'Inserisci la password attuale.';
      setErrors(found);
      focusFirstError(formRef.current, found, FIELDS);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await api.auth.changePassword(parsed.data);
      setCurrent('');
      setNext('');
      notify({
        tone: 'success',
        title: hasPassword ? 'Password aggiornata' : 'Password impostata',
      });
    } catch (err) {
      const found: FormErrors =
        isApiError(err) && err.code === 'INVALID_CREDENTIALS'
          ? { currentPassword: 'La password attuale non è corretta.' }
          : apiFormErrors(err, 'Non siamo riusciti a cambiare la password.');
      setErrors(found);
      focusFirstError(formRef.current, found, FIELDS);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-5">
      {errors[FORM_ERROR] && <FormAlert>{errors[FORM_ERROR]}</FormAlert>}
      {/* Lets password managers attach the new password to the right account. */}
      <input type="email" name="email" autoComplete="username" value={email} hidden readOnly />
      {hasPassword && (
        <PasswordInput
          id="current-password"
          label="Password attuale"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.currentPassword}
        />
      )}
      <PasswordInput
        id="new-password"
        label={hasPassword ? 'Nuova password' : 'Imposta una password'}
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.newPassword}
        hint="Almeno 10 caratteri."
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          loading={saving}
          loadingLabel="Aggiornamento…"
          leadingIcon={<Key aria-hidden="true" weight="bold" />}
        >
          {hasPassword ? 'Cambia password' : 'Imposta password'}
        </Button>
      </div>
    </form>
  );
}
