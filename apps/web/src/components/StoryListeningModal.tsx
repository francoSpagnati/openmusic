'use client';

import React from 'react';
import Link from 'next/link';
import { ChatCircleText, EyeSlash, UserCircle } from '@phosphor-icons/react';
import type { FriendPresence, NowPlayingTrack } from '@openmusic/shared';
import { Avatar, Badge, Dialog, buttonClasses } from '@/components/ui';
import { CoverArt } from '@/components/discovery/CoverArt';
import { PreviewPlayButton } from '@/components/discovery/PreviewPlayButton';
import { formatTrackDuration } from '@/components/discovery/format';
import { displayNameOf, profileHref } from '@/components/web-core/format';
import { chatHref } from '@/components/web-social/chat/chatFormat';
import {
  PROVIDER_LABEL,
  estimatedProgressMs,
  isListening,
  presenceStatus,
  presenceToPlayingTrack,
} from '@/components/web-social/presence/presence';
import { useNow } from '@/components/web-social/presence/useNow';

interface StoryListeningModalProps {
  /** The friend whose "story" is open; `null` closes the dialog. */
  friend: FriendPresence | null;
  onClose: () => void;
}

/** What a followed user is listening to right now, with a 30s preview and a way to reply. */
export const StoryListeningModal: React.FC<StoryListeningModalProps> = ({ friend, onClose }) => {
  // Keep the last friend while the dialog animates out.
  const lastFriend = React.useRef<FriendPresence | null>(friend);
  if (friend) lastFriend.current = friend;
  const shown = friend ?? lastFriend.current;
  const name = shown ? displayNameOf(shown) : '';
  const listening = shown ? isListening(shown) : false;

  return (
    <Dialog
      open={friend !== null}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-3">
          {shown && (
            <Avatar
              name={name}
              src={shown.avatarUrl}
              size="md"
              status={presenceStatus(shown)}
              decorative
            />
          )}
          <span className="min-w-0">
            <span className="block truncate">{name}</span>
            {shown && (
              <span className="block truncate font-mono text-xs font-normal text-ink-muted">
                @{shown.username}
              </span>
            )}
          </span>
        </span>
      }
      description={shown ? statusLine(shown) : undefined}
      footer={
        shown && (
          <>
            <Link
              href={profileHref(shown)}
              onClick={onClose}
              className={buttonClasses({ variant: 'ghost' })}
            >
              <UserCircle aria-hidden="true" className="h-4 w-4" /> Profilo
            </Link>
            <Link href={chatHref(shown.userId)} onClick={onClose} className={buttonClasses()}>
              <ChatCircleText aria-hidden="true" className="h-4 w-4" />
              {listening ? 'Rispondi con un brano' : 'Scrivigli'}
            </Link>
          </>
        )
      }
    >
      {shown && listening && shown.currentlyPlaying ? (
        <NowPlayingSleeve track={shown.currentlyPlaying} friendName={name} />
      ) : shown?.isGhostMode ? (
        <p className="flex items-start gap-2 rounded-md bg-sunken p-4 text-sm text-ink-secondary">
          <EyeSlash aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {name} ascolta in privato. Rispettiamo la sua Ghost Mode: niente titoli, niente orari.
        </p>
      ) : (
        <p className="rounded-md bg-sunken p-4 text-sm text-ink-secondary">
          Il piatto di {name} è fermo. Perché non gli consigli qualcosa da mettere su?
        </p>
      )}
    </Dialog>
  );
};

function statusLine(friend: FriendPresence): string {
  if (friend.isGhostMode) return 'In Ghost Mode';
  const track = friend.currentlyPlaying;
  if (track?.isPlaying) return `In ascolto ora su ${PROVIDER_LABEL[track.provider]}`;
  return friend.isOnline ? 'Online, niente in riproduzione' : 'Offline';
}

function NowPlayingSleeve({ track, friendName }: { track: NowPlayingTrack; friendName: string }) {
  const now = useNow(1000, track.isPlaying);
  const progress = estimatedProgressMs(track, now);
  const percent = track.durationMs > 0 ? (progress / track.durationMs) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="relative mx-auto w-full max-w-[16rem] pr-8">
        {/* The record slides out of the sleeve, like on the shop counter. */}
        <span
          aria-hidden="true"
          className="om-grooves om-spin-record absolute inset-y-[6%] right-0 aspect-square rounded-full"
        />
        <CoverArt
          src={track.coverUrl}
          alt=""
          sizes="256px"
          className="relative aspect-square w-full rounded-sleeve shadow-sleeve"
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="om-headline truncate text-2xl text-ink">{track.title}</p>
          <p className="truncate text-sm text-ink-secondary">
            {track.artistName}
            {track.albumTitle ? <span className="italic"> · {track.albumTitle}</span> : null}
          </p>
        </div>
        <PreviewPlayButton
          track={presenceToPlayingTrack(track)}
          label={`${track.title} di ${track.artistName}`}
          size="lg"
        />
      </div>

      {/* Last.fm "now playing" has no duration (0): no progress bar to draw. */}
      {track.durationMs > 0 ? (
        <div>
          <div
            role="progressbar"
            aria-label={`Punto di ascolto di ${friendName}`}
            aria-valuemin={0}
            aria-valuemax={Math.round(track.durationMs / 1000)}
            aria-valuenow={Math.round(progress / 1000)}
            aria-valuetext={`${formatTrackDuration(progress)} di ${formatTrackDuration(track.durationMs)}`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
          >
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-xs tabular-nums text-ink-muted">
            <span>{formatTrackDuration(progress)}</span>
            <span>{formatTrackDuration(track.durationMs)}</span>
          </div>
        </div>
      ) : null}

      <Badge tone="live" size="sm" mono>
        Anteprima 30s · il brano intero resta su {PROVIDER_LABEL[track.provider]}
      </Badge>
    </div>
  );
}
