// TEMPORARIAMENTE DESABILITADO PARA DEBUG DE TELA BRANCA
/*
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

            return next(new Error('Authentication error'))
          }

          // Validar token usando Strapi JWT
          const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token)
          
          const user = await strapi.entityService.findOne('plugin::users-permissions.user', id)
          
          if (!user) {

            return next(new Error('User not found'))
          }

          ;(socket as any).userId = user.id
          ;(socket as any).user = user

          
          next()
        } catch (error) {

          next(new Error('Authentication error'))
        }
      })

      // Gerenciar conexões
      io.on('connection', (socket) => {
        const authSocket = socket as any


        // Entrar em uma conversa
        socket.on('joinConversation', (conversationId) => {
          socket.join(`conversation-${conversationId}`)

        })

        // Sair de uma conversa
        socket.on('leaveConversation', (conversationId) => {
          socket.leave(`conversation-${conversationId}`)

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

        })
      })

      // Armazenar referência do io no Strapi para uso em controllers
      strapi.io = io
      

    }
  }
}
*/

// EXPORTAÇÃO VAZIA PARA EVITAR ERROS
export default ({ strapi }) => {
  return {
    initialize() {
      // Socket temporariamente desabilitado
    }
  }
}