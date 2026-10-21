'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Waveform } from '@phosphor-icons/react';
import type { ChatMessage } from '@openmusic/shared';
import { useFriendsPresence } from '@/lib/socket';
import { Avatar, EmptyState, ErrorState, Skeleton, buttonClasses } from '@/components/ui';
import { displayNameOf, errorMessage, profileHref } from '@/components/web-core/format';
import { isListening, presenceStatus } from '../presence/presence';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';
import type { ChatPeer } from './useInbox';
import { useConversation } from './useConversation';

interface ConversationPaneProps {
  peer: ChatPeer;
  viewerId: string;
  onSent: (message: ChatMessage) => void;
  onRead: () => void;
}

/** Header + thread + composer for one conversation. Key it by peer id. */
export function ConversationPane({ peer, viewerId, onSent, onRead }: ConversationPaneProps) {
  const conversation = useConversation(peer.id, { onSent, onRead });
  const name = displayNameOf(peer);

  return (
    <section aria-labelledby="conversation-title" className="flex min-h-0 flex-1 flex-col">
      <PeerHeader peer={peer} name={name} />

      {conversation.data === null ? (
        conversation.status === 'error' ? (
          <div className="flex flex-1 items-center p-4">
            <ErrorState
              title="La conversazione non si è caricata"
              description={errorMessage(conversation.error)}
              onRetry={conversation.reload}
            />
          </div>
        ) : (
          <ThreadSkeleton />
        )
      ) : conversation.data.length === 0 && conversation.outbox.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <EmptyState
            title={`Rompi il ghiaccio con ${name}`}
            description="Scrivi due righe o consigliagli un brano: riceverà l’anteprima di 30 secondi e i link per ascoltarlo ovunque."
          />
        </div>
      ) : (
        <MessageList
          messages={conversation.data}
          outbox={conversation.outbox}
          viewerId={viewerId}
          peerName={name}
          onReact={conversation.react}
          onListened={conversation.markListened}
          onRetry={conversation.retry}
          onDiscard={conversation.discard}
        />
      )}

      <ChatComposer
        peerName={name}
        onSend={(text) => conversation.send({ content: text })}
        onShareTrack={({ track, note }) => conversation.send({ track, content: note })}
      />
    </section>
  );
}

function PeerHeader({ peer, name }: { peer: ChatPeer; name: string }) {
  const { friends } = useFriendsPresence();
  const presence = friends.find((f) => f.userId === peer.id);
  const track = presence && isListening(presence) ? presence.currentlyPlaying : null;

  return (
    <header className="flex items-center gap-3 border-b border-line bg-canvas px-3 py-3 sm:px-4">
      <Link
        href="/chat"
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'md:hidden' })}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Tutte le conversazioni</span>
      </Link>
      <Link href={profileHref(peer)} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <Avatar
          name={name}
          src={peer.avatarUrl}
          size="md"
          status={presence ? presenceStatus(presence) : undefined}
          decorative
        />
      </Link>
      <div className="min-w-0 flex-1">
        <h2 id="conversation-title" className="truncate text-base font-semibold text-ink">
          <Link href={profileHref(peer)} className="hover:underline focus-visible:underline">
            {name}
          </Link>
        </h2>
        {track ? (
          <p className="flex min-w-0 items-center gap-1 text-xs text-fresh">
            <Waveform aria-hidden="true" weight="bold" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              In ascolto: {track.title} · {track.artistName}
            </span>
          </p>
        ) : (
          <p className="truncate font-mono text-xs text-ink-muted">
            @{peer.username}
            {presence?.isGhostMode ? ' · in Ghost Mode' : presence?.isOnline ? ' · online' : ''}
          </p>
        )}
      </div>
    </header>
  );
}

function ThreadSkeleton() {
  return (
    <div aria-busy="true" className="flex-1 space-y-5 overflow-hidden px-3 py-4 sm:px-5">
      <span className="sr-only">Caricamento dei messaggi…</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={i % 2 ? 'flex justify-end' : 'flex'}>
          <Skeleton
            shape="rect"
            className={i % 2 ? 'h-10 w-2/5 rounded-lg' : 'h-16 w-3/5 rounded-lg'}
          />
        </div>
      ))}
    </div>
  );
}
