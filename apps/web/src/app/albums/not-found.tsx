import React from 'react';
import Link from 'next/link';
import { buttonClasses, EmptyState } from '../../components/ui';
import { DiscoveryShell } from '../../components/discovery/DiscoveryShell';

export default function AlbumNotFound() {
  return (
    <DiscoveryShell>
      <EmptyState
        title="Questo album non è sui nostri scaffali"
        description="Il link potrebbe essere vecchio, oppure le sue edizioni sono state riorganizzate."
        action={
          <Link href="/explore" className={buttonClasses()}>
            Cerca nel catalogo
          </Link>
        }
      />
    </DiscoveryShell>
  );
}
