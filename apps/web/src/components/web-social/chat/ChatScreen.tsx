'use client';

import React, { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatCircleDots, NotePencil } from '@phosphor-icons/react';
import type { ChatMessage } from '@openmusic/shared';
import { api, isApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import { Button, EmptyState, ErrorState, IconButton, Skeleton, cn } from '@/components/ui';
import { Sidebar } from '@/components/Sidebar';
import { LiveFriendsTicker } from '@/components/LiveFriendsTicker';
import { errorMessage, isUuid } from '@/components/web-core/format';
import { useApiResource } from '@/components/web-core/useApiResource';
import { ConversationList, ConversationListSkeleton } from './ConversationList';
import { ConversationPane } from './ConversationPane';
import { NewChatDialog } from './NewChatDialog';
import { useInbox, type ChatPeer } from './useInbox';

/**
 * Two-pane chat: inbox + conversation side by side from `md`, one at a time on phones. The open
 * conversation lives in the URL (`/chat?with=<userId>`) so it can be linked, shared and restored
 * with the back button.
 */
export function ChatScreen() {
  const { ready, user } = useRequireAuth();
  const params = useSearchParams();
  const rawPeer = params.get('with');
  const peerId = rawPeer && isUuid(rawPeer) ? rawPeer : null;
  const inbox = useInbox(ready, peerId);
  const [composing, setComposing] = useState(false);
  const { currentTrack } = useAudioPlayer();

  const inboxPeer = inbox.data?.find((c) => c.otherUser.id === peerId)?.otherUser ?? null;
  // Someone you have never written to: load their public profile for the header.
  const needsProfile = ready && peerId !== null && inbox.status !== 'loading' && !inboxPeer;
  const profile = useApiResource<ChatPeer>(needsProfile ? `chat:peer:${peerId}` : null, () =>
    api.profile.byId(peerId ?? '').then(({ user: u }) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
    }))
  );
  const peer = inboxPeer ?? (profile.data?.id === peerId ? profile.data : null);

  const { recordSent, markRead } = inbox;
  const onSent = useCallback(
    (message: ChatMessage) => {
      if (peer) recordSent(peer, message);
    },
    [peer, recordSent]
  );
  const onRead = useCallback(() => {
    if (peerId) markRead(peerId);
  }, [peerId, markRead]);

  const showConversation = rawPeer !== null;

  return (
    <div className="mx-auto flex max-w-7xl justify-center">
      <Sidebar />
      <div
        className={cn(
          'sticky top-[3.75rem] flex h-[calc(100dvh-3.75rem)] min-w-0 max-w-5xl flex-1 border-line lg:top-0 lg:h-dvh lg:border-r',
          // Leave room for the fixed preview player so it never covers the composer.
          currentTrack && 'pb-24'
        )}
      >
        <h1 className="sr-only">Messaggi</h1>

        <section
          aria-labelledby="inbox-title"
          className={cn(
            'min-h-0 w-full flex-col border-line md:flex md:w-80 md:shrink-0 md:border-r',
            showConversation ? 'hidden' : 'flex'
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
            <div>
              <p className="om-eyebrow">Passaparola</p>
              <h2 id="inbox-title" className="om-headline text-2xl text-ink">
                Messaggi
              </h2>
            </div>
            <IconButton
              label="Nuova conversazione"
              icon={<NotePencil />}
              variant="outline"
              disabled={!ready}
              onClick={() => setComposing(true)}
            />
          </div>
          {ready && <LiveFriendsTicker variant="compact" />}
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
            {!ready || inbox.data === null ? (
              inbox.status === 'error' ? (
                <div className="p-4">
                  <ErrorState
                    variant="inline"
                    title="I messaggi non si sono caricati"
                    description={errorMessage(inbox.error)}
                    onRetry={inbox.reload}
                  />
                </div>
              ) : (
                <ConversationListSkeleton />
              )
            ) : inbox.data.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  size="compact"
                  title="Ancora nessuna conversazione"
                  description="Consiglia un brano a un amico: è il modo migliore per iniziare."
                  action={
                    <Button
                      variant="secondary"
                      leadingIcon={<NotePencil aria-hidden="true" />}
                      onClick={() => setComposing(true)}
                    >
                      Inizia una chat
                    </Button>
                  }
                />
              </div>
            ) : (
              <ConversationList
                conversations={inbox.data}
                activePeerId={peerId}
                viewerId={user?.id ?? ''}
              />
            )}
          </div>
        </section>

        <div
          className={cn('min-h-0 flex-1 flex-col md:flex', showConversation ? 'flex' : 'hidden')}
        >
          <ConversationArea
            ready={ready}
            rawPeer={rawPeer}
            peerId={peerId}
            viewerId={user?.id ?? null}
            peer={peer}
            profileError={profile.status === 'error' ? profile.error : null}
            onRetryProfile={profile.reload}
            onSent={onSent}
            onRead={onRead}
            onCompose={() => setComposing(true)}
          />
        </div>
      </div>

      {ready && user && (
        <NewChatDialog open={composing} onClose={() => setComposing(false)} viewerId={user.id} />
      )}
    </div>
  );
}

function ConversationArea({
  ready,
  rawPeer,
  peerId,
  viewerId,
  peer,
  profileError,
  onRetryProfile,
  onSent,
  onRead,
  onCompose,
}: {
  ready: boolean;
  rawPeer: string | null;
  peerId: string | null;
  viewerId: string | null;
  peer: ChatPeer | null;
  profileError: unknown;
  onRetryProfile: () => void;
  onSent: (message: ChatMessage) => void;
  onRead: () => void;
  onCompose: () => void;
}) {
  if (rawPeer === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<ChatCircleDots aria-hidden="true" />}
          title="Scegli una conversazione"
          description="Oppure iniziane una nuova e manda un disco a qualcuno."
          action={
            <Button variant="secondary" onClick={onCompose} disabled={!ready}>
              Nuova conversazione
            </Button>
          }
        />
      </div>
    );
  }

  const notFound =
    peerId === null ||
    peerId === viewerId ||
    (isApiError(profileError) && (profileError.status === 404 || profileError.status === 400));
  if (notFound) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          title="Conversazione non trovata"
          description={
            peerId !== null && peerId === viewerId
              ? 'Per gli appunti personali c’è il diario: qui si parla con gli amici.'
              : 'Il link non porta a nessun utente. Forse l’account è stato rimosso.'
          }
          action={
            <Button variant="secondary" onClick={onCompose} disabled={!ready}>
              Scrivi a qualcun altro
            </Button>
          }
        />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-1 items-center p-6">
        <ErrorState
          title="Non riusciamo ad aprire la conversazione"
          description={errorMessage(profileError)}
          onRetry={onRetryProfile}
        />
      </div>
    );
  }

  if (!ready || !peer || !viewerId) {
    return (
      <div aria-busy="true" className="flex flex-1 flex-col">
        <span className="sr-only">Caricamento della conversazione…</span>
        <div className="flex items-center gap-3 border-b border-line p-4">
          <Skeleton shape="circle" className="h-10 w-10" />
          <Skeleton shape="text" lines={2} className="max-w-[10rem]" />
        </div>
      </div>
    );
  }

  return (
    <ConversationPane
      key={peer.id}
      peer={peer}
      viewerId={viewerId}
      onSent={onSent}
      onRead={onRead}
    />
  );
}
