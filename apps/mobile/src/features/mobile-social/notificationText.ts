import type { Href } from 'expo-router';
import type { NotificationItem } from '@openmusic/shared';

export function actorName(n: NotificationItem): string {
  return n.actor ? (n.actor.displayName ?? n.actor.username) : 'OpenMusic';
}

/** Italian sentence for a notification row (also its accessibility label). */
export function describeNotification(n: NotificationItem): string {
  const who = actorName(n);
  switch (n.type) {
    case 'FOLLOW':
      return `${who} ha iniziato a seguirti`;
    case 'POST_LIKE':
      return `${who} ha apprezzato il tuo post${n.post ? `: “${n.post.excerpt}”` : ''}`;
    case 'REVIEW_REACTION':
      return `${who} ha reagito alla tua recensione${n.review?.releaseTitle ? ` di ${n.review.releaseTitle}` : ''}`;
    case 'TRACK_LISTENED':
      return `${who} ha ascoltato ${n.track ? `“${n.track.title}” di ${n.track.artistName}` : 'il brano che gli hai mandato'}`;
    case 'CRITIC_APPROVED':
      return 'Il tuo accredito da critico è stato approvato';
  }
}

/**
 * Where tapping a notification goes: the actor's profile for follows and likes (posts have no
 * detail screen), the release for review reactions, the chat for a listened track, your own
 * profile for system notices.
 */
export function notificationTarget(n: NotificationItem): Href | null {
  switch (n.type) {
    case 'FOLLOW':
    case 'POST_LIKE':
      return n.actor ? `/profile/${n.actor.id}` : null;
    case 'REVIEW_REACTION':
      return n.review?.releaseId
        ? `/release/${n.review.releaseId}`
        : n.actor
          ? `/profile/${n.actor.id}`
          : null;
    case 'TRACK_LISTENED':
      return n.actor ? `/chat/${n.actor.id}` : null;
    case 'CRITIC_APPROVED':
      return '/profile';
  }
}
