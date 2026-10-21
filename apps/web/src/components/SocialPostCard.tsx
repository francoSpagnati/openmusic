'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookmarkSimple, Disc, Heart, MusicNote, Pause, Play, Trash } from '@phosphor-icons/react';
import type { Post } from '@openmusic/shared';
import { api } from '@/lib/api';
import { loginRedirectUrl, useAuth } from '@/lib/auth';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import {
  Button,
  Dialog,
  IconButton,
  RatingStars,
  cn,
  starsFromRating,
  useToast,
} from '@/components/ui';
import { CoverArt } from './discovery/CoverArt';
import { TimeAgo } from './web-core/TimeAgo';
import { UserIdentity } from './web-core/UserIdentity';
import { compactNumber, displayNameOf, errorMessage, yearOf } from './web-core/format';

export interface SocialPostCardProps {
  post: Post;
  /** Called after the post was deleted (author, MODERATOR or ADMIN). */
  onRemoved?: (postId: string) => void;
}

/**
 * A feed post: text, optional release "sleeve" with a 30s preview, rating and vibe tags.
 * ADR-002: likes and private saves only; conversation happens in chat.
 */
export function SocialPostCard({ post, onRemoved }: SocialPostCardProps) {
  const { user } = useAuth();
  const canDelete =
    user !== null &&
    (user.id === post.author.id || user.role === 'MODERATOR' || user.role === 'ADMIN');
  const authorName = displayNameOf(post.author);

  return (
    <article
      aria-labelledby={`post-${post.id}-author`}
      className="border-b border-line px-4 py-5 transition-colors duration-fast hover:bg-surface/40 sm:px-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div id={`post-${post.id}-author`} className="min-w-0">
          <UserIdentity user={post.author} meta={<TimeAgo iso={post.createdAt} />} />
        </div>
        {canDelete && (
          <DeletePostButton post={post} authorName={authorName} onRemoved={onRemoved} />
        )}
      </header>

      <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">
        {post.content}
      </p>

      {post.vibeTags.length > 0 && (
        <ul aria-label="Vibe" className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {post.vibeTags.map((tag) => (
            <li key={tag} className="font-mono text-xs text-accent">
              #{tag.replace(/^#+/, '')}
            </li>
          ))}
        </ul>
      )}

      {post.release ? <ReleaseSleeve post={post} /> : post.track ? <TrackChip post={post} /> : null}

      <PostActions post={post} />
    </article>
  );
}

function PreviewButton({
  id,
  title,
  artist,
  coverUrl,
  previewUrl,
  className,
}: {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  previewUrl: string;
  className?: string;
}) {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();
  const playing = currentTrack?.id === id && isPlaying;
  return (
    <IconButton
      variant="solid"
      size="lg"
      pressed={playing}
      label={playing ? `Pausa anteprima di ${title}` : `Ascolta 30 secondi di ${title}`}
      icon={playing ? <Pause weight="fill" /> : <Play weight="fill" />}
      onClick={() => playTrack({ id, title, artist, coverUrl: coverUrl ?? undefined, previewUrl })}
      className={cn('rounded-full', className)}
    />
  );
}

