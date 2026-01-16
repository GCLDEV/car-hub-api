/**
 * 🏠 Room Handlers
 * 
 * Gerencia entrada e saída de salas de chat
 */

import type { Core } from '@strapi/strapi';
import type { AuthenticatedSocket } from '../index';

interface ConversationData {
  conversationId: string;
}

export function roomHandlers(socket: AuthenticatedSocket, strapi: Core.Strapi): void {

  // 🚪 Entrar em uma conversa
  socket.on('joinConversation', async (data: ConversationData) => {
    try {
      console.log(`🚪 ${socket.user.username} joining conversation: ${data.conversationId}`);

      // 🔍 Verificar se a conversa existe e se o usuário é participante
      const conversation = await strapi.documents('api::conversation.conversation').findOne({
        documentId: data.conversationId,
        populate: ['participants']
      });

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const isParticipant = conversation.participants.some((p: any) => p.documentId === socket.userId);
      if (!isParticipant) {
        socket.emit('error', { message: 'You are not a participant in this conversation' });
        return;
      }

      // 🏠 Entrar na sala
      const roomName = `conversation-${data.conversationId}`;
      socket.join(roomName);

      // 📊 Notificar outros usuários na conversa
      socket.to(roomName).emit('userJoinedConversation', {
        userId: socket.userId,
        username: socket.user.username,
        conversationId: data.conversationId
      });

      // ✅ Confirmar para o usuário
      socket.emit('joinedConversation', {
        conversationId: data.conversationId,
        roomName
      });

      console.log(`✅ ${socket.user.username} joined conversation ${data.conversationId}`);

    } catch (error: any) {
      console.error('❌ Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  // 🚪 Sair de uma conversa
  socket.on('leaveConversation', async (data: ConversationData) => {
    try {
      console.log(`🚪 ${socket.user.username} leaving conversation: ${data.conversationId}`);

      const roomName = `conversation-${data.conversationId}`;
      
      // 🏠 Sair da sala
      socket.leave(roomName);

      // 📊 Notificar outros usuários na conversa
      socket.to(roomName).emit('userLeftConversation', {
        userId: socket.userId,
        username: socket.user.username,
        conversationId: data.conversationId
      });

      // ✅ Confirmar para o usuário
      socket.emit('leftConversation', {
        conversationId: data.conversationId
      });

      console.log(`✅ ${socket.user.username} left conversation ${data.conversationId}`);

    } catch (error: any) {
      console.error('❌ Error leaving conversation:', error);
      socket.emit('error', { message: 'Failed to leave conversation' });
    }
  });

  // 👥 Listar usuários online na conversa
  socket.on('getOnlineUsers', async (data: ConversationData) => {
    try {
      const roomName = `conversation-${data.conversationId}`;
      const socketsInRoom = await socket.in(roomName).fetchSockets();
      
      const onlineUsers = socketsInRoom.map((s: any) => ({
        userId: s.userId,
        username: s.user.username
      }));

      socket.emit('onlineUsers', {
        conversationId: data.conversationId,
        users: onlineUsers
      });

    } catch (error: any) {
      console.error('❌ Error fetching online users:', error);
      socket.emit('error', { message: 'Failed to fetch online users' });
    }
  });

  // 🔄 Auto-rejoin em conversas ativas (usado quando o cliente reconecta)
  socket.on('rejoinActiveConversations', async () => {
    try {
      // 🔍 Buscar conversas ativas do usuário usando Strapi v5 API
      const conversations = await strapi.documents('api::conversation.conversation').findMany({
        filters: {
          participants: {
            documentId: socket.userId
          }
        },
        populate: ['participants'],
        sort: { updatedAt: 'desc' }
      });

      for (const conversation of conversations) {
        const roomName = `conversation-${conversation.documentId}`;
        socket.join(roomName);
        
        // Notificar outros na sala (silenciosamente)
        socket.to(roomName).emit('userReconnected', {
          userId: socket.userId,
          username: socket.user.username,
          conversationId: conversation.documentId
        });
      }

      // ✅ Confirmar rejoin
      socket.emit('rejoinedConversations', {
        count: conversations.length,
        conversationIds: conversations.map((c: any) => c.documentId)
      });

      console.log(`🔄 ${socket.user.username} rejoined ${conversations.length} conversations`);

    } catch (error: any) {
      console.error('❌ Error rejoining conversations:', error);
      socket.emit('error', { message: 'Failed to rejoin conversations' });
    }
  });
}