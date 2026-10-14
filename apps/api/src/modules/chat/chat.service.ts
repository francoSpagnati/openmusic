import type { PrismaClient } from '@prisma/client';
import type {
  ChatMessage,
  SendMessageInput,
  UniversalTrackLinks,
  ChatReactionType,
} from '@openmusic/shared';

export class ChatService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Genera i link universali di ascolto (ISRC) per qualsiasi player dell'amico
   */
  private buildUniversalLinks(track: {
    id: string;
    isrc: string | null;
    spotifyId: string | null;
    deezerId: string | null;
    title: string;
    artistName: string;
  }): UniversalTrackLinks {
    const spotify = track.spotifyId
      ? `https://open.spotify.com/track/${track.spotifyId}`
      : null;

    const deezer = track.deezerId
      ? `https://www.deezer.com/track/${track.deezerId}`
      : null;

    // Apple Music sfrutta ISRC come chiave canonica universale
    const appleMusic = track.isrc
      ? `https://music.apple.com/song?isrc=${encodeURIComponent(track.isrc)}`
      : `https://music.apple.com/search?term=${encodeURIComponent(`${track.artistName} ${track.title}`)}`;

    const openmusic = `https://openmusic.app/track/${track.id}`;

    return { spotify, appleMusic, deezer, openmusic };
  }

  /**
   * Invia un consiglio musicale in chat con traduzione universale del link
   */
  async sendMessage(senderId: string, input: SendMessageInput): Promise<ChatMessage> {
    const { receiverId, content, trackId } = input;

    const message = await this.prisma.chatMessage.create({
      data: {
        senderId,
        receiverId,
        content: content?.trim() || null,
        trackId: trackId || null,
      },
      include: {
        track: {
          include: { release: true },
        },
      },
    });

    let universalLinks: UniversalTrackLinks | null = null;
    if (message.track) {
      universalLinks = this.buildUniversalLinks(message.track);
    }

    return {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      track: message.track
        ? {
            id: message.track.id,
            isrc: message.track.isrc,
            title: message.track.title,
            artistName: message.track.artistName,
            durationMs: message.track.durationMs,
            previewUrl: message.track.previewUrl,
            releaseId: message.track.releaseId,
            coverUrl: message.track.release.coverUrl,
          }
        : null,
      universalLinks,
      isListened: message.isListened,
      reaction: (message.reaction as ChatReactionType) ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Recupera i messaggi scambiati tra due utenti
   */
  async getConversation(userId: string, otherUserId: string): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      include: {
        track: {
          include: { release: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      track: m.track
        ? {
            id: m.track.id,
            isrc: m.track.isrc,
            title: m.track.title,
            artistName: m.track.artistName,
            durationMs: m.track.durationMs,
            previewUrl: m.track.previewUrl,
            releaseId: m.track.releaseId,
            coverUrl: m.track.release.coverUrl,
          }
        : null,
      universalLinks: m.track ? this.buildUniversalLinks(m.track) : null,
      isListened: m.isListened,
      reaction: (m.reaction as ChatReactionType) ?? null,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Aggiunge o rimuove una reazione rapida a un brano consigliato ("FIRE", "HEART", "NOT_FOR_ME")
   */
  async reactToMessage(
    userId: string,
    messageId: string,
    reaction: ChatReactionType | null
  ): Promise<ChatMessage> {
    const message = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { reaction },
      include: {
        track: {
          include: { release: true },
        },
      },
    });

    return {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      track: message.track
        ? {
            id: message.track.id,
            isrc: message.track.isrc,
            title: message.track.title,
            artistName: message.track.artistName,
            durationMs: message.track.durationMs,
            previewUrl: message.track.previewUrl,
            releaseId: message.track.releaseId,
            coverUrl: message.track.release.coverUrl,
          }
        : null,
      universalLinks: message.track ? this.buildUniversalLinks(message.track) : null,
      isListened: message.isListened,
      reaction: (message.reaction as ChatReactionType) ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Segna il brano consigliato come "Ascoltato"
   */
  async markTrackAsListened(messageId: string): Promise<{ success: boolean }> {
    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { isListened: true },
    });
    return { success: true };
  }
}
