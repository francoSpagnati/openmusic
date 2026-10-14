'use client';

import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { RightSidebar } from '../components/RightSidebar';
import { StoriesListeningBar } from '../components/StoriesListeningBar';
import { CreatePostBox } from '../components/CreatePostBox';
import { SocialPostCard, SocialPostData } from '../components/SocialPostCard';
import { ShareSongModal } from '../components/ShareSongModal';
import { Sparkle, SlidersHorizontal } from '@phosphor-icons/react';

const INITIAL_POSTS: SocialPostData[] = [
  {
    id: 'post_1',
    author: {
      name: 'Elena Rossi',
      handle: '@elena_rossi',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
    },
    timeAgo: '18m fa',
    content:
      'Weird Fishes/Arpeggi resta una delle composizioni più ipnotiche e perfette mai registrate. L’intreccio delle tre chitarre pulite e la batteria sincopata di Phil Selway a metà traccia mi fanno venire i brividi ad ogni singolo ascolto in vinile.',
    vibeTag: '#CapolavoroAssoluto',
    album: {
      id: 'rel_in_rainbows',
      title: 'In Rainbows',
      artist: 'Radiohead',
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop',
      year: 2007,
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    rating: 5.0,
    likesCount: 34,
    commentsCount: 8,
    repostsCount: 12,
  },
  {
    id: 'post_2',
    author: {
      name: 'Marco Valenti',
      handle: '@marcov',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
    },
    timeAgo: '1h fa',
    content:
      'I sintetizzatori analogici e le linee di basso dal vivo di Random Access Memories suonano con una dinamica spaziale che nessun software VST potrà mai replicare. Giorgio by Moroder in cuffia è un viaggio che ridefinisce il concetto di produzione moderna.',
    vibeTag: '#SuonoAnalogico',
    album: {
      id: 'rel_vespertine',
      title: 'Random Access Memories',
      artist: 'Daft Punk',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop',
      year: 2013,
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    rating: 4.8,
    likesCount: 52,
    commentsCount: 14,
    repostsCount: 9,
  },
  {
    id: 'post_3',
    author: {
      name: 'Sofia Bianchi',
      handle: '@sofiab',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
    },
    timeAgo: '3h fa',
    content:
      'La fusione tra jazz libero con Thundercat e Kamasi Washington, funk e conscious hip-hop rende questo disco il manifesto sonoro di un intero decennio. Ogni rima è necessaria, non c’è una nota fuori posto.',
    vibeTag: '#PoesiaInMusica',
    album: {
      id: 'rel_kendrick',
      title: 'To Pimp a Butterfly',
      artist: 'Kendrick Lamar',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=600&fit=crop',
      year: 2015,
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    rating: 5.0,
    likesCount: 89,
    commentsCount: 21,
    repostsCount: 31,
  },
  {
    id: 'post_4',
    author: {
      name: 'Luca Grassi',
      handle: '@lucagrassi',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
    },
    timeAgo: '5h fa',
    content:
      'Riascoltato per la centesima volta Time dei Pink Floyd. Il solo di chitarra di David Gilmour a metà brano è probabilmente il più grande momento della storia della chitarra elettrica.',
    vibeTag: '#PietraMiliare',
    album: {
      id: 'rel_pink_floyd',
      title: 'The Dark Side of the Moon',
      artist: 'Pink Floyd',
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&h=600&fit=crop',
      year: 1973,
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    rating: 5.0,
    likesCount: 114,
    commentsCount: 37,
    repostsCount: 42,
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'FOR_YOU' | 'FOLLOWING'>('FOR_YOU');
  const [posts, setPosts] = useState<SocialPostData[]>(INITIAL_POSTS);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handlePostCreated = (newPost: SocialPostData) => {
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar onOpenCreatePost={() => setIsShareModalOpen(true)} />

      {/* 2. Center Column: Social Media Feed */}
      <main className="w-full max-w-2xl flex-1 border-r border-om-border min-h-screen">
        {/* Sticky Header with Feed Tabs */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-om-border bg-om-bg/85 backdrop-blur-md px-4 py-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('FOR_YOU')}
              className={`font-sans text-sm font-bold transition-colors pb-1 relative ${
                activeTab === 'FOR_YOU'
                  ? 'text-om-text'
                  : 'text-om-secondary hover:text-om-text'
              }`}
            >
              <span>Per Te</span>
              {activeTab === 'FOR_YOU' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-om-amber" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('FOLLOWING')}
              className={`font-sans text-sm font-bold transition-colors pb-1 relative ${
                activeTab === 'FOLLOWING'
                  ? 'text-om-text'
                  : 'text-om-secondary hover:text-om-text'
              }`}
            >
              <span>Seguiti</span>
              {activeTab === 'FOLLOWING' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-om-amber" />
              )}
            </button>
          </div>

          <button className="text-om-secondary hover:text-om-text p-1.5 rounded-lg hover:bg-om-card">
            <SlidersHorizontal size={18} />
          </button>
        </header>

        {/* Stories / Live Friends Listening Strip (Instagram Style with Popup) */}
        <StoriesListeningBar />

        {/* Create Post Input Box */}
        <CreatePostBox onPostCreated={handlePostCreated} />

        {/* Social Feed List */}
        <div className="divide-y divide-om-border">
          {posts.map((post) => (
            <SocialPostCard key={post.id} post={post} />
          ))}
        </div>
      </main>

      {/* 3. Right Sidebar */}
      <RightSidebar />

      {/* "Condividi una Canzone" Modal */}
      <ShareSongModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onShare={handlePostCreated}
      />
    </div>
  );
}
