import type { ChatMessage, ChatReactionType } from '@openmusic/shared';

/** Deep link to a conversation (`/chat?with=<userId>`). */
export function chatHref(userId: string): string {
  return `/chat?with=${encodeURIComponent(userId)}`;
}

export interface ReactionMeta {
  type: ChatReactionType;
  emoji: string;
  label: string;
}

const REACTION_META: Record<ChatReactionType, ReactionMeta> = {
  FIRE: { type: 'FIRE', emoji: '🔥', label: 'Fuoco' },
  HEART: { type: 'HEART', emoji: '❤️', label: 'Lo adoro' },
  NOT_FOR_ME: { type: 'NOT_FOR_ME', emoji: '🙅', label: 'Non fa per me' },
};

export const REACTIONS: readonly ReactionMeta[] = Object.values(REACTION_META);

export function reactionMeta(type: ChatReactionType): ReactionMeta {
  return REACTION_META[type];
}

const timeFormatter = new Intl.DateTimeFormat('it', { hour: '2-digit', minute: '2-digit' });
const dayFormatter = new Intl.DateTimeFormat('it', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const shortDayFormatter = new Intl.DateTimeFormat('it', { day: 'numeric', month: 'short' });

export function messageTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Day divider label: "Oggi", "Ieri", or "martedì 14 ottobre". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Ieri';
  return dayFormatter.format(new Date(iso));
}

/** Inbox timestamp: time today, otherwise a short date. */
export function inboxTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return startOfDay(date) === startOfDay(now) ? messageTime(iso) : shortDayFormatter.format(date);
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** One-line inbox preview of the last message. */
export function messagePreview(message: ChatMessage, mine: boolean): string {
  const prefix = mine ? 'Tu: ' : '';
  const text = message.content?.trim();
  if (text) return `${prefix}${text}`;
  if (message.track) return `${prefix}🎵 ${message.track.title} · ${message.track.artistName}`;
  return `${prefix}Messaggio`;
}

/** Adds or replaces a message by id, keeping chronological order. */
export function upsertMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const index = list.findIndex((m) => m.id === message.id);
  if (index >= 0) {
    const next = [...list];
    next[index] = message;
    return next;
  }
  return [...list, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
