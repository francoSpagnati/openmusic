'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import {
  Heart,
  ChatCircle,
  Repeat,
  BookmarkSimple,
  Play,
  Pause,
  Star,
  DotsThree,
  ArrowUpRight,
  Waveform,
} from '@phosphor-icons/react';

export interface SocialPostData {
  id: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  timeAgo: string;
  content: string;
  album: {
    id?: string;
    title: string;
    artist: string;
    coverUrl: string;
    year: number;
    previewUrl?: string;
  };
  rating?: number;
  vibeTag?: string;
  likesCount: number;
  commentsCount: number;
  repostsCount?: number;
}

export const SocialPostCard: React.FC<{ post: SocialPostData }> = ({ post }) => {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();
  const [likes, setLikes] = useState(post.likesCount);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isCurrentTrackPlaying =
    post.album.previewUrl &&
    currentTrack?.id === post.id &&
    isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (post.album.previewUrl) {
      playTrack({
        id: post.id,
        title: post.album.title,
        artist: post.album.artist,
        coverUrl: post.album.coverUrl,
        previewUrl: post.album.previewUrl,
      });
    }
  };

  const handleLike = () => {
    if (isLiked) {
      setLikes((prev) => prev - 1);
      setIsLiked(false);
    } else {
      setLikes((prev) => prev + 1);
      setIsLiked(true);
    }
  };

  return (
    <article className="border-b border-om-border bg-om-bg hover:bg-om-card/30 transition-colors p-4 sm:p-5">
      {/* Post Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatar}
            alt={post.author.name}
            className="h-10 w-10 rounded-full object-cover border border-om-border flex-shrink-0"
          />

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-sans font-bold text-sm text-om-text hover:underline cursor-pointer">
                {post.author.name}
              </span>
              <span className="text-xs font-mono text-om-secondary">
                {post.author.handle}
              </span>
              <span className="text-xs text-om-muted">•</span>
              <span className="text-xs font-mono text-om-secondary tabular-nums">
                {post.timeAgo}
              </span>
            </div>

            <p className="text-xs text-om-secondary mt-0.5">
              ha ascoltato e condiviso un disco
            </p>
          </div>
        </div>

        <button className="text-om-secondary hover:text-om-text p-1 rounded-md">
          <DotsThree size={20} weight="bold" />
        </button>
      </div>

      {/* Post Content / Review Quote */}
      <div className="mt-3 space-y-2">
        <p className="text-sm sm:text-base text-om-text/95 leading-relaxed font-sans">
          {post.content}
        </p>

        {post.vibeTag && (
          <span className="inline-block text-xs font-mono text-om-amber font-medium">
            {post.vibeTag}
          </span>
        )}
      </div>

      {/* Embedded Album Media Card (High Resolution Band Art) */}
      <div className="mt-3.5 rounded-xl border border-om-border bg-om-card overflow-hidden group hover:border-om-amber/60 transition-all">
        <div className="flex flex-col sm:flex-row items-stretch">
          {/* Album Cover with Play Trigger */}
          <div className="relative aspect-square sm:w-44 flex-shrink-0 bg-om-interactive overflow-hidden">
            <img
              src={post.album.coverUrl}
              alt={post.album.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />

            {/* Play Button Overlay */}
            {post.album.previewUrl && (
              <button
                onClick={handlePlay}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity"
                aria-label="Ascolta anteprima 30s"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-om-amber text-om-bg shadow-glow hover:scale-110 active:scale-95 transition-transform">
                  {isCurrentTrackPlaying ? (
                    <Pause weight="fill" className="h-6 w-6" />
                  ) : (
                    <Play weight="fill" className="h-6 w-6 ml-0.5" />
                  )}
                </div>
              </button>
            )}

            {isCurrentTrackPlaying && (
              <div className="absolute top-2 left-2 rounded-full bg-om-bg/90 px-2 py-0.5 text-[10px] font-mono text-om-amber flex items-center gap-1">
                <Waveform weight="bold" className="h-3 w-3 animate-pulse" />
                <span>30s Preview</span>
              </div>
            )}
          </div>

          {/* Album Metadata & Rating */}
          <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 space-y-3">
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/releases/${post.album.id || 'rel_in_rainbows'}`}
                  className="font-editorial text-lg sm:text-xl font-bold text-om-text hover:text-om-amber transition-colors line-clamp-1"
                >
                  {post.album.title}
                </Link>

                <Link
                  href={`/releases/${post.album.id || 'rel_in_rainbows'}`}
                  className="text-om-secondary hover:text-om-amber p-0.5"
                >
                  <ArrowUpRight size={16} />
                </Link>
              </div>

              <p className="text-sm text-om-secondary mt-0.5">
                {post.album.artist} • <span className="font-mono tabular-nums">{post.album.year}</span>
              </p>
            </div>

            {/* Rating Stars & Quick Play hint */}
            <div className="flex items-center justify-between border-t border-om-border/50 pt-3">
              {post.rating ? (
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-om-amber tabular-nums">
                  <div className="flex text-om-amber">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        weight={star <= Math.floor(post.rating || 0) ? 'fill' : 'regular'}
                        className="h-4 w-4"
                      />
                    ))}
                  </div>
                  <span>{post.rating.toFixed(1)}</span>
                </div>
              ) : (
                <span className="text-xs font-mono text-om-muted">Ascolto Consigliato</span>
              )}

              <span className="text-[11px] font-mono text-om-secondary hidden sm:inline">
                Premi play per ascoltare
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Social Actions Bar (Instagram / X Style) */}
      <div className="mt-4 flex items-center justify-between text-om-secondary text-xs font-mono pt-1">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 hover:text-om-rotten transition-colors ${
            isLiked ? 'text-om-rotten' : ''
          }`}
        >
          <Heart weight={isLiked ? 'fill' : 'regular'} size={18} />
          <span className="tabular-nums">{likes}</span>
        </button>

        <button className="flex items-center gap-1.5 hover:text-om-text transition-colors">
          <ChatCircle size={18} />
          <span className="tabular-nums">{post.commentsCount}</span>
        </button>

        <button className="flex items-center gap-1.5 hover:text-om-fresh transition-colors">
          <Repeat size={18} />
          <span className="tabular-nums">{post.repostsCount || 4}</span>
        </button>

        <button
          onClick={() => setIsSaved(!isSaved)}
          className={`flex items-center gap-1.5 hover:text-om-amber transition-colors ${
            isSaved ? 'text-om-amber' : ''
          }`}
          title="Salva nella tua collezione"
        >
          <BookmarkSimple weight={isSaved ? 'fill' : 'regular'} size={18} />
        </button>
      </div>
    </article>
  );
};
