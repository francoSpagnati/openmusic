'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WS_EVENTS,
  type CatalogTrack,
  type ChatMessage,
  type ChatReactionType,
} from '@openmusic/shared';
import { api } from '@/lib/api';
import { useSocket, useSocketEvent } from '@/lib/socket';
import { useToast } from '@/components/ui';
import { errorMessage } from '@/components/web-core/format';
import { useApiResource, type ApiResource } from '@/components/web-core/useApiResource';
import { upsertMessage } from './chatFormat';

/** A message the user sent that the server has not confirmed (yet). */
export interface OutgoingMessage {
  tempId: string;
  content: string | null;
  track: CatalogTrack | null;
  createdAt: string;
  status: 'sending' | 'failed';
  error: string | null;
}

export interface Conversation extends ApiResource<ChatMessage[]> {
  outbox: OutgoingMessage[];
  send: (input: { content?: string; track?: CatalogTrack | null }) => void;
  retry: (tempId: string) => void;
  discard: (tempId: string) => void;
  react: (messageId: string, reaction: ChatReactionType | null) => void;
  markListened: (messageId: string) => void;
}

let tempCounter = 0;

/**
 * One conversation: history, live incoming messages, read receipts and an optimistic outbox
 * (sent messages show at once, failures stay on screen with Retry/Discard).
 */
export function useConversation(
  peerId: string,
  callbacks: { onSent: (message: ChatMessage) => void; onRead: () => void }
): Conversation {
  const conversation = useApiResource(`chat:conversation:${peerId}`, () =>
    api.chat.conversation(peerId)
  );
  const { setData, reload, status } = conversation;
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const { notify } = useToast();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const outboxRef = useRef(outbox);
  outboxRef.current = outbox;

  useEffect(() => setOutbox([]), [peerId]);

  // Read receipts: when the history arrives and whenever the tab comes back into view.
  const markRead = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    callbacksRef.current.onRead();
    api.chat.markConversationRead(peerId).catch(() => {
      // Unread state is cosmetic; the next visit retries.
    });
  }, [peerId]);

  useEffect(() => {
    if (status !== 'success') return;
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [status, markRead]);

  useSocketEvent(WS_EVENTS.SERVER_CHAT_MESSAGE, (message) => {
    if (message.senderId !== peerId) return;
    setData((prev) => (prev ? upsertMessage(prev, message) : prev));
    markRead();
  });

  // The friend listened to one of our tracks: refresh to show the "Ascoltato" tick.
  useSocketEvent(WS_EVENTS.SERVER_NOTIFICATION, (notification) => {
    if (notification.type === 'TRACK_LISTENED' && notification.actor?.id === peerId) reload();
  });

  const { connected } = useSocket();
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) reload();
    wasConnected.current = connected;
  }, [connected, reload]);

  const deliver = useCallback(
    (item: OutgoingMessage) => {
      api.chat
        .send({
          receiverId: peerId,
          content: item.content ?? undefined,
          trackId: item.track?.id,
        })
        .then((message) => {
          setOutbox((prev) => prev.filter((o) => o.tempId !== item.tempId));
          setData((prev) => upsertMessage(prev ?? [], message));
          callbacksRef.current.onSent(message);
        })
        .catch((err: unknown) => {
          setOutbox((prev) =>
            prev.map((o) =>
              o.tempId === item.tempId
                ? { ...o, status: 'failed', error: errorMessage(err, 'Messaggio non inviato.') }
                : o
            )
          );
        });
    },
    [peerId, setData]
  );

  const send = useCallback(
    ({ content, track }: { content?: string; track?: CatalogTrack | null }) => {
      const text = content?.trim() || null;
      if (!text && !track) return;
      const item: OutgoingMessage = {
        tempId: `local-${++tempCounter}`,
        content: text,
        track: track ?? null,
        createdAt: new Date().toISOString(),
        status: 'sending',
        error: null,
      };
      setOutbox((prev) => [...prev, item]);
      deliver(item);
    },
    [deliver]
  );

  const retry = useCallback(
    (tempId: string) => {
      const item = outboxRef.current.find((o) => o.tempId === tempId);
      if (!item) return;
      const next: OutgoingMessage = { ...item, status: 'sending', error: null };
      setOutbox((prev) => prev.map((o) => (o.tempId === tempId ? next : o)));
      deliver(next);
    },
    [deliver]
  );

  const discard = useCallback(
    (tempId: string) => setOutbox((prev) => prev.filter((o) => o.tempId !== tempId)),
    []
  );

  /** Applies a local change and reverts it if the server refuses. */
  const optimistic = useCallback(
    (
      messageId: string,
      patch: Partial<ChatMessage>,
      request: () => Promise<ChatMessage>,
      failTitle: string
    ) => {
      let previous: ChatMessage | undefined;
      setData(
        (prev) =>
          prev?.map((m) => {
            if (m.id !== messageId) return m;
            previous = m;
            return { ...m, ...patch };
          }) ?? prev
      );
      request()
        .then((message) => setData((prev) => (prev ? upsertMessage(prev, message) : prev)))
        .catch((err: unknown) => {
          if (previous) {
            const restore = previous;
            setData((prev) => (prev ? upsertMessage(prev, restore) : prev));
          }
          notify({ tone: 'error', title: failTitle, description: errorMessage(err) });
        });
    },
    [setData, notify]
  );

  const react = useCallback(
    (messageId: string, reaction: ChatReactionType | null) =>
      optimistic(
        messageId,
        { reaction },
        () => api.chat.react(messageId, reaction),
        'Reazione non salvata'
      ),
    [optimistic]
  );

  const markListened = useCallback(
    (messageId: string) =>
      optimistic(
        messageId,
        { isListened: true },
        () => api.chat.markListened(messageId),
        'Non siamo riusciti a segnarlo come ascoltato'
      ),
    [optimistic]
  );

  return { ...conversation, outbox, send, retry, discard, react, markListened };
}
