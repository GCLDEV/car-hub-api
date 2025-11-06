import { Server } from 'socket.io'

interface AuthenticatedSocket {
  userId: number
  user: any
  join: (room: string) => void
  leave: (room: string) => void
  to: (room: string) => any
  on: (event: string, callback: (...args: any[]) => void) => void
  handshake: {
    auth: {
      token: string
    }
  }
}

export default ({ strapi }) => {
  return {
    initialize() {
      console.log('🔌 Inicializando WebSocket extension...')
      
      const server = strapi.server.httpServer
      
      const io = new Server(server, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling']
      })

      // Middleware de autenticação
      io.use(async (socket, next) => {
        try {
          const token = socket.handshake.auth.token
          
          if (!token) {
            console.log('❌ Token não fornecido no WebSocket')
            return next(new Error('Authentication error'))
          }

          // Validar token usando Strapi JWT
          const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token)
          
          const user = await strapi.entityService.findOne('plugin::users-permissions.user', id)
          
          if (!user) {
            console.log('❌ Usuário não encontrado no WebSocket')
            return next(new Error('User not found'))
          }

          ;(socket as any).userId = user.id
          ;(socket as any).user = user
          console.log(`✅ Usuário ${user.username} (${user.id}) conectado ao WebSocket`)
          
          next()
        } catch (error) {
          console.log('❌ Erro de autenticação WebSocket:', error.message)
          next(new Error('Authentication error'))
        }
      })

      // Gerenciar conexões
      io.on('connection', (socket) => {
        const authSocket = socket as any
        console.log(`🔌 Cliente conectado: ${authSocket.user.username} (${authSocket.userId})`)

        // Entrar em uma conversa
        socket.on('joinConversation', (conversationId) => {
          socket.join(`conversation-${conversationId}`)
          console.log(`📥 Usuário ${authSocket.user.username} entrou na conversa ${conversationId}`)
        })

        // Sair de uma conversa
        socket.on('leaveConversation', (conversationId) => {
          socket.leave(`conversation-${conversationId}`)
          console.log(`📤 Usuário ${authSocket.user.username} saiu da conversa ${conversationId}`)
        })

        // Indicar que está digitando
        socket.on('startTyping', (conversationId) => {
          socket.to(`conversation-${conversationId}`).emit('userTyping', {
            userId: authSocket.userId,
            conversationId,
            username: authSocket.user.username
          })
        })

        // Indicar que parou de digitar
        socket.on('stopTyping', (conversationId) => {
          socket.to(`conversation-${conversationId}`).emit('userStoppedTyping', {
            userId: authSocket.userId,
            conversationId,
            username: authSocket.user.username
          })
        })

        // Marcar mensagens como lidas
        socket.on('markMessagesAsRead', (conversationId) => {
          socket.to(`conversation-${conversationId}`).emit('messagesRead', {
            userId: authSocket.userId,
            conversationId
          })
        })

        // Desconexão
        socket.on('disconnect', () => {
          console.log(`🔌 Cliente desconectado: ${authSocket.user.username} (${authSocket.userId})`)
        })
      })

      // Armazenar referência do io no Strapi para uso em controllers
      strapi.io = io
      
      console.log('✅ WebSocket extension inicializada com sucesso')
    }
  }
}