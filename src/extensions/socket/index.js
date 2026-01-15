const { Server } = require('socket.io');

module.exports = ({ strapi }) => ({
  /**
   * Inicializa o servidor Socket.IO
   */
  initialize() {
    
    
    // Obter o servidor HTTP do Strapi
    const server = strapi.server.httpServer;
    
    // Criar instância do Socket.IO
    const io = new Server(server, {
      cors: {
        origin: ["http://localhost:8081", "https://a93b9cce742b.ngrok-free.app", "exp://192.168.*", "exp://*"],
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
      },
      transports: ['polling', 'websocket'], // Polling primeiro para ngrok
      allowEIO3: true, // Suporte para versões antigas
      pingTimeout: 60000, // Aumentado para ngrok
      pingInterval: 25000 // Aumentado para ngrok
    });

    // Armazenar referência do io no Strapi
    strapi.io = io;

    // Middleware de autenticação para WebSocket
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (token) {
          // Verificar token JWT
          const decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token);
          
          // Buscar usuário
          const user = await strapi.entityService.findOne(
            'plugin::users-permissions.user',
            decoded.id,
            { populate: ['role'] }
          );
          
          if (user) {
            socket.user = user;
            socket.join(`user:${user.id}`); // Sala específica do usuário
            strapi.log.info(`Usuario ${user.username} conectado via WebSocket`);
          }
        }
        
        next();
      } catch (error) {
        strapi.log.error('Erro na autenticação WebSocket:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Event handlers
    io.on('connection', (socket) => {
      
      // Auto-join em salas baseado no ID do usuário
      if (socket.user) {
        socket.join(`user:${socket.user.id}`);
      }
      
      // Entrar em conversa específica
      socket.on('join_conversation', (conversationId) => {
        const roomName = `conversation:${conversationId}`;
        socket.join(roomName);
        
        socket.to(roomName).emit('test_room', {
          message: `Usuario ${socket.user?.username} entrou na sala`,
          roomName,
          timestamp: new Date().toISOString()
        });
      });

      // FALLBACK: Force join via HTTP endpoint
      socket.on('force_join_conversation', (conversationId) => {
        const roomName = `conversation:${conversationId}`;
        socket.join(roomName);
        
        // Confirmar entrada enviando resposta
        socket.emit('joined_conversation', {
          conversationId,
          roomName,
          timestamp: new Date().toISOString(),
          userCount: socket.adapter.rooms.get(roomName)?.size || 0
        });
      });

      // Sair de conversa
      socket.on('leave_conversation', (conversationId) => {
        const roomName = `conversation:${conversationId}`;
        socket.leave(roomName);
      });

      // Indicador de digitação
      socket.on('typing_start', ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.user?.id,
          username: socket.user?.username,
          conversationId,
          isTyping: true
        });
      });

      socket.on('typing_stop', ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.user?.id,
          username: socket.user?.username,
          conversationId,
          isTyping: false
        });
      });

      // Marcar mensagens como lidas
      socket.on('mark_messages_read', async ({ conversationId }) => {
        if (socket.user) {
          try {
            // Atualizar mensagens não lidas da conversa
            await strapi.db.query('api::message.message').updateMany({
              where: {
                conversation: conversationId,
                receiver: socket.user.id,
                isRead: false
              },
              data: {
                isRead: true
              }
            });

            // Notificar outros participantes
            socket.to(`conversation:${conversationId}`).emit('messages_read', {
              conversationId,
              readBy: socket.user.id
            });
          } catch (error) {
            strapi.log.error('Erro ao marcar mensagens como lidas:', error);
          }
        }
      });

      // Disconnection
      socket.on('disconnect', () => {
        strapi.log.info(`Usuario ${socket.user?.username} desconectado do WebSocket`);
      });
    });

    strapi.log.info('🔌 WebSocket Server inicializado com sucesso');
  },

  /**
   * Emitir nova mensagem para conversa específica
   */
  emitNewMessage(conversationId, message, excludeUserId = null) {
    if (strapi.io) {
      const socketData = {
        id: message.id,
        content: message.content,
        sender: message.sender,
        receiver: message.receiver,
        type: message.type,
        createdAt: message.createdAt,
        conversationId: conversationId
      };

      // Emitir para todos na conversa, exceto quem enviou
      if (excludeUserId) {
        strapi.io.to(`conversation:${conversationId}`).except(`user:${excludeUserId}`).emit('new_message', socketData);
      } else {
        strapi.io.to(`conversation:${conversationId}`).emit('new_message', socketData);
      }

      // Emitir notificação para participantes offline
      strapi.io.to(`user:${message.receiver.id}`).emit('new_message_notification', {
        conversationId,
        senderName: message.sender.username,
        preview: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
      });
    }
  },

  /**
   * Emitir atualização de conversa
   */
  emitConversationUpdate(conversationId, updateData) {
    if (strapi.io) {
      strapi.io.to(`conversation:${conversationId}`).emit('conversation_updated', {
        conversationId,
        ...updateData
      });
    }
  },

  /**
   * Emitir notificação para usuário específico
   */
  emitNotification(userId, notification) {
    if (strapi.io) {
      strapi.io.to(`user:${userId}`).emit('notification', notification);
    }
  }
});