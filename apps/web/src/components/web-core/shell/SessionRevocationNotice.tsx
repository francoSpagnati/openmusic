'use client';

import { useCallback } from 'react';
import type { SessionRevoked } from '@openmusic/shared';
import { useSessionRevocation } from '@/lib/socket';
import { useToast } from '@/components/ui';

const REASON_TEXT: Record<SessionRevoked['reason'], string> = {
  LOGOUT: 'Sei uscito da OpenMusic.',
  PASSWORD_CHANGED: 'La password è stata cambiata da un altro dispositivo: accedi di nuovo.',
  EXPIRED: 'La sessione è scaduta: accedi di nuovo per continuare.',
  INVALID: 'La sessione non è più valida: accedi di nuovo per continuare.',
};

/** Listens for `session:revoked` on the app socket and explains a forced sign-out. */
export function SessionRevocationNotice() {
  const { notify } = useToast();
  const onSignedOut = useCallback(
    (reason: SessionRevoked['reason']) =>
      notify({ tone: 'neutral', title: 'Sessione terminata', description: REASON_TEXT[reason] }),
    [notify]
  );
  useSessionRevocation(onSignedOut);
  return null;
}
