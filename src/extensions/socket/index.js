const { Server } = require('socket.io');

module.exports = ({ strapi }) => ({
  /**
   * Inicializa o servidor Socket.IO
   */
  initialize() {
    console.log('🚀 Inicializando extensão WebSocket...');
    
    // Obter o servidor HTTP do Strapi
    const server = strapi.server.httpServer;
    console.log('📡 Servidor HTTP obtido:', !!server);
    
    // Criar instância do Socket.IO
    const io = new Server(server, {
      cors: {
        origin: "*", // Temporariamente abrir para debug
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    console.log('🔌 Instância Socket.IO criada');

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
      strapi.log.info(`Nova conexão WebSocket: ${socket.id}`);
      
      // Entrar em conversa específica
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation:${conversationId}`);
        strapi.log.info(`Usuario ${socket.user?.username} entrou na conversa ${conversationId}`);
      });

      // Sair de conversa
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
        strapi.log.info(`Usuario ${socket.user?.username} saiu da conversa ${conversationId}`);
      });

      // Indicador de digitação
      socket.on('typing_start', ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.user?.id,
          username: socket.user?.username,
          isTyping: true
        });
      });

      socket.on('typing_stop', ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.user?.id,
          username: socket.user?.username,
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

    console.log('✅ WebSocket Server inicializado com sucesso!');
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