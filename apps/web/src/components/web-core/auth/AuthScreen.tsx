'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeNextPath, useAuth } from '@/lib/auth';
import { Card, Spinner, Tabs } from '@/components/ui';
import { BrandMark } from '../shell/BrandMark';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type Mode = 'login' | 'register';

/**
 * Sign in / sign up. The mode lives in `?mode=` so links like "Crea un account" deep-link to the
 * right tab; `?next=` brings the user back where they were.
 */
export function AuthScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAuth();
  const mode: Mode = params.get('mode') === 'register' ? 'register' : 'login';
  const next = safeNextPath(params.get('next'));

  // Already signed in (or just signed in): go to the destination.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  function switchMode(target: Mode) {
    const query = new URLSearchParams(params.toString());
    query.set('mode', target);
    router.replace(`/auth?${query.toString()}`, { scroll: false });
  }

  const done = () => router.replace(next);

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-start gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-center lg:gap-16 lg:py-16">
      <section aria-labelledby="auth-title" className="order-2 lg:order-1">
        <div className="hidden lg:block">
          <BrandMark />
        </div>
        <p className="om-eyebrow mt-0 lg:mt-10">Lato A · Benvenuto</p>
        <h1
          id="auth-title"
          className="om-headline mt-2 text-display-sm text-ink lg:text-display-md"
        >
          {mode === 'register' ? 'Apri il tuo scaffale.' : 'Bentornato al bancone.'}
        </h1>
        <p className="om-deck mt-3 max-w-md text-ink-secondary">
          {mode === 'register'
            ? 'Segui gli amici, scopri cosa stanno ascoltando adesso e dai il tuo voto ai dischi.'
            : 'Riprendi da dove avevi lasciato: il feed dei tuoi amici ti aspetta.'}
        </p>
        <hr className="om-rule my-8 max-w-md" />
        <ul className="max-w-md space-y-3 text-sm text-ink-secondary">
          <li className="flex gap-3">
            <span className="om-eyebrow w-10 shrink-0 pt-0.5">01</span>
            Ascolto in tempo reale con chi segui, con la Ghost Mode a portata di tocco.
          </li>
          <li className="flex gap-3">
            <span className="om-eyebrow w-10 shrink-0 pt-0.5">02</span>
            Voto del pubblico e della critica accreditata, fianco a fianco.
          </li>
          <li className="flex gap-3">
            <span className="om-eyebrow w-10 shrink-0 pt-0.5">03</span>
            Spotify e Last.fm si collegano dopo, dalle impostazioni: sono facoltativi.
          </li>
        </ul>
      </section>

      <div className="order-1 lg:order-2">
        <div className="mb-6 lg:hidden">
          <BrandMark compact />
        </div>
        <Card variant="surface" padding="lg" className="shadow-om-md">
          {status === 'authenticated' ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Spinner size="lg" label={null} />
              <p role="status" className="text-sm text-ink-secondary">
                Accesso effettuato. Ti stiamo portando al tuo feed…
              </p>
            </div>
          ) : (
            <Tabs
              label="Accesso o registrazione"
              variant="pill"
              value={mode}
              onValueChange={(id) => switchMode(id === 'register' ? 'register' : 'login')}
              panelClassName="pt-6"
              items={[
                {
                  id: 'login',
                  label: 'Accedi',
                  content: (
                    <LoginForm onSuccess={done} onSwitchToRegister={() => switchMode('register')} />
                  ),
                },
                {
                  id: 'register',
                  label: 'Registrati',
                  content: (
                    <RegisterForm onSuccess={done} onSwitchToLogin={() => switchMode('login')} />
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
