'use client';

import React, { useRef, useState } from 'react';
import { EnvelopeSimple, SignIn } from '@phosphor-icons/react';
import { LoginInputSchema } from '@openmusic/shared';
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
import { PasswordInput } from './PasswordInput';

const FIELDS = ['email', ['password', 'current-password']] as const;

export function LoginForm({
  onSuccess,
  onSwitchToRegister,
}: {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}) {
  const { login } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next = zodFormErrors(parsed.error);
      setErrors(next);
      focusFirstError(formRef.current, next, FIELDS);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      await login(parsed.data);
      onSuccess();
    } catch (err) {
      const next: FormErrors =
        isApiError(err) && err.code === 'INVALID_CREDENTIALS'
          ? { [FORM_ERROR]: 'Email o password non corretti. Controlla e riprova.' }
          : apiFormErrors(err, 'Accesso non riuscito. Riprova tra poco.');
      setErrors(next);
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="login-heading"
      className="space-y-5"
    >
      <h2 id="login-heading" className="sr-only">
        Accedi
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
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        leadingIcon={<EnvelopeSimple />}
      />
      <PasswordInput
        id="current-password"
        label="Password"
        autoComplete="current-password"
        enterKeyHint="go"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        loadingLabel="Accesso in corso…"
        leadingIcon={<SignIn aria-hidden="true" weight="bold" />}
      >
        Accedi
      </Button>
      <p className="text-center text-sm text-ink-secondary">
        Prima volta qui?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold text-accent underline-offset-2 hover:underline"
        >
          Crea un account
        </button>
      </p>
    </form>
  );
}
