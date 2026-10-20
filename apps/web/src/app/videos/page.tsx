'use client';

import React, { useState } from 'react';
import { VideoCamera, Play, Clock, YoutubeLogo, Tag, ArrowSquareOut } from '@phosphor-icons/react';
import { Sidebar } from '../../components/Sidebar';
import { ShareSongModal } from '../../components/ShareSongModal';

interface VideoEssay {
  id: string;
  title: string;
  creator: string;
  duration: string;
  platform: 'YOUTUBE' | 'VIMEO';
  thumbnailUrl: string;
  videoUrl: string;
  category: string;
  description: string;
  relatedRelease: string;
}

const SAMPLE_VIDEOS: VideoEssay[] = [
  {
    id: 'vid1',
    title: 'Perché In Rainbows dei Radiohead ha Cambiato la Storia della Musica',
    creator: 'Deep Cuts',
    duration: '18:45',
    platform: 'YOUTUBE',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=340&fit=crop',
    videoUrl: 'https://www.youtube.com',
    category: 'Video Saggio',
    description: 'Un\'analisi armonica e sociologica sull\'album del 2007 e sul modello distributivo pay-what-you-want.',
    relatedRelease: 'Radiohead — In Rainbows',
  },
  {
    id: 'vid2',
    title: 'La Produzione Sensoriale di Vespertine: I Micro-Beat del Freddo Islandese',
    creator: 'SoundField Archive',
    duration: '14:20',
    platform: 'YOUTUBE',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&h=340&fit=crop',
    videoUrl: 'https://www.youtube.com',
    category: 'Produzione Audio',
    description: 'Come Björk e Matmos hanno registrato il suono del ghiaccio che scricchiola e delle carte da gioco.',
    relatedRelease: 'Björk — Vespertine',
  },
  {
    id: 'vid3',
    title: 'L\'Anatomia di una Chitarra Mid-West Emo: Accordature Aperte e Tapping',
    creator: 'Analog Fretboard',
    duration: '22:10',
    platform: 'YOUTUBE',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&h=340&fit=crop',
    videoUrl: 'https://www.youtube.com',
    category: 'Masterclass',
    description: 'Dall\'accordatura DAEAC# di American Football fino all\'uso sapiente del capotasto mobile.',
    relatedRelease: 'American Football — LP1',
  },
  {
    id: 'vid4',
    title: 'Perché il Giappone degli Anni \'80 ha Prodotto la Musica Più Perfetta del Mondo',
    creator: 'Vinyl Voyage',
    duration: '26:35',
    platform: 'YOUTUBE',
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=340&fit=crop',
    videoUrl: 'https://www.youtube.com',
    category: 'Monografia Storica',
    description: 'La congiuntura economica della bolla finanziaria e l\'accesso agli studi di registrazione più costosi della storia.',
    relatedRelease: 'Mariya Takeuchi — Variety',
  },
];

export default function VideosPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('TUTTI');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const categories = ['TUTTI', 'Video Saggio', 'Produzione Audio', 'Masterclass', 'Monografia Storica'];

  const filteredVideos =
    selectedCategory === 'TUTTI'
      ? SAMPLE_VIDEOS
      : SAMPLE_VIDEOS.filter((v) => v.category === selectedCategory);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar onOpenCreatePost={() => setIsShareModalOpen(true)} />

      {/* 2. Main Content Area */}
      <main className="w-full flex-1 border-r border-om-border min-h-screen p-4 sm:p-8 space-y-8">
        {/* Header */}
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-om-amber/40 bg-om-amber/10 px-3.5 py-1 text-xs font-mono text-om-amber">
          <VideoCamera weight="duotone" className="h-4 w-4" />
          <span>Spazio Video-Contenuti & Saggi Musicali</span>
        </div>

        <h1 className="font-editorial text-4xl sm:text-5xl font-bold text-om-text">
          L’Approfondimento che la Musica Merita
        </h1>

        <p className="text-base text-om-secondary max-w-2xl leading-relaxed">
          I migliori video saggi, analisi armoniche e documentari musicali della rete,
          curati e collegati direttamente alle schede release e agli album ufficiali.
        </p>
      </section>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 border-b border-om-border">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-xs font-mono transition-colors whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-om-amber text-om-bg font-bold shadow-glow'
                : 'bg-om-card text-om-secondary hover:text-om-text hover:bg-om-interactive border border-om-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredVideos.map((video) => (
          <div
            key={video.id}
            className="group flex flex-col rounded-xl border border-om-border bg-om-card overflow-hidden hover:border-om-amber/60 hover:shadow-glow transition-all"
          >
            {/* Thumbnail with overlay duration */}
            <div className="relative aspect-video w-full bg-om-bg overflow-hidden">
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* Play overlay button */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-om-amber text-om-bg shadow-glow hover:scale-110 active:scale-95 transition-transform"
                  aria-label="Guarda video saggio"
                >
                  <Play weight="fill" className="h-6 w-6 ml-1" />
                </a>
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 text-xs font-mono text-om-text tabular-nums">
                <Clock size={12} />
                <span>{video.duration}</span>
              </div>

              {/* Platform tag */}
              <div className="absolute top-3 left-3 flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 text-[10px] font-mono text-om-secondary">
                <YoutubeLogo weight="fill" className="text-red-500 h-3.5 w-3.5" />
                <span>{video.platform}</span>
              </div>
            </div>

            {/* Video Metadata */}
            <div className="p-5 flex flex-col flex-1 justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-om-amber border border-om-border bg-om-interactive px-2 py-0.5 rounded">
                    {video.category}
                  </span>
                  <span className="text-xs text-om-secondary font-mono">
                    Canale: {video.creator}
                  </span>
                </div>

                <h3 className="font-editorial text-xl font-bold text-om-text group-hover:text-om-amber transition-colors line-clamp-2">
                  {video.title}
                </h3>

                <p className="text-xs text-om-secondary leading-relaxed line-clamp-2">
                  {video.description}
                </p>
              </div>

              <div className="pt-3 border-t border-om-border/50 flex items-center justify-between text-xs font-mono text-om-muted">
                <span className="truncate max-w-[240px]">Album: {video.relatedRelease}</span>
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-om-amber hover:underline flex-shrink-0"
                >
                  <span>Guarda</span>
                  <ArrowSquareOut size={14} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      </main>

      <ShareSongModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
