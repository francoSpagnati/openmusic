'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from '@phosphor-icons/react';
import type { ChatMessage, ChatReactionType } from '@openmusic/shared';
import { Button, cn } from '@/components/ui';
import { MessageBubble, OutgoingBubble } from './MessageBubble';
import { dayKey, dayLabel } from './chatFormat';
import type { OutgoingMessage } from './useConversation';

/** Distance from the bottom (px) under which the thread follows new messages. */
const STICKY_THRESHOLD = 120;

interface MessageListProps {
  messages: ChatMessage[];
  outbox: OutgoingMessage[];
  viewerId: string;
  peerName: string;
  onReact: (messageId: string, reaction: ChatReactionType | null) => void;
  onListened: (messageId: string) => void;
  onRetry: (tempId: string) => void;
  onDiscard: (tempId: string) => void;
}

/**
 * Scrollable thread (`role="log"`, so screen readers announce new messages politely). It opens on
 * the latest message, follows new ones while the reader is at the bottom, and otherwise offers a
 * "new messages" button instead of yanking the scroll position.
 */
export function MessageList({
  messages,
  outbox,
  viewerId,
  peerName,
  onReact,
  onListened,
  onRetry,
  onDiscard,
}: MessageListProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const lastMine = [...messages].reverse().find((m) => m.senderId === viewerId)?.id;
  const total = messages.length + outbox.length;
  const previousTotal = useRef(total);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    setUnseen(0);
  }, []);

  // Initial position: CSS `scroll-initial-target` on the last row where supported, JS otherwise.
  useLayoutEffect(() => {
    if (!CSS.supports('scroll-initial-target', 'nearest')) scrollToBottom('instant');
  }, [scrollToBottom]);

  useEffect(() => {
    const added = total - previousTotal.current;
    previousTotal.current = total;
    if (added <= 0) return;
    const newest = outbox.length > 0 ? null : messages[messages.length - 1];
    const sentByMe = outbox.length > 0 || newest?.senderId === viewerId;
    if (atBottom.current || sentByMe) scrollToBottom('smooth');
    else setUnseen((n) => n + added);
  }, [total, messages, outbox.length, viewerId, scrollToBottom]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_THRESHOLD;
    if (atBottom.current && unseen > 0) setUnseen(0);
  }

  const rows: React.ReactNode[] = [];
  let currentDay = '';
  messages.forEach((message, index) => {
    const key = dayKey(message.createdAt);
    if (key !== currentDay) {
      currentDay = key;
      rows.push(
        <li key={`day-${key}`} className="flex justify-center pt-2 first:pt-0">
          <h3 className="om-eyebrow">{dayLabel(message.createdAt)}</h3>
        </li>
      );
    }
    const isLast = index === messages.length - 1 && outbox.length === 0;
    rows.push(
      <li key={message.id} className={cn('om-fade', isLast && '[scroll-initial-target:nearest]')}>
        <MessageBubble
          message={message}
          mine={message.senderId === viewerId}
          peerName={peerName}
          showReceipt={message.id === lastMine}
          onReact={onReact}
          onListened={onListened}
        />
      </li>
    );
  });
  outbox.forEach((item) =>
    rows.push(
      <li key={item.tempId} className="om-fade">
        <OutgoingBubble item={item} peerName={peerName} onRetry={onRetry} onDiscard={onDiscard} />
      </li>
    )
  );

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-label={`Messaggi con ${peerName}`}
        tabIndex={0}
        className="h-full overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <ol className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-8 sm:px-6">{rows}</ol>
      </div>
      {unseen > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            className="om-fade pointer-events-auto bg-surface-raised"
            leadingIcon={<ArrowDown aria-hidden="true" weight="bold" />}
            onClick={() => scrollToBottom('smooth')}
          >
            {unseen === 1 ? '1 nuovo messaggio' : `${unseen} nuovi messaggi`}
          </Button>
        </div>
      )}
    </div>
  );
}
