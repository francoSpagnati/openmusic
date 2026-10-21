import type { FastifyPluginAsync } from 'fastify';
import {
  ConversationParamSchema,
  MarkListenedInputSchema,
  ReactToMessageInputSchema,
  SendMessageInputSchema,
} from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { ChatService } from './chat.service';

export function createChatRoutes(chatService: ChatService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/conversations', async (request) => {
      return chatService.listConversations(requireAuth(request).userId);
    });

    fastify.post('/messages', async (request, reply) => {
      const input = SendMessageInputSchema.parse(request.body);
      const message = await chatService.sendMessage(requireAuth(request).userId, input);
      return reply.status(201).send(message);
    });

    fastify.get('/conversation/:otherUserId', async (request) => {
      const { otherUserId } = ConversationParamSchema.parse(request.params);
      return chatService.getConversation(requireAuth(request).userId, otherUserId);
    });

    fastify.post('/conversation/:otherUserId/read', async (request) => {
      const { otherUserId } = ConversationParamSchema.parse(request.params);
      return chatService.markConversationRead(requireAuth(request).userId, otherUserId);
    });

    fastify.post('/reaction', async (request) => {
      const { messageId, reaction } = ReactToMessageInputSchema.parse(request.body);
      return chatService.reactToMessage(requireAuth(request).userId, messageId, reaction);
    });

    fastify.post('/listened', async (request) => {
      const { messageId } = MarkListenedInputSchema.parse(request.body);
      return chatService.markTrackAsListened(requireAuth(request).userId, messageId);
    });
  };
}
