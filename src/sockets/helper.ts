/**
 * 🎯 Socket Helper for Controllers
 * 
 * Utilitário para emitir eventos socket de dentro dos controllers
 */

import { getSocketService } from '../sockets';

class SocketHelper {
  
  /**
   * 📤 Emitir evento para um usuário específico
   */
  static emitToUser(userId: string, event: string, data: any): void {
    const socketService = getSocketService();
    if (socketService) {
      socketService.emitToUser(userId, event, data);
    }
  }

  /**
   * 📤 Emitir evento para uma sala/conversa
   */
  static emitToRoom(room: string, event: string, data: any): void {
    const socketService = getSocketService();
    if (socketService) {
      socketService.emitToRoom(room, event, data);
    }
  }

  /**
   * 📤 Emitir evento para uma conversa específica
   */
  static emitToConversation(conversationId: string, event: string, data: any): void {
    this.emitToRoom(`conversation-${conversationId}`, event, data);
  }

  /**
   * 🔔 Notificar nova conversa criada
   */
  static notifyConversationCreated(conversationId: string, participants: string[], conversationData: any): void {
    participants.forEach(userId => {
      this.emitToUser(userId, 'conversationCreated', {
        conversationId,
        conversation: conversationData
      });
    });
  }

  /**
   * 🗑️ Notificar conversa deletada
   */
  static notifyConversationDeleted(conversationId: string, participants: string[]): void {
    participants.forEach(userId => {
      this.emitToUser(userId, 'conversationDeleted', {
        conversationId
      });
    });
  }

  /**
   * 👤 Notificar usuário adicionado à conversa
   */
  static notifyUserAddedToConversation(conversationId: string, newUserId: string, addedBy: string): void {
    this.emitToConversation(conversationId, 'userAddedToConversation', {
      conversationId,
      newUserId,
      addedBy
    });
  }

  /**
   * 👤 Notificar usuário removido da conversa
   */
  static notifyUserRemovedFromConversation(conversationId: string, removedUserId: string, removedBy: string): void {
    this.emitToConversation(conversationId, 'userRemovedFromConversation', {
      conversationId,
      removedUserId,
      removedBy
    });
  }

  /**
   * 📊 Verificar se usuário está online
   */
  static isUserOnline(userId: string): boolean {
    const socketService = getSocketService();
    if (socketService) {
      return socketService.getUserSocketCount(userId) > 0;
    }
    return false;
  }

  /**
   * 📊 Obter contagem de sockets de um usuário
   */
  static getUserSocketCount(userId: string): number {
    const socketService = getSocketService();
    if (socketService) {
      return socketService.getUserSocketCount(userId);
    }
    return 0;
  }

  /**
   * 🎯 Broadcast para todos os usuários conectados
   */
  static broadcast(event: string, data: any): void {
    const socketService = getSocketService();
    if (socketService) {
      socketService.getIO().emit(event, data);
    }
  }
}

export { SocketHelper };