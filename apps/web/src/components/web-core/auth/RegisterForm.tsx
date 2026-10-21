'use client';

import React, { useRef, useState } from 'react';
import { At, EnvelopeSimple, Sparkle, UserCircle } from '@phosphor-icons/react';
import { RegisterInputSchema } from '@openmusic/shared';
import { isApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';
import {
  FORM_ERROR,
  apiFormErrors,
  focusFirstError,
  zodFormErrors,
  type FormErrors,
} from '../formErrors';
import { FormAlert } from './FormAlert';
import { GenrePicker } from './GenrePicker';
import { PasswordInput } from './PasswordInput';

const FIELDS = ['email', 'username', 'displayName', ['password', 'new-password']] as const;
const MIN_PASSWORD = 10;

type Values = { email: string; username: string; displayName: string; password: string };
type FieldName = keyof Values;

const shape = RegisterInputSchema.shape;

/** Validates one field on blur so mistakes surface before submitting (Nielsen #5). */
function validateField(name: FieldName, value: string): string | undefined {
  if (name === 'displayName' && value.trim() === '') return undefined;
  const result = shape[name].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}) {
  const { register } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>({
    email: '',
    username: '',
    displayName: '',
    password: '',
  });
  const [genres, setGenres] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (name: FieldName) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setValues((v) => ({ ...v, [name]: value }));
    // Clear a shown error as soon as the input becomes valid, never add one while typing.
    if (errors[name] && !validateField(name, value)) {
      setErrors(({ [name]: _removed, ...rest }) => rest);
    }
  };

  const blur = (name: FieldName) => () => {
    const value = values[name];
    if (value === '') return;
    const message = validateField(name, value);
    setErrors((prev) => {
      const { [name]: _removed, ...rest } = prev;
      return message ? { ...rest, [name]: message } : rest;
    });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = RegisterInputSchema.safeParse({
      email: values.email,
      username: values.username,
      password: values.password,
      displayName: values.displayName.trim() || undefined,
      favoriteGenres: genres,
    });
    if (!parsed.success) {
      const next = zodFormErrors(parsed.error);
      setErrors(next);
      focusFirstError(formRef.current, next, FIELDS);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      await register(parsed.data);
      onSuccess();
    } catch (err) {
      let next: FormErrors;
      if (isApiError(err) && err.code === 'CONFLICT') {
        next = /username/i.test(err.message)
          ? { username: 'Questo username è già preso: provane un altro.' }
          : { email: 'Esiste già un account con questa email.' };
      } else {
        next = apiFormErrors(err, 'Registrazione non riuscita. Riprova tra poco.');
      }
      setErrors(next);
      focusFirstError(formRef.current, next, FIELDS);
      setSubmitting(false);
    }
  }

  const handle = values.username.trim().toLowerCase();
  const passwordLength = values.password.length;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="register-heading"
      className="space-y-5"
    >
      <h2 id="register-heading" className="sr-only">
        Crea un account
      </h2>
      {errors[FORM_ERROR] && <FormAlert>{errors[FORM_ERROR]}</FormAlert>}
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="username"
        inputMode="email"
        spellCheck={false}
        enterKeyHint="next"
        required
        value={values.email}
        onChange={set('email')}
        onBlur={blur('email')}
        error={
          errors.email && /già un account/.test(errors.email) ? (
            <>
              {errors.email}{' '}
              <button type="button" className="font-semibold underline" onClick={onSwitchToLogin}>
                Accedi invece
              </button>
            </>
          ) : (
            errors.email
          )
        }
        hint="Serve solo per accedere: non la mostriamo a nessuno."
        leadingIcon={<EnvelopeSimple />}
      />
      <Input
        id="username"
        name="username"
        label="Username"
        autoComplete="nickname"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        required
        minLength={3}
        maxLength={30}
        value={values.username}
        onChange={set('username')}
        onBlur={blur('username')}
        error={errors.username}
        hint={
          handle ? (
            <>
              Il tuo profilo sarà <span className="font-mono text-ink-secondary">@{handle}</span>
            </>
          ) : (
            'Da 3 a 30 caratteri: lettere, numeri e underscore.'
          )
        }
        leadingIcon={<At />}
      />
      <Input
        id="displayName"
        name="displayName"
        label="Nome visualizzato"
        autoComplete="name"
        enterKeyHint="next"
        maxLength={50}
        value={values.displayName}
        onChange={set('displayName')}
        onBlur={blur('displayName')}
        error={errors.displayName}
        hint="Facoltativo. Puoi cambiarlo quando vuoi."
        leadingIcon={<UserCircle />}
      />
      <PasswordInput
        id="new-password"
        label="Password"
        autoComplete="new-password"
        enterKeyHint="done"
        required
        minLength={MIN_PASSWORD}
        maxLength={128}
        value={values.password}
        onChange={set('password')}
        onBlur={blur('password')}
        error={errors.password}
        aside={
          passwordLength > 0 ? (
            <span className={passwordLength >= MIN_PASSWORD ? 'text-fresh' : undefined}>
              {passwordLength}/{MIN_PASSWORD}+
            </span>
          ) : undefined
        }
        hint="Almeno 10 caratteri. Una frase lunga è più sicura di simboli strani."
      />
      <GenrePicker value={genres} onChange={setGenres} disabled={submitting} />
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        loadingLabel="Creazione account…"
        leadingIcon={<Sparkle aria-hidden="true" weight="bold" />}
      >
        Crea account
      </Button>
      <p className="text-center text-sm text-ink-secondary">
        Hai già un account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-accent underline-offset-2 hover:underline"
        >
          Accedi
        </button>
      </p>
    </form>
  );
}
