import type { FastifyPluginAsync } from 'fastify';
import {
  SendMessageInputSchema,
  ReactToMessageInputSchema,
} from '@openmusic/shared';
import type { ChatService } from './chat.service';

export function createChatRoutes(chatService: ChatService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Invia messaggio / canzone consigliata
    fastify.post('/messages', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = SendMessageInputSchema.parse(request.body);
        const message = await chatService.sendMessage(decoded.userId, input);
        return reply.status(201).send(message);
      } catch (err) {
        return reply.status(401).send({ error: 'Non autorizzato o input non valido', details: String(err) });
      }
    });

    // 2. Recupera la conversazione tra l'utente corrente e un amico
    fastify.get('/conversation/:otherUserId', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const { otherUserId } = request.params as { otherUserId: string };
        const messages = await chatService.getConversation(decoded.userId, otherUserId);
        return reply.send(messages);
      } catch {
        return reply.status(401).send({ error: 'Non autorizzato' });
      }
    });

    // 3. Aggiunge una reazione rapida a un brano consigliato (FIRE / HEART / NOT_FOR_ME)
    fastify.post('/reaction', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const { messageId, reaction } = ReactToMessageInputSchema.parse(request.body);
        const updated = await chatService.reactToMessage(decoded.userId, messageId, reaction);
        return reply.send(updated);
      } catch {
        return reply.status(401).send({ error: 'Non autorizzato o payload invalido' });
      }
    });

    // 4. Marca il brano come ascoltato
    fastify.post('/listened', async (request, reply) => {
      try {
        await request.jwtVerify<{ userId: string }>();
        const { messageId } = request.body as { messageId: string };
        const res = await chatService.markTrackAsListened(messageId);
        return reply.send(res);
      } catch {
        return reply.status(401).send({ error: 'Non autorizzato' });
      }
    });
  };
}
