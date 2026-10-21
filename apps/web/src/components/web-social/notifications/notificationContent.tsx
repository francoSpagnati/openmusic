import React from 'react';
import type { Icon } from '@phosphor-icons/react';
import { ChatsCircle, Headphones, Heart, SealCheck, UserPlus } from '@phosphor-icons/react';
import type { NotificationItem, NotificationType } from '@openmusic/shared';
import { profileHref } from '@/components/web-core/format';
import { chatHref } from '../chat/chatFormat';

export interface NotificationContent {
  /** Sentence after the actor's name (or the whole sentence for system notifications). */
  text: React.ReactNode;
  /** Optional quoted context (post excerpt). */
  quote: string | null;
  href: string;
}

export const NOTIFICATION_ICON: Record<
  NotificationType,
  { icon: Icon; className: string; label: string }
> = {
  FOLLOW: { icon: UserPlus, className: 'text-accent', label: 'Nuovo follower' },
  POST_LIKE: { icon: Heart, className: 'text-rotten', label: 'Mi piace' },
  REVIEW_REACTION: { icon: ChatsCircle, className: 'text-mixed', label: 'Reazione' },
  TRACK_LISTENED: { icon: Headphones, className: 'text-fresh', label: 'Consiglio ascoltato' },
  CRITIC_APPROVED: { icon: SealCheck, className: 'text-accent', label: 'Accredito' },
};

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

/** Human copy and destination for each notification type. */
export function notificationContent(n: NotificationItem): NotificationContent {
  switch (n.type) {
    case 'FOLLOW':
      return {
        text: 'ha iniziato a seguirti. Ora vede i tuoi ascolti e le tue recensioni.',
        quote: null,
        href: n.actor ? profileHref(n.actor) : '/profile',
      };
    case 'POST_LIKE':
      return {
        text: 'ha apprezzato il tuo post.',
        quote: n.post?.excerpt ?? null,
        href: '/profile',
      };
    case 'REVIEW_REACTION': {
      const review = n.review;
      return {
        text: review?.releaseTitle ? (
          <>
            ha reagito alla tua recensione di <Strong>{review.releaseTitle}</Strong>
            {review.artistName ? ` di ${review.artistName}` : ''}.
          </>
        ) : (
          'ha reagito a una tua recensione.'
        ),
        quote: null,
        href: review?.releaseId ? `/releases/${encodeURIComponent(review.releaseId)}` : '/profile',
      };
    }
    case 'TRACK_LISTENED':
      return {
        text: n.track ? (
          <>
            ha ascoltato il brano che gli hai consigliato: <Strong>{n.track.title}</Strong> di{' '}
            {n.track.artistName}.
          </>
        ) : (
          'ha ascoltato il brano che gli hai consigliato.'
        ),
        quote: null,
        href: n.actor ? chatHref(n.actor.id) : '/chat',
      };
    case 'CRITIC_APPROVED':
      return {
        text: (
          <>
            <Strong>Benvenuto in redazione.</Strong> Il tuo accredito come critico è stato
            approvato: ora le tue recensioni contano nel voto della critica.
          </>
        ),
        quote: null,
        href: '/critics',
      };
  }
}
