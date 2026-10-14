'use client';

import React, { useState } from 'react';
import { Disc, Star, Tag, PaperPlaneTilt, Image as ImageIcon } from '@phosphor-icons/react';

interface CreatePostBoxProps {
  onPostCreated?: (post: any) => void;
}

export const CreatePostBox: React.FC<CreatePostBoxProps> = ({ onPostCreated }) => {
  const [content, setContent] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState('In Rainbows — Radiohead');
  const [rating, setRating] = useState(5.0);
  const [selectedVibe, setSelectedVibe] = useState('#Capolavoro');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (onPostCreated) {
      onPostCreated({
        id: `post_${Date.now()}`,
        author: {
          name: 'Franco Spagnati',
          handle: '@francospagnati',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        },
        timeAgo: 'Adesso',
        content,
        album: {
          title: 'In Rainbows',
          artist: 'Radiohead',
          coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&h=500&fit=crop',
          year: 2007,
          previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        },
        rating,
        vibeTag: selectedVibe,
        likesCount: 0,
        commentsCount: 0,
      });
    }

    setContent('');
    setIsExpanded(false);
  };

  return (
    <div className="border-b border-om-border bg-om-card/60 p-4 sm:p-5">
      <div className="flex gap-3.5">
        <img
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"
          alt="Avatar utente"
          className="h-10 w-10 rounded-full object-cover border border-om-border flex-shrink-0"
        />

        <form onSubmit={handleSubmit} className="flex-1 space-y-3">
          <textarea
            placeholder="Cosa stai ascoltando? Scrivi una recensione o consiglia un album agli amici..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            rows={isExpanded ? 3 : 2}
            className="w-full resize-none rounded-xl border border-om-border bg-om-bg/80 p-3 text-sm text-om-text placeholder-om-secondary focus:border-om-amber focus:outline-none font-sans"
          />

          {isExpanded && (
            <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-200">
              {/* Album selector tag */}
              <div className="flex items-center gap-1.5 rounded-lg border border-om-border bg-om-interactive px-2.5 py-1 text-xs text-om-text">
                <Disc weight="duotone" className="h-4 w-4 text-om-amber" />
                <span className="font-sans font-medium">{selectedAlbum}</span>
              </div>

              {/* Rating selector */}
              <div className="flex items-center gap-1 rounded-lg border border-om-border bg-om-interactive px-2 py-1 text-xs font-mono text-om-amber">
                <Star weight="fill" className="h-3.5 w-3.5" />
                <span>{rating.toFixed(1)}/5.0</span>
              </div>

              {/* Vibe tag */}
              <button
                type="button"
                onClick={() =>
                  setSelectedVibe(
                    selectedVibe === '#Capolavoro' ? '#AscoltoNotturno' : '#Capolavoro'
                  )
                }
                className="flex items-center gap-1 rounded-lg border border-om-border bg-om-interactive px-2 py-1 text-xs font-mono text-om-secondary hover:text-om-text"
              >
                <Tag size={12} />
                <span>{selectedVibe}</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-mono text-om-muted">
              Condividi con i tuoi follower
            </span>

            <button
              type="submit"
              disabled={!content.trim()}
              className="flex items-center gap-2 rounded-xl bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans font-semibold text-xs px-4 py-2 transition-all shadow-glow hover:scale-[1.02] disabled:opacity-40"
            >
              <PaperPlaneTilt weight="bold" className="h-3.5 w-3.5" />
              <span>Pubblica</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
