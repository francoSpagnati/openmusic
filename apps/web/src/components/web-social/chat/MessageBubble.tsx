'use client';

import React from 'react';
import { Checks, Check, WarningCircle } from '@phosphor-icons/react';
import type { CatalogTrack, ChatMessage, ChatReactionType } from '@openmusic/shared';
import { Button, Spinner, cn } from '@/components/ui';
import { absoluteTime } from '@/components/web-core/format';
import { SharedTrackCard } from './SharedTrackCard';
import { messageTime } from './chatFormat';
import type { OutgoingMessage } from './useConversation';

function Bubble({
  mine,
  content,
  track,
  pending = false,
  children,
}: {
  mine: boolean;
  /** Not yet confirmed: the words fade a little, the status line stays fully legible. */
  pending?: boolean;
  content: string | null | undefined;
  track: React.ReactNode;
  children?: React.ReactNode;
}) {
  // Calm thread: the friend's words sit on the page, mine on a soft stone surface.
  return (
    <div className={cn('flex flex-col gap-1.5', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'w-full space-y-3 transition-opacity duration-base ease-out',
          pending && 'opacity-60',
          mine ? 'max-w-[85%] sm:max-w-[75%]' : 'max-w-[92%]'
        )}
      >
        {content && (
          <p
            className={cn(
              'w-fit whitespace-pre-wrap break-words text-base leading-relaxed text-fg',
              mine && 'ml-auto rounded-xl bg-surface px-4 py-2.5'
            )}
          >
            {content}
          </p>
        )}
        {track}
      </div>
      {children}
    </div>
  );
}

/** A confirmed message from either side. */
export function MessageBubble({
  message,
  mine,
  peerName,
  showReceipt,
  onReact,
  onListened,
}: {
  message: ChatMessage;
  mine: boolean;
  peerName: string;
  /** Only the last message I sent shows "Letto/Consegnato" to keep the thread quiet. */
  showReceipt: boolean;
  onReact: (messageId: string, reaction: ChatReactionType | null) => void;
  onListened: (messageId: string) => void;
}) {
  const handleListened = React.useCallback(() => onListened(message.id), [onListened, message.id]);
  return (
    <Bubble
      mine={mine}
      content={message.content}
      track={
        message.track && (
          <SharedTrackCard
            track={message.track}
            links={message.universalLinks}
            mine={mine}
            isListened={message.isListened}
            reaction={message.reaction ?? null}
            peerName={peerName}
            onReact={mine ? undefined : (reaction) => onReact(message.id, reaction)}
            onListened={mine ? undefined : handleListened}
          />
        )
      }
    >
      <p className={cn('flex items-center gap-2 text-xs text-fg-subtle', mine && 'px-1')}>
        <time
          dateTime={message.createdAt}
          title={absoluteTime(message.createdAt)}
          className="font-mono tabular-nums"
        >
          {messageTime(message.createdAt)}
        </time>
        {mine && showReceipt && (
          <span className="inline-flex items-center gap-1">
            {message.readAt ? (
              <>
                <Checks aria-hidden="true" className="h-3.5 w-3.5" /> Letto
              </>
            ) : (
              <>
                <Check aria-hidden="true" className="h-3.5 w-3.5" /> Consegnato
              </>
            )}
          </span>
        )}
      </p>
    </Bubble>
  );
}

/** A message the server has not confirmed: "Invio…" or failed with Retry / Discard. */
export function OutgoingBubble({
  item,
  peerName,
  onRetry,
  onDiscard,
}: {
  item: OutgoingMessage;
  peerName: string;
  onRetry: (tempId: string) => void;
  onDiscard: (tempId: string) => void;
}) {
  const failed = item.status === 'failed';
  return (
    <div>
      <Bubble
        mine
        pending={!failed}
        content={item.content}
        track={item.track && <PendingTrack track={item.track} peerName={peerName} />}
      >
        {failed ? (
          <div role="alert" className="flex flex-wrap items-center justify-end gap-2 px-1">
            <span className="inline-flex items-center gap-1 text-xs text-rotten">
              <WarningCircle aria-hidden="true" weight="fill" className="h-3.5 w-3.5" />
              {item.error ?? 'Messaggio non inviato.'}
            </span>
            <Button size="sm" variant="secondary" onClick={() => onRetry(item.tempId)}>
              Riprova
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDiscard(item.tempId)}>
              Elimina
            </Button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-1 text-xs text-fg-subtle">
            <Spinner size="sm" label={null} /> Invio…
          </span>
        )}
      </Bubble>
    </div>
  );
}

function PendingTrack({ track, peerName }: { track: CatalogTrack; peerName: string }) {
  return (
    <SharedTrackCard track={track} mine isListened={false} reaction={null} peerName={peerName} />
  );
}
