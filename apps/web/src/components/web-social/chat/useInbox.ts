'use client';

import { useCallback, useEffect, useRef } from 'react';
import { WS_EVENTS, type ChatMessage, type ConversationSummary } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useSocket, useSocketEvent } from '@/lib/socket';
import { useApiResource, type ApiResource } from '@/components/web-core/useApiResource';

export type ChatPeer = ConversationSummary['otherUser'];

export interface Inbox extends ApiResource<ConversationSummary[]> {
  /** Zeroes the unread badge of one conversation (after it was read). */
  markRead: (otherUserId: string) => void;
  /** Moves a conversation to the top with the message just sent. */
  recordSent: (peer: ChatPeer, message: ChatMessage) => void;
}

function byLatest(a: ConversationSummary, b: ConversationSummary): number {
  return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt);
}

/**
 * Chat inbox kept live: incoming `chat:message` events update the preview and unread count (not
 * for the conversation open on screen), and a socket reconnect refetches what may have been missed.
 */
export function useInbox(enabled: boolean, activePeerId: string | null): Inbox {
  const inbox = useApiResource(enabled ? 'chat:inbox' : null, () => api.chat.conversations());
  const { setData, reload } = inbox;
  const dataRef = useRef(inbox.data);
  dataRef.current = inbox.data;
  const activeRef = useRef(activePeerId);
  activeRef.current = activePeerId;

  useSocketEvent(WS_EVENTS.SERVER_CHAT_MESSAGE, (message) => {
    const known = dataRef.current?.some((c) => c.otherUser.id === message.senderId);
    // A first message from someone new: we need their profile, so refetch the inbox.
    if (!known) {
      reload();
      return;
    }
    setData((prev) =>
      prev
        ? prev
            .map((c) =>
              c.otherUser.id === message.senderId
                ? {
                    ...c,
                    lastMessage: message,
                    unreadCount:
                      activeRef.current === message.senderId ? c.unreadCount : c.unreadCount + 1,
                  }
                : c
            )
            .sort(byLatest)
        : prev
    );
  });

  // Catch up after the socket drops and comes back (messages sent meanwhile were not pushed).
  const { connected } = useSocket();
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current && dataRef.current) reload();
    wasConnected.current = connected;
  }, [connected, reload]);

  const markRead = useCallback(
    (otherUserId: string) =>
      setData(
        (prev) =>
          prev?.map((c) => (c.otherUser.id === otherUserId ? { ...c, unreadCount: 0 } : c)) ?? prev
      ),
    [setData]
  );

  const recordSent = useCallback(
    (peer: ChatPeer, message: ChatMessage) =>
      setData((prev) => {
        const rest = (prev ?? []).filter((c) => c.otherUser.id !== peer.id);
        const existing = prev?.find((c) => c.otherUser.id === peer.id);
        return [
          { otherUser: peer, lastMessage: message, unreadCount: existing?.unreadCount ?? 0 },
          ...rest,
        ].sort(byLatest);
      }),
    [setData]
  );

  return { ...inbox, markRead, recordSent };
}
