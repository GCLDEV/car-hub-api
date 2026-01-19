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
      console.log('🔌 Inicializando WebSocket Server...')
      
      const server = strapi.server.httpServer
      
      const io = new Server(server, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
      })

      // Middleware de autenticação
      io.use(async (socket, next) => {
        try {
          const token = socket.handshake.auth.token
          console.log('🔐 WebSocket auth attempt:', { 
            hasToken: !!token,
            tokenPreview: token ? `${token.substring(0, 20)}...` : 'No token'
          })

          if (!token) {
            console.error('❌ No token provided')
            return next(new Error('Authentication failed: No token'))
          }

          // Verificar token usando o serviço de autenticação do Strapi
          const decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token)
          console.log('✅ Token decoded:', { userId: decoded.id })
          
          // Buscar usuário completo
          const user = await strapi.entityService.findOne('plugin::users-permissions.user', decoded.id, {
            populate: ['role']
          })

          if (!user) {
            console.error('❌ User not found:', decoded.id)
            return next(new Error('User not found'))
          }

          console.log('✅ WebSocket authenticated:', { userId: user.id, username: user.username })

          // Adicionar informações do usuário ao socket
          ;(socket as any).userId = user.id
          ;(socket as any).user = user
          
          next()
        } catch (error) {
          console.error('❌ Socket authentication error:', error.message)
          next(new Error('Authentication failed: ' + error.message))
        }
      })

      // Eventos de conexão
      io.on('connection', (socket: any) => {
        const authSocket = socket as AuthenticatedSocket
        console.log('✅ WebSocket connected:', { userId: authSocket.userId, username: authSocket.user.username })

        // Entrar em conversa
        socket.on('joinConversation', (conversationId) => {
          socket.join(`conversation-${conversationId}`)
          console.log(`User ${authSocket.userId} joined conversation ${conversationId}`)
          
          // Notificar outros usuários que alguém entrou
          socket.to(`conversation-${conversationId}`).emit('userEnteredConversation', {
            userId: authSocket.userId,
            conversationId,
            username: authSocket.user.username
          })
        })

        // Sair de conversa
        socket.on('leaveConversation', (conversationId) => {
          socket.leave(`conversation-${conversationId}`)
          console.log(`User ${authSocket.userId} left conversation ${conversationId}`)
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
        socket.on('disconnect', (reason) => {
          console.log('❌ WebSocket disconnected:', { userId: authSocket.userId, reason })
        })
      })

      // Armazenar referência do io no Strapi para uso em controllers
      strapi.io = io
      console.log('✅ WebSocket Server initialized')
    }
  }
}