function ReleaseSleeve({ post }: { post: Post }) {
  const release = post.release;
  if (!release) return null;
  const year = yearOf(release.releaseDate);
  const preview = release.previewTrack?.previewUrl ? release.previewTrack : null;

  return (
    <div className="om-sleeve mt-4 flex flex-col overflow-hidden sm:flex-row">
      <div className="relative aspect-square w-full shrink-0 bg-sunken sm:w-40">
        <CoverArt
          src={release.coverUrl}
          placeholderColor={release.dominantColor}
          alt={`Copertina di ${release.title}`}
          sizes="(min-width: 640px) 160px, 100vw"
          className="h-full w-full"
        />
        {preview?.previewUrl && (
          <PreviewButton
            id={`post-${post.id}`}
            title={preview.title}
            artist={preview.artistName}
            coverUrl={release.coverUrl}
            previewUrl={preview.previewUrl}
            className="absolute bottom-3 right-3 shadow-om-md"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="om-eyebrow">
            {post.rating !== null ? 'Recensione lampo' : 'In rotazione'}
            {year && <span className="tabular-nums"> · {year}</span>}
          </p>
          <h3 className="om-headline mt-1 line-clamp-2 text-xl text-ink">
            <Link
              href={`/releases/${release.id}`}
              className="hover:underline focus-visible:underline"
            >
              {release.title}
            </Link>
          </h3>
          <p className="truncate text-sm text-ink-secondary">{release.artistName}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {post.rating !== null ? (
            <RatingStars
              value={starsFromRating(post.rating)}
              size="sm"
              showValue
              label={`Voto di ${displayNameOf(post.author)}`}
            />
          ) : (
            <span className="font-mono text-xs text-ink-muted">Senza voto</span>
          )}
          {preview ? (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-muted">
              <MusicNote aria-hidden="true" /> {preview.title}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-ink-muted">Anteprima non disponibile</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackChip({ post }: { post: Post }) {
  const track = post.track;
  if (!track) return null;
  return (
    <div className="mt-4 flex items-center gap-3 rounded-md border border-line bg-sunken p-2.5">
      {track.previewUrl ? (
        <PreviewButton
          id={`post-${post.id}`}
          title={track.title}
          artist={track.artistName}
          coverUrl={track.coverUrl ?? null}
          previewUrl={track.previewUrl}
          className="h-10 w-10"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-muted"
        >
          <Disc />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{track.title}</p>
        <p className="truncate text-xs text-ink-secondary">{track.artistName}</p>
      </div>
      {post.rating !== null && (
        <RatingStars
          value={starsFromRating(post.rating)}
          size="sm"
          label="Voto"
          className="ml-auto"
        />
      )}
    </div>
  );
}

function PostActions({ post }: { post: Post }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useToast();
  const [liked, setLiked] = useState(post.isLikedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.isSavedByMe);
  const [busy, setBusy] = useState<'like' | 'save' | null>(null);

  useEffect(() => {
    setLiked(post.isLikedByMe);
    setLikeCount(post.likeCount);
    setSaved(post.isSavedByMe);
  }, [post.isLikedByMe, post.likeCount, post.isSavedByMe]);

  function requireLogin(): boolean {
    if (status === 'authenticated') return true;
    router.push(loginRedirectUrl(pathname ?? '/'));
    return false;
  }

  async function toggleLike() {
    if (!requireLogin() || busy) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    setBusy('like');
    try {
      const state = next ? await api.feed.like(post.id) : await api.feed.unlike(post.id);
      setLiked(state.isLikedByMe);
      setLikeCount(state.likeCount);
    } catch (err) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      notify({ tone: 'error', title: 'Mi piace non salvato', description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function toggleSave() {
    if (!requireLogin() || busy) return;
    const next = !saved;
    setSaved(next);
    setBusy('save');
    try {
      const state = next ? await api.feed.save(post.id) : await api.feed.unsave(post.id);
      setSaved(state.isSavedByMe);
      notify({
        tone: 'success',
        title: state.isSavedByMe ? 'Salvato nel tuo scaffale' : 'Rimosso dallo scaffale',
        description: state.isSavedByMe ? 'Lo vedi solo tu.' : undefined,
      });
    } catch (err) {
      setSaved(!next);
      notify({ tone: 'error', title: 'Salvataggio non riuscito', description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-1 text-ink-secondary">
      <button
        type="button"
        onClick={() => void toggleLike()}
        aria-pressed={liked}
        aria-label={`Mi piace, ${likeCount} in totale`}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 font-mono text-xs transition-colors duration-fast',
          'hover:bg-rotten/10 hover:text-rotten focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
          liked && 'text-rotten'
        )}
      >
        <Heart aria-hidden="true" weight={liked ? 'fill' : 'regular'} className="h-5 w-5" />
        <span className="tabular-nums" aria-hidden="true">
          {compactNumber(likeCount)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void toggleSave()}
        aria-pressed={saved}
        aria-label={saved ? 'Salvato nello scaffale' : 'Salva nello scaffale'}
        className={cn(
          'ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-fast',
          'hover:bg-accent/10 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
          saved && 'text-accent'
        )}
      >
        <BookmarkSimple
          aria-hidden="true"
          weight={saved ? 'fill' : 'regular'}
          className="h-5 w-5"
        />
      </button>
    </div>
  );
}

function DeletePostButton({
  post,
  authorName,
  onRemoved,
}: {
  post: Post;
  authorName: string;
  onRemoved?: (postId: string) => void;
}) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const own = user?.id === post.author.id;

  async function remove() {
    setDeleting(true);
    try {
      await api.feed.remove(post.id);
      setOpen(false);
      onRemoved?.(post.id);
      notify({ title: 'Post eliminato' });
    } catch (err) {
      notify({ tone: 'error', title: 'Eliminazione non riuscita', description: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <IconButton
        label={own ? 'Elimina il tuo post' : `Elimina il post di ${authorName}`}
        icon={<Trash />}
        size="sm"
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onClose={() => !deleting && setOpen(false)}
        size="sm"
        title="Eliminare questo post?"
        description={
          own
            ? 'Sparirà dal feed e dal tuo profilo, insieme ai mi piace. Non si può annullare.'
            : `Stai moderando un post di ${authorName}. Non si può annullare.`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={() => void remove()}
              loading={deleting}
              loadingLabel="Eliminazione…"
            >
              Elimina
            </Button>
          </>
        }
      />
    </>
  );
}
