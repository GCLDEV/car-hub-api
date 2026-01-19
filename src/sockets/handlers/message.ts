/**
 * 💬 Message Handlers
 * 
 * Gerencia envio, recebimento e persistência de mensagens
 */

import type { Core } from '@strapi/strapi';
import type { AuthenticatedSocket } from '../index';

interface SendMessageData {
  conversationId: string;
  content: string;
  type?: 'text' | 'image' | 'system';
  tempId?: string;
}

interface DeleteMessageData {
  messageId: string;
  conversationId: string;
}

interface EditMessageData {
  messageId: string;
  newContent: string;
  conversationId: string;
}

export function messageHandlers(socket: AuthenticatedSocket, strapi: Core.Strapi): void {

  // 📤 Enviar mensagem
  socket.on('sendMessage', async (data: SendMessageData) => {
    try {
      console.log(`📤 Message from ${socket.user.username}:`, data);

      // ✅ Validações básicas
      if (!data.conversationId || !data.content.trim()) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // 🔍 Verificar se usuário pertence à conversa usando entityService como a API REST
      const conversation = await strapi.entityService.findOne('api::conversation.conversation', data.conversationId, {
        populate: ['participants']
      });

      if (!conversation) {
        console.error(`❌ Conversa ${data.conversationId} não encontrada via entityService`);
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const isParticipant = (conversation as any).participants.some((p: any) => 
        p.id?.toString() === socket.user.id?.toString() || 
        p.documentId === socket.userId ||
        p.id === socket.user.id
      );
      
      if (!isParticipant) {
        console.error(`❌ Usuário ${socket.user.username} não é participante da conversa ${data.conversationId}`);
        socket.emit('error', { message: 'You are not a participant in this conversation' });
        return;
      }

      // 💾 Salvar mensagem no banco de dados usando Strapi v5 API
      const newMessage = await strapi.documents('api::message.message').create({
        data: {
          content: data.content,
          type: data.type || 'text',
          sender: { documentId: socket.userId },
          conversation: { documentId: data.conversationId },
          isRead: false,
          publishedAt: new Date()
        },
        populate: ['sender']
      });

      // 📅 Atualizar última atividade da conversa
      await strapi.documents('api::conversation.conversation').update({
        documentId: data.conversationId,
        data: {
          updatedAt: new Date()
        }
      });

      // 🎯 Preparar dados para emissão
      const messagePayload = {
        id: newMessage.documentId,
        content: newMessage.content,
        type: newMessage.type,
        createdAt: newMessage.createdAt,
        conversationId: data.conversationId,
        sender: {
          id: socket.userId,
          username: socket.user.username
        },
        read: false
      };

      // 📡 Emitir para todos na conversa
      const roomName = `conversation-${data.conversationId}`;
      // console.log(`📡 Emitindo newMessage para sala: ${roomName}`, messagePayload);
      
      socket.to(roomName).emit('newMessage', messagePayload);
      
      // ✅ Confirmar envio para o remetente
      socket.emit('messageSent', {
        tempId: data.tempId,
        message: messagePayload
      });

      console.log(`✅ Message saved and broadcasted: ${newMessage.documentId}`);

    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      socket.emit('error', { 
        message: 'Failed to send message',
        tempId: data.tempId 
      });
    }
  });

  // 🗑️ Deletar mensagem
  socket.on('deleteMessage', async (data: DeleteMessageData) => {
    try {
      // 🔍 Verificar se a mensagem existe e pertence ao usuário
      const message = await strapi.documents('api::message.message').findOne({
        documentId: data.messageId,
        populate: ['sender']
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (message.sender.documentId !== socket.userId) {
        socket.emit('error', { message: 'You can only delete your own messages' });
        return;
      }

      // 🗑️ Deletar mensagem (hard delete pois não temos campo deleted)
      await strapi.documents('api::message.message').delete({
        documentId: data.messageId
      });

      // 📡 Notificar todos na conversa
      const deletePayload = {
        messageId: data.messageId,
        conversationId: data.conversationId,
        deletedBy: socket.userId
      };

      socket.to(`conversation-${data.conversationId}`).emit('messageDeleted', deletePayload);
      socket.emit('messageDeleted', deletePayload);

    } catch (error: any) {
      console.error('❌ Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  // ✏️ Editar mensagem
  socket.on('editMessage', async (data: EditMessageData) => {
    try {
      if (!data.newContent.trim()) {
        socket.emit('error', { message: 'Message content cannot be empty' });
        return;
      }

      // 🔍 Verificar se a mensagem existe e pertence ao usuário
      const message = await strapi.documents('api::message.message').findOne({
        documentId: data.messageId,
        populate: ['sender']
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (message.sender.documentId !== socket.userId) {
        socket.emit('error', { message: 'You can only edit your own messages' });
        return;
      }

      // ✏️ Atualizar mensagem
      const updatedMessage = await strapi.documents('api::message.message').update({
        documentId: data.messageId,
        data: { 
          content: data.newContent,
          updatedAt: new Date()
        }
      });

      // 📡 Notificar todos na conversa
      const editPayload = {
        messageId: data.messageId,
        newContent: data.newContent,
        conversationId: data.conversationId,
        editedAt: updatedMessage.updatedAt,
        editedBy: socket.userId
      };

      socket.to(`conversation-${data.conversationId}`).emit('messageEdited', editPayload);
      socket.emit('messageEdited', editPayload);

    } catch (error: any) {
      console.error('❌ Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });
}