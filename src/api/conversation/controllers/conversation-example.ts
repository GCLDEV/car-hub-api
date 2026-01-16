/**
 * 💬 Example Message Controller
 * 
 * Exemplo de como usar o Socket.io em controllers com Strapi v5
 */

import { factories } from '@strapi/strapi';
import { SocketHelper } from '../../../sockets/helper';

export default factories.createCoreController('api::conversation.conversation', ({ strapi }) => ({
  
  /**
   * 📤 Criar uma nova conversa (exemplo de integração)
   */
  async createConversation(ctx: any) {
    try {
      const { participantIds, name, type = 'private' } = ctx.request.body;
      const currentUserId = ctx.state.user.id;

      // Adicionar o usuário atual aos participantes
      const allParticipants = [...new Set([currentUserId, ...participantIds])];

      // 💾 Criar conversa no banco usando Strapi v5 API
      const conversation = await strapi.documents('api::conversation.conversation').create({
        data: {
          name,
          type,
          participants: allParticipants.map(id => ({ documentId: id })),
          publishedAt: new Date()
        },
        populate: {
          participants: {
            fields: ['id', 'username']
          }
        }
      });

      // 🔔 Notificar via Socket.io
      SocketHelper.notifyConversationCreated(
        conversation.documentId, 
        allParticipants, 
        conversation
      );

      ctx.body = {
        data: conversation,
        meta: { message: 'Conversation created successfully' }
      };

    } catch (error: any) {
      console.error('❌ Error creating conversation:', error);
      ctx.throw(500, 'Failed to create conversation');
    }
  },

  /**
   * 🗑️ Deletar conversa (exemplo de integração)
   */
  async deleteConversation(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const currentUserId = ctx.state.user.id;

      // 🔍 Buscar conversa com participantes
      const conversation = await strapi.documents('api::conversation.conversation').findOne({
        documentId,
        populate: ['participants']
      });

      if (!conversation) {
        return ctx.throw(404, 'Conversation not found');
      }

      // ✅ Verificar se é participante
      const isParticipant = conversation.participants.some((p: any) => p.id === currentUserId);
      if (!isParticipant) {
        return ctx.throw(403, 'You are not a participant in this conversation');
      }

      // 🗑️ Deletar conversa
      await strapi.documents('api::conversation.conversation').delete({
        documentId
      });

      // 🔔 Notificar participantes via Socket.io
      const participantIds = conversation.participants.map((p: any) => p.documentId);
      SocketHelper.notifyConversationDeleted(documentId, participantIds);

      ctx.body = {
        data: null,
        meta: { message: 'Conversation deleted successfully' }
      };

    } catch (error: any) {
      console.error('❌ Error deleting conversation:', error);
      ctx.throw(500, 'Failed to delete conversation');
    }
  },

  /**
   * 📊 Obter status online dos usuários
   */
  async getUsersOnlineStatus(ctx: any) {
    try {
      const { userIds } = ctx.query;
      
      if (!userIds || !Array.isArray(userIds)) {
        return ctx.throw(400, 'userIds array is required');
      }

      const onlineStatus = userIds.map((userId: string) => ({
        userId: userId,
        isOnline: SocketHelper.isUserOnline(userId),
        socketCount: SocketHelper.getUserSocketCount(userId)
      }));

      ctx.body = {
        data: onlineStatus
      };

    } catch (error: any) {
      console.error('❌ Error getting online status:', error);
      ctx.throw(500, 'Failed to get online status');
    }
  }
}));