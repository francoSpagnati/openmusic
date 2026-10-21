import type { Prisma, PrismaClient } from '@openmusic/db';
import type { SendMessageInputSchema } from '@openmusic/shared';
import type {
  ChatMessage,
  ChatReactionType,
  ConversationSummary,
  UniversalTrackLinks,
} from '@openmusic/shared';
import type { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { toCatalogTrack } from '../../lib/mappers';
import type { RealtimeEmitter } from '../../lib/realtime';
import type { NotificationsService } from '../notifications/notifications.service';

type SendMessageData = z.output<typeof SendMessageInputSchema>;

const MESSAGE_INCLUDE = {
  track: { include: { release: { select: { coverUrl: true } } } },
} satisfies Prisma.ChatMessageInclude;

type MessageRow = Prisma.ChatMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

const CHAT_REACTIONS: readonly ChatReactionType[] = ['FIRE', 'HEART', 'NOT_FOR_ME'];

function isChatReaction(value: string | null): value is ChatReactionType {
  return value !== null && (CHAT_REACTIONS as readonly string[]).includes(value);
}

const CONVERSATION_PAGE_SIZE = 50;

export class ChatService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeEmitter
  ) {}

  /** Universal listening links (ISRC-based) so the friend can open the track in any player. */
  private buildUniversalLinks(track: {
    id: string;
    isrc: string | null;
    spotifyId: string | null;
    deezerId: string | null;
    title: string;
    artistName: string;
  }): UniversalTrackLinks {
    return {
      spotify: track.spotifyId ? `https://open.spotify.com/track/${track.spotifyId}` : null,
      deezer: track.deezerId ? `https://www.deezer.com/track/${track.deezerId}` : null,
      appleMusic: track.isrc
        ? `https://music.apple.com/song?isrc=${encodeURIComponent(track.isrc)}`
        : `https://music.apple.com/search?term=${encodeURIComponent(`${track.artistName} ${track.title}`)}`,
      openmusic: `https://openmusic.app/track/${track.id}`,
    };
  }

  private toMessage(m: MessageRow): ChatMessage {
    return {
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      track: m.track ? toCatalogTrack(m.track) : null,
      universalLinks: m.track ? this.buildUniversalLinks(m.track) : null,
      isListened: m.isListened,
      reaction: isChatReaction(m.reaction) ? m.reaction : null,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }

  /** Sends a text and/or track recommendation and pushes it live to the receiver. */
  async sendMessage(senderId: string, input: SendMessageData): Promise<ChatMessage> {
    if (input.receiverId === senderId) throw new BadRequestError('Non puoi scrivere a te stesso');
    const receiver = await this.prisma.user.count({ where: { id: input.receiverId } });
    if (receiver === 0) throw new NotFoundError('Destinatario non trovato');

    const message = await this.prisma.chatMessage.create({
      data: {
        senderId,
        receiverId: input.receiverId,
        content: input.content?.trim() || null,
        trackId: input.trackId ?? null,
      },
      include: MESSAGE_INCLUDE,
    });
    const dto = this.toMessage(message);
    this.realtime.toUsers([input.receiverId], 'chat:message', dto);
    return dto;
  }

  /** Latest messages between the two users, oldest first. */
  async getConversation(userId: string, otherUserId: string): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      include: MESSAGE_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: CONVERSATION_PAGE_SIZE,
    });
    return messages.reverse().map((m) => this.toMessage(m));
  }

  /** Inbox: one row per counterpart with the last message and the unread count. */
  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const latest = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT ON (other_id) id
      FROM (
        SELECT id, "createdAt",
          CASE WHEN "senderId" = ${userId} THEN "receiverId" ELSE "senderId" END AS other_id
        FROM "ChatMessage"
        WHERE "senderId" = ${userId} OR "receiverId" = ${userId}
      ) t
      ORDER BY other_id, "createdAt" DESC, id DESC
    `;
    if (latest.length === 0) return [];

    const [messages, unread] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { id: { in: latest.map((l) => l.id) } },
        include: {
          ...MESSAGE_INCLUDE,
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          receiver: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.chatMessage.groupBy({
        by: ['senderId'],
        where: { receiverId: userId, readAt: null },
        _count: { _all: true },
      }),
    ]);
    const unreadBySender = new Map(unread.map((u) => [u.senderId, u._count._all]));

    return messages.map((m) => {
      const otherUser = m.senderId === userId ? m.receiver : m.sender;
      return {
        otherUser,
        lastMessage: this.toMessage(m),
        unreadCount: unreadBySender.get(otherUser.id) ?? 0,
      };
    });
  }

  /** Marks every message received from `otherUserId` as read. */
  async markConversationRead(userId: string, otherUserId: string): Promise<{ updated: number }> {
    const res = await this.prisma.chatMessage.updateMany({
      where: { senderId: otherUserId, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  /** Quick reaction to a recommended track. Only the receiver may react. */
  async reactToMessage(
    userId: string,
    messageId: string,
    reaction: ChatReactionType | null
  ): Promise<ChatMessage> {
    await this.requireReceivedMessage(userId, messageId);
    const message = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { reaction },
      include: MESSAGE_INCLUDE,
    });
    return this.toMessage(message);
  }

  /** The receiver marks a recommended track as listened; the sender is notified once. */
  async markTrackAsListened(userId: string, messageId: string): Promise<ChatMessage> {
    const existing = await this.requireReceivedMessage(userId, messageId);
    if (!existing.trackId) throw new BadRequestError('Il messaggio non contiene un brano');
    const message = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { isListened: true },
      include: MESSAGE_INCLUDE,
    });
    if (!existing.isListened) {
      await this.notifications.notify({
        recipientId: existing.senderId,
        actorId: userId,
        type: 'TRACK_LISTENED',
        chatMessageId: messageId,
      });
    }
    return this.toMessage(message);
  }

  private async requireReceivedMessage(userId: string, messageId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { receiverId: true, senderId: true, trackId: true, isListened: true },
    });
    if (!message) throw new NotFoundError('Messaggio non trovato');
    if (message.receiverId !== userId) {
      throw new ForbiddenError('Solo il destinatario può eseguire questa azione');
    }
    return message;
  }
}
