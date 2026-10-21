import React from 'react';
import type { Metadata } from 'next';
import { Compass } from '@phosphor-icons/react/dist/ssr';
import type { GenreList, ReleasePage } from '@openmusic/shared';
import { api } from '../../lib/api';
import { DiscoveryShell, PageOpener } from '../../components/discovery/DiscoveryShell';
import { GenreRouletteInteractive } from '../../components/GenreRouletteInteractive';
import { ExploreClient } from './ExploreClient';
import { BROWSE_PAGE_SIZE, parseExploreParams, type RawSearchParams } from './params';

export const metadata: Metadata = {
  title: 'Esplora il catalogo',
  description:
    'Cerca album e brani, sfoglia per genere con il voto della critica e del pubblico e gira la roulette dei generi per uscire dalla bolla.',
};

// Scores change with every review: always render with fresh data.
export const dynamic = 'force-dynamic';

export default async function ExplorePage({ searchParams }: { searchParams: RawSearchParams }) {
  const params = parseExploreParams(searchParams);
  const [genres, page] = await Promise.allSettled([
    api.catalog.genres(),
    api.catalog.browse({
      genre: params.genre ?? undefined,
      sort: params.sort,
      limit: BROWSE_PAGE_SIZE,
    }),
  ]);
  const initialGenres: GenreList | null = genres.status === 'fulfilled' ? genres.value : null;
  const initialPage: ReleasePage | null = page.status === 'fulfilled' ? page.value : null;

  return (
    <DiscoveryShell className="space-y-10">
      <PageOpener
        eyebrow="Esplora · Catalogo"
        icon={<Compass weight="duotone" />}
        title="Trova la tua prossima ossessione"
        deck="Sfoglia gli scaffali per genere, cerca un disco o lascia scegliere alla roulette."
      />

      <ExploreClient
        // A new `?q=` from the global search box starts a fresh search.
        key={params.q}
        initialParams={params}
        initialGenres={initialGenres}
        initialPage={initialPage}
      />

      <section aria-labelledby="roulette-heading" className="space-y-4">
        <hr className="om-rule" />
        <h2 id="roulette-heading" className="om-headline text-2xl text-ink">
          Fuori dalla bolla
        </h2>
        <GenreRouletteInteractive />
      </section>
    </DiscoveryShell>
  );
}
