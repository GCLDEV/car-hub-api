/**
 * 🔗 Socket Connection Handler
 * 
 * Gerencia conexões, salas e eventos de chat
 */

import type { Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import type { AuthenticatedSocket } from '../index';
import { messageHandlers } from './message';
import { roomHandlers } from './room';

interface MarkAsReadData {
  conversationId: string;
  messageIds: string[];
}

interface TypingData {
  conversationId: string;
}

export function connectionHandler(socket: Socket, strapi: Core.Strapi): void {
  const authSocket = socket as AuthenticatedSocket;
  
  console.log(`🟢 User connected: ${authSocket.user.username} (${authSocket.userId})`);

  // 🏠 Auto-join na sala pessoal do usuário
  const userRoom = `user-${authSocket.userId}`;
  socket.join(userRoom);
  
  // 📊 Emitir status online
  socket.broadcast.emit('userOnline', {
    userId: authSocket.userId,
    username: authSocket.user.username
  });

  // 💬 Registrar handlers de mensagem
  messageHandlers(authSocket, strapi);
  
  // 🏠 Registrar handlers de sala
  roomHandlers(authSocket, strapi);

  // 📝 Eventos de typing
  socket.on('startTyping', (data: TypingData) => {
    socket.to(`conversation-${data.conversationId}`).emit('userStartedTyping', {
      userId: authSocket.userId,
      username: authSocket.user.username,
      conversationId: data.conversationId
    });
  });

  socket.on('stopTyping', (data: TypingData) => {
    socket.to(`conversation-${data.conversationId}`).emit('userStoppedTyping', {
      userId: authSocket.userId,
      username: authSocket.user.username,
      conversationId: data.conversationId
    });
  });

  // 👀 Marcar mensagens como lidas
  socket.on('markAsRead', async (data: MarkAsReadData) => {
    try {
      // Atualizar mensagens no banco de dados usando Strapi v5 API
      const messagesToUpdate = await strapi.documents('api::message.message').findMany({
        filters: {
          documentId: { $in: data.messageIds },
          conversation: { documentId: data.conversationId },
          sender: { documentId: { $ne: authSocket.userId } } // Não marcar próprias mensagens
        }
      });

      // Atualizar cada mensagem
      for (const message of messagesToUpdate) {
        await strapi.documents('api::message.message').update({
          documentId: message.documentId,
          data: { isRead: true, readAt: new Date() }
        });
      }

      // Notificar outros usuários na conversa
      socket.to(`conversation-${data.conversationId}`).emit('messagesRead', {
        conversationId: data.conversationId,
        readBy: authSocket.userId,
        messageIds: data.messageIds
      });

    } catch (error: any) {
      console.error('❌ Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // 🔌 Desconexão
  socket.on('disconnect', (reason) => {
    console.log(`🔴 User disconnected: ${authSocket.user.username} (${reason})`);
    
    // Verificar se usuário ainda tem outras conexões ativas usando io da instância
    const io = (socket as any).server;
    const userRoomSockets = io.sockets.adapter.rooms.get(`user-${authSocket.userId}`);
    const stillConnected = userRoomSockets && userRoomSockets.size > 0;
    
    if (!stillConnected) {
      // 📊 Emitir status offline apenas se não há outras conexões
      socket.broadcast.emit('userOffline', {
        userId: authSocket.userId,
        username: authSocket.user.username
      });
    }
  });

  // ❌ Tratamento de erros
  socket.on('error', (error: Error) => {
    console.error(`❌ Socket error for user ${authSocket.userId}:`, error);
  });
}