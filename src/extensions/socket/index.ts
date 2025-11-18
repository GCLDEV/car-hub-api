import { Server, Socket } from 'socket.io'

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number
    username: string
    email: string
  }
}

export default ({ strapi }: { strapi: any }) => {
  console.log('🔧 Extensão Socket carregada - definindo métodos...')
  
  return {
    /**
     * Inicializa o servidor Socket.IO
     */
    initialize() {
      console.log('🚀 Inicializando extensão WebSocket...')
    
    // Obter o servidor HTTP do Strapi
    const server = strapi.server.httpServer
    console.log('📡 Servidor HTTP obtido:', !!server)
    
    // Criar instância do Socket.IO
    const io = new Server(server, {
      cors: {
        origin: "*", // Temporariamente abrir para debug
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    })
    
    console.log('🔌 Instância Socket.IO criada')

    // Armazenar referência do io no Strapi
    ;(strapi as any).io = io

    // Middleware de autenticação para WebSocket
    io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.token
        
        if (token) {
          // Verificar token JWT
          const decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token)
          
          // Buscar usuário
          const user = await strapi.entityService.findOne(
            'plugin::users-permissions.user',
            decoded.id,
            { populate: ['role'] }
          )
          
          if (user) {
            ;(socket as AuthenticatedSocket).user = user
            socket.join(`user:${user.id}`) // Sala específica do usuário
            console.log(`✅ Usuario ${user.username} autenticado via WebSocket`)
          }
        }
        
        next()
      } catch (error) {
        console.error('❌ Erro na autenticação WebSocket:', error)
        next(new Error('Authentication failed'))
      }
    })

    // Event handlers
    io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket
      console.log(`🔌 Nova conexão WebSocket: ${socket.id}`)
      
      // Entrar em conversa específica
      socket.on('join_conversation', (conversationId: string) => {
        socket.join(`conversation:${conversationId}`)
        console.log(`👥 Usuario ${authSocket.user?.username || 'Anônimo'} entrou na conversa ${conversationId}`)
      })

      // Sair de conversa
      socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`)
        console.log(`👋 Usuario ${authSocket.user?.username || 'Anônimo'} saiu da conversa ${conversationId}`)
      })

      // Indicador de digitação
      socket.on('typing_start', ({ conversationId }: { conversationId: string }) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: authSocket.user?.id,
          username: authSocket.user?.username,
          isTyping: true
        })
        console.log(`⌨️ ${authSocket.user?.username || 'Anônimo'} começou a digitar na conversa ${conversationId}`)
      })

      socket.on('typing_stop', ({ conversationId }: { conversationId: string }) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: authSocket.user?.id,
          username: authSocket.user?.username,
          isTyping: false
        })
        console.log(`⌨️ ${authSocket.user?.username || 'Anônimo'} parou de digitar na conversa ${conversationId}`)
      })

      // Marcar mensagens como lidas
      socket.on('mark_messages_read', async ({ conversationId }: { conversationId: string }) => {
        if (authSocket.user) {
          try {
            // Atualizar mensagens não lidas da conversa
            await strapi.db.query('api::message.message').updateMany({
              where: {
                conversation: conversationId,
                receiver: authSocket.user.id,
                isRead: false
              },
              data: {
                isRead: true
              }
            })

            // Notificar outros participantes
            socket.to(`conversation:${conversationId}`).emit('messages_read', {
              conversationId,
              readBy: authSocket.user.id
            })
            
            console.log(`📖 Mensagens marcadas como lidas na conversa ${conversationId} por ${authSocket.user.username}`)
          } catch (error) {
            console.error('❌ Erro ao marcar mensagens como lidas:', error)
          }
        }
      })

      // Disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Usuario ${authSocket.user?.username || 'Anônimo'} desconectado do WebSocket`)
      })
    })

    console.log('✅ WebSocket Server inicializado com sucesso!')
    strapi.log.info('🔌 WebSocket Server inicializado com sucesso')
  },

  /**
   * Emitir nova mensagem para conversa específica
   */
  emitNewMessage(conversationId: string, message: any, excludeUserId: number | null = null) {
    const io = (strapi as any).io
    if (io) {
      const socketData = {
        id: message.id,
        content: message.content,
        senderId: message.sender?.id,
        receiverId: message.receiver?.id,
        type: message.type,
        createdAt: message.createdAt,
        conversationId: conversationId
      }

      console.log('📨 Emitindo nova mensagem via WebSocket:', {
        conversationId,
        messageId: message.id,
        from: message.sender?.username,
        to: message.receiver?.username,
        excludeUserId
      })

      // Emitir para todos na conversa, exceto quem enviou
      if (excludeUserId) {
        io.to(`conversation:${conversationId}`).except(`user:${excludeUserId}`).emit('new_message', socketData)
      } else {
        io.to(`conversation:${conversationId}`).emit('new_message', socketData)
      }

      // Emitir notificação para participantes offline
      io.to(`user:${message.receiver.id}`).emit('new_message_notification', {
        conversationId,
        senderName: message.sender.username,
        preview: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
      })
    } else {
      console.log('⚠️ Socket.IO não disponível para emitir mensagem')
    }
  }
  }
}