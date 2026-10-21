import React from 'react';
import Link from 'next/link';
import { buttonClasses, EmptyState } from '../../../components/ui';
import { DiscoveryShell } from '../../../components/discovery/DiscoveryShell';

export default function ReleaseNotFound() {
  return (
    <DiscoveryShell>
      <EmptyState
        title="Questo disco non è sui nostri scaffali"
        description="Il link potrebbe essere vecchio o il disco è stato rimosso dal catalogo."
        action={
          <Link href="/explore" className={buttonClasses()}>
            Cerca nel catalogo
          </Link>
        }
      />
    </DiscoveryShell>
  );
}
