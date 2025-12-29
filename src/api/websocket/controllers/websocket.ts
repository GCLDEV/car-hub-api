module.exports = {
  /**
   * Forçar entrada em conversa via HTTP (fallback para problemas de WebSocket)
   */
  async joinConversation(ctx) {
    try {
      const { conversationId } = ctx.request.body;
      const user = ctx.state.user;
      
      if (!conversationId || !user) {
        return ctx.badRequest('conversationId e autenticação são obrigatórios');
      }

      // Buscar todos os sockets do usuário
      if ((strapi as any).io) {
        const userSockets = [];
        
        // Iterar por todos os sockets conectados
        (strapi as any).io.sockets.sockets.forEach((socket) => {
          if (socket.user && socket.user.id === user.id) {
            userSockets.push(socket);
          }
        });



        // Forçar entrada em todos os sockets do usuário
        for (const socket of userSockets) {
          const roomName = `conversation:${conversationId}`;
          socket.join(roomName);
          
          // Emitir confirmação
          socket.emit('joined_conversation', {
            conversationId,
            roomName,
            timestamp: new Date().toISOString(),
            userCount: socket.adapter.rooms.get(roomName)?.size || 0,
            method: 'http_fallback'
          });
        }

        // Verificar quantos clientes estão na sala agora
        const roomName = `conversation:${conversationId}`;
        const roomSize = (strapi as any).io.sockets.adapter.rooms.get(roomName)?.size || 0;
        


        return ctx.send({
          success: true,
          conversationId,
          socketsUpdated: userSockets.length,
          roomSize,
          message: 'Entrada forçada com sucesso'
        });
      }

      return ctx.internalServerError('WebSocket não disponível');
    } catch (error) {
      console.error('Erro no HTTP fallback joinConversation:', error);
      return ctx.internalServerError('Erro interno');
    }
  },

  /**
   * Sair de conversa via HTTP
   */
  async leaveConversation(ctx) {
    try {
      const { conversationId } = ctx.request.body;
      const user = ctx.state.user;
      
      if (!conversationId || !user) {
        return ctx.badRequest('conversationId e autenticação são obrigatórios');
      }

      // Buscar todos os sockets do usuário
      if ((strapi as any).io) {
        const userSockets = [];
        
        (strapi as any).io.sockets.sockets.forEach((socket) => {
          if (socket.user && socket.user.id === user.id) {
            userSockets.push(socket);
          }
        });



        // Forçar saída de todos os sockets do usuário
        for (const socket of userSockets) {
          const roomName = `conversation:${conversationId}`;
          socket.leave(roomName);
        }

        return ctx.send({
          success: true,
          conversationId,
          socketsUpdated: userSockets.length,
          message: 'Saída forçada com sucesso'
        });
      }

      return ctx.internalServerError('WebSocket não disponível');
    } catch (error) {
      console.error('Erro no HTTP fallback leaveConversation:', error);
      return ctx.internalServerError('Erro interno');
    }
  }
};