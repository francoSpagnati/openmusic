'use client';

import React, { useState } from 'react';
import {
  X,
  MagnifyingGlass,
  Star,
  Tag,
  PaperPlaneTilt,
  Disc,
  Check,
} from '@phosphor-icons/react';

interface PresetTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  coverUrl: string;
  previewUrl: string;
}

const PRESET_TRACKS: PresetTrack[] = [
  {
    id: 'tr_1',
    title: 'Weird Fishes/Arpeggi',
    artist: 'Radiohead',
    album: 'In Rainbows',
    year: 2007,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'tr_2',
    title: 'Get Lucky (feat. Pharrell Williams)',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    year: 2013,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'tr_3',
    title: 'King Kunta',
    artist: 'Kendrick Lamar',
    album: 'To Pimp a Butterfly',
    year: 2015,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'tr_4',
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    year: 1973,
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&h=300&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'tr_5',
    title: 'Do I Wanna Know?',
    artist: 'Arctic Monkeys',
    album: 'AM',
    year: 2013,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
];

interface ShareSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare?: (post: any) => void;
}

export const ShareSongModal: React.FC<ShareSongModalProps> = ({ isOpen, onClose, onShare }) => {
  const [search, setSearch] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<PresetTrack>(PRESET_TRACKS[0]);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5.0);
  const [vibe, setVibe] = useState('#CapolavoroAssoluto');

  if (!isOpen) return null;

  const filteredTracks = PRESET_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.artist.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (onShare) {
      onShare({
        id: `post_${Date.now()}`,
        author: {
          name: 'Franco Spagnati',
          handle: '@francospagnati',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        },
        timeAgo: 'Adesso',
        content: comment,
        vibeTag: vibe,
        album: {
          id: 'rel_in_rainbows',
          title: selectedTrack.title,
          artist: selectedTrack.artist,
          coverUrl: selectedTrack.coverUrl,
          year: selectedTrack.year,
          criticScore: 94,
          userScore: 92,
        },
        userRating: rating,
        likesCount: 1,
        commentsCount: 0,
        hasLiked: false,
        trackPreviewUrl: selectedTrack.previewUrl,
      });
    } else {
      alert(`Hai condiviso "${selectedTrack.title}" con voto ${rating}/5.0!`);
    }

    setComment('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-om-border bg-om-card p-6 shadow-2xl z-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-om-border pb-3">
          <div className="flex items-center gap-2">
            <Disc weight="duotone" className="h-6 w-6 text-om-amber animate-[spin_8s_linear_infinite]" />
            <h3 className="font-editorial text-xl font-bold text-om-text">
              Condividi una Canzone
            </h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-om-secondary hover:bg-om-interactive hover:text-om-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Track selector search */}
          <div>
            <label className="block text-xs font-mono text-om-secondary mb-1.5">
              Seleziona la traccia che vuoi consigliare:
            </label>
            <div className="relative mb-2">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-om-secondary"
              />
              <input
                type="text"
                placeholder="Cerca per titolo o artista..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-om-border bg-om-bg pl-9 pr-3 py-2 text-xs text-om-text placeholder-om-muted focus:border-om-amber focus:outline-none"
              />
            </div>

            {/* Track choices list */}
            <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-om-border bg-om-bg p-1.5">
              {filteredTracks.map((track) => {
                const isSelected = selectedTrack.id === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => setSelectedTrack(track)}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-om-amber/20 border border-om-amber/40 text-om-amber'
                        : 'hover:bg-om-interactive text-om-text'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="h-8 w-8 rounded object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold truncate block">
                          {track.title}
                        </span>
                        <span className="text-[10px] text-om-secondary truncate block">
                          {track.artist} • {track.year}
                        </span>
                      </div>
                    </div>

                    {isSelected && <Check size={16} weight="bold" className="text-om-amber" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comment / Recommendation note */}
          <div>
            <label className="block text-xs font-mono text-om-secondary mb-1">
              Il tuo pensiero o recensione:
            </label>
            <textarea
              required
              rows={3}
              placeholder="Perché ami questa canzone? Cosa trasmette?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl border border-om-border bg-om-bg p-3 text-xs text-om-text placeholder-om-muted focus:border-om-amber focus:outline-none font-sans"
            />
          </div>

          {/* Rating and Vibe tags */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-om-secondary">Voto:</span>
              <div className="flex items-center gap-0.5 text-om-amber">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setRating(s)}
                    className="p-0.5 hover:scale-125 transition-transform"
                  >
                    <Star
                      weight={s <= rating ? 'fill' : 'regular'}
                      className="h-4 w-4"
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono font-bold text-om-amber ml-1">
                {rating.toFixed(1)}
              </span>
            </div>

            {/* Vibe selection */}
            <div className="flex items-center gap-1">
              {['#CapolavoroAssoluto', '#AscoltoNotturno', '#Vinile', '#DaBrividi'].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setVibe(v)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                    vibe === v
                      ? 'bg-om-amber text-om-bg border-om-amber font-bold'
                      : 'border-om-border text-om-secondary hover:text-om-text'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!comment.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans font-semibold py-3 text-xs transition-all shadow-glow hover:scale-[1.01] active:scale-98 disabled:opacity-50"
          >
            <PaperPlaneTilt weight="bold" className="h-4 w-4" />
            <span>Condividi nel Feed degli Amici</span>
          </button>
        </form>
      </div>
    </div>
  );
};
