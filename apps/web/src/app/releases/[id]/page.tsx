import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DualScoreBadge } from '../../../components/DualScoreBadge';
import { ReleaseTracklistClient } from './ReleaseTracklistClient';
import {
  Disc,
  SealCheck,
  UsersThree,
  ArrowLeft,
  Calendar,
  Tag,
  ArrowSquareOut,
  ThumbsUp,
  Heart,
  ChatCircleText,
} from '@phosphor-icons/react/dist/ssr';

interface Props {
  params: { id: string };
}

// Sample release database for SSR and dynamic page generation
const SAMPLE_RELEASES_MAP: Record<string, any> = {
  rel_in_rainbows: {
    id: 'rel_in_rainbows',
    title: 'In Rainbows',
    artist: 'Radiohead',
    releaseYear: 2007,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&h=800&fit=crop',
    genre: 'Art Rock / Electronic',
    label: 'XL Recordings / Self-released',
    dominantColor: '#D97736',
    description:
      'Settimo album in studio della band britannica Radiohead. Pubblicato inizialmente a offerta libera su internet, è riconosciuto all\'unanimità come una delle pietre miliari della storia della musica per la perfetta fusione tra calore analogico e sperimentazione elettronica.',
    criticScore: {
      freshPercentage: 94,
      totalReviews: 38,
      status: 'FRESH',
    },
    audienceScore: {
      freshPercentage: 97,
      totalReviews: 1420,
      status: 'FRESH',
    },
    sideA: [
      { id: 't1', trackNumber: 1, title: '15 Step', duration: 237, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't2', trackNumber: 2, title: 'Bodysnatchers', duration: 242, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't3', trackNumber: 3, title: 'Nude', duration: 255, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't4', trackNumber: 4, title: 'Weird Fishes/Arpeggi', duration: 318, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't5', trackNumber: 5, title: 'All I Need', duration: 228, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
    ],
    sideB: [
      { id: 't6', trackNumber: 6, title: 'Faust Arp', duration: 129, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't7', trackNumber: 7, title: 'Reckoner', duration: 290, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't8', trackNumber: 8, title: 'House of Cards', duration: 328, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't9', trackNumber: 9, title: 'Jigsaw Falling Into Place', duration: 249, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
      { id: 't10', trackNumber: 10, title: 'Videotape', duration: 279, previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3' },
    ],
    criticReviews: [
      {
        id: 'cr1',
        outlet: 'Pitchfork',
        criticName: 'Mark Pytlik',
        rating: 93,
        quote: 'Un trionfo di songwriting organico e produzione intima che cattura i Radiohead al culmine della loro grazia.',
        url: 'https://pitchfork.com/reviews/albums/10762-in-rainbows/',
        publishedAt: '15 Ottobre 2007',
      },
      {
        id: 'cr2',
        outlet: 'The Needle Drop',
        criticName: 'Anthony Fantano',
        rating: 100,
        quote: 'La transizione ritmica e la stratificazione di Weird Fishes e Reckoner rappresentano una delle vette assolute del rock contemporaneo.',
        url: 'https://theneedledrop.com',
        publishedAt: 'Classics Review',
      },
      {
        id: 'cr3',
        outlet: 'OndaRock',
        criticName: 'Claudio Fabretti',
        rating: 90,
        quote: 'Un disco che scalda il cuore prima ancora della mente, dimostrando che la grandezza risiede nella purezza delle melodie.',
        url: 'https://ondarock.it',
        publishedAt: 'Pietre Miliari',
      },
    ],
    communityReviews: [
      {
        id: 'com1',
        userName: 'Matteo G.',
        rating: 5.0,
        isVerifiedListen: true,
        text: 'Ogni volta che parte Nude mi vengono i brividi. Il mix di chitarre pulite e percussioni sincopate in 15 Step è insuperabile.',
        reactions: { agree: 24, wellWritten: 12, discovered: 3 },
      },
      {
        id: 'com2',
        userName: 'Giulia V.',
        rating: 4.5,
        isVerifiedListen: true,
        text: 'Reckoner e Weird Fishes valgono da sole l\'intero disco. Una produzione che a distanza di quasi 20 anni suona ancora fresca e viva.',
        reactions: { agree: 19, wellWritten: 8, discovered: 0 },
      },
    ],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const release = SAMPLE_RELEASES_MAP[params.id] || SAMPLE_RELEASES_MAP.rel_in_rainbows;
  return {
    title: `${release.title} di ${release.artist} — Recensioni & Dual Score | OpenMusic`,
    description: `Scopri il Voto della Critica (${release.criticScore.freshPercentage}%) e del Pubblico (${release.audienceScore.freshPercentage}%) per ${release.title}. Ascolta l'anteprima vinilica Lato A / Lato B.`,
    openGraph: {
      title: `${release.title} — ${release.artist} (Dual Score)`,
      description: `Critic Score ${release.criticScore.freshPercentage}% • Audience Score ${release.audienceScore.freshPercentage}%`,
      images: [{ url: release.coverUrl }],
    },
  };
}

export default function ReleaseDetailPage({ params }: Props) {
  const release = SAMPLE_RELEASES_MAP[params.id] || SAMPLE_RELEASES_MAP.rel_in_rainbows;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Back button */}
      <div>
        <Link
          href="/#releases"
          className="inline-flex items-center gap-2 text-xs font-mono text-om-secondary hover:text-om-text transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Torna a tutte le release</span>
        </Link>
      </div>

      {/* Hero Release Header */}
      <section className="relative overflow-hidden rounded-2xl border border-om-border bg-om-card p-6 sm:p-10 shadow-2xl">
        {/* Dynamic cover ambient glow */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: release.dominantColor }}
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Cover Art */}
          <div className="md:col-span-4 lg:col-span-3">
            <div className="relative aspect-square w-full rounded-xl border border-om-border overflow-hidden shadow-2xl">
              <img
                src={release.coverUrl}
                alt={release.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Details & Dual Score */}
          <div className="md:col-span-8 lg:col-span-9 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-om-amber border border-om-border bg-om-interactive px-2.5 py-1 rounded">
                {release.genre}
              </span>
              <span className="text-xs font-mono text-om-secondary flex items-center gap-1.5">
                <Calendar size={14} /> {release.releaseYear}
              </span>
              <span className="text-xs font-mono text-om-secondary flex items-center gap-1.5">
                <Tag size={14} /> {release.label}
              </span>
            </div>

            <div>
              <h1 className="font-editorial text-3xl sm:text-5xl font-bold text-om-text">
                {release.title}
              </h1>
              <p className="text-lg sm:text-xl text-om-secondary mt-1 font-sans">
                {release.artist}
              </p>
            </div>

            <p className="text-sm text-om-secondary/90 leading-relaxed max-w-3xl">
              {release.description}
            </p>

            {/* Rotten Tomatoes Style Dual Score Card */}
            <div className="pt-4">
              <span className="text-xs font-mono uppercase tracking-wider text-om-muted block mb-2">
                Punteggio di Freschezza Ufficiale:
              </span>
              <DualScoreBadge
                criticScore={release.criticScore}
                audienceScore={release.audienceScore}
                size="lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Vinyl Tracklist (Lato A & Lato B) */}
      <ReleaseTracklistClient
        releaseTitle={release.title}
        artist={release.artist}
        coverUrl={release.coverUrl}
        sideA={release.sideA}
        sideB={release.sideB}
      />

      {/* Reviews Grid: Critics vs Community */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Critic Reviews (Accredited Outlets) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-om-border pb-3">
            <SealCheck weight="duotone" className="h-6 w-6 text-om-fresh" />
            <h2 className="font-editorial text-2xl font-bold text-om-text">
              Voti della Critica Accreditata
            </h2>
          </div>

          <div className="space-y-4">
            {release.criticReviews.map((cr: any) => (
              <div
                key={cr.id}
                className="rounded-xl border border-om-border bg-om-card p-5 space-y-3 hover:border-om-amber/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-editorial font-bold text-base text-om-text">
                      {cr.outlet}
                    </span>
                    <span className="text-xs text-om-secondary font-sans">• {cr.criticName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-om-fresh tabular-nums bg-om-fresh/10 border border-om-fresh/30 px-2 py-0.5 rounded">
                    <span>{cr.rating}%</span>
                  </div>
                </div>

                <p className="text-sm text-om-secondary italic font-serif leading-relaxed">
                  "{cr.quote}"
                </p>

                <div className="flex items-center justify-between text-xs text-om-muted font-mono pt-2 border-t border-om-border/40">
                  <span>{cr.publishedAt}</span>
                  <a
                    href={cr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-om-amber hover:underline"
                  >
                    <span>Leggi articolo completo</span>
                    <ArrowSquareOut size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Community Verified Reviews */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-om-border pb-3">
            <UsersThree weight="duotone" className="h-6 w-6 text-om-amber" />
            <h2 className="font-editorial text-2xl font-bold text-om-text">
              Recensioni del Pubblico
            </h2>
          </div>

          <div className="space-y-4">
            {release.communityReviews.map((com: any) => (
              <div
                key={com.id}
                className="rounded-xl border border-om-border bg-om-card p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-semibold text-sm text-om-text">
                      {com.userName}
                    </span>
                    {com.isVerifiedListen && (
                      <span className="text-[10px] font-mono text-om-fresh border border-om-fresh/30 bg-om-fresh/10 px-1.5 py-0.2 rounded">
                        Ascolto Verificato
                      </span>
                    )}
                  </div>

                  <div className="font-mono text-sm font-bold text-om-amber tabular-nums">
                    ★ {com.rating.toFixed(1)}
                  </div>
                </div>

                <p className="text-sm text-om-secondary leading-relaxed">{com.text}</p>

                {/* Constructive Reactions */}
                <div className="flex items-center gap-4 text-xs font-mono text-om-muted pt-2 border-t border-om-border/40">
                  <button className="flex items-center gap-1 hover:text-om-amber transition-colors">
                    <ThumbsUp size={14} /> <span>{com.reactions.agree} Concordo</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-om-amber transition-colors">
                    <ChatCircleText size={14} /> <span>{com.reactions.wellWritten} Ben scritta</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
