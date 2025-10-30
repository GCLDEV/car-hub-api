/**
 * message controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::message.message' as any, ({ strapi }) => ({
  // GET /api/messages?conversationId=:id - Messages de uma conversa específica
  async find(ctx) {
    const user = ctx.state.user
    const { conversationId } = ctx.query

    if (!user) {
      return ctx.unauthorized('You must be logged in to view messages')
    }

    if (!conversationId) {
      return ctx.badRequest('Conversation ID is required')
    }

    // Verificar se o usuário faz parte desta conversa
    const conversation = await strapi.entityService.findOne('api::conversation.conversation', conversationId as any, {
      populate: ['participants']
    })

    if (!conversation) {
      return ctx.notFound('Conversation not found')
    }

    const isParticipant = (conversation as any).participants?.some((p: any) => p.id === user.id)
    if (!isParticipant) {
      return ctx.forbidden('You are not authorized to view messages from this conversation')
    }

    // Buscar mensagens da conversa (simplificado por enquanto)
    const { results, pagination } = await strapi.entityService.findPage('api::message.message', {
      filters: {
        $or: [
          { sender: user.id },
          { receiver: user.id }
        ]
      },
      sort: 'createdAt:asc',
      populate: {
        sender: {
          fields: ['id', 'username']
        },
        receiver: {
          fields: ['id', 'username']
        },
        car: {
          fields: ['id', 'title']
        }
      }
    })

    const sanitizedResults = await this.sanitizeOutput(results, ctx)
    return this.transformResponse(sanitizedResults, { pagination })
  },

  // POST /api/messages
  async create(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to send messages')
    }

    const { receiver: receiverId, content } = ctx.request.body.data

    if (!receiverId || !content) {
      return ctx.badRequest('Receiver and content are required')
    }

    if (receiverId === user.id) {
      return ctx.badRequest('You cannot send a message to yourself')
    }

    // Set the sender to the authenticated user
    ctx.request.body.data.sender = user.id
    ctx.request.body.data.isRead = false

    const entity = await strapi.entityService.create('api::message.message', {
      data: ctx.request.body.data,
      populate: ['sender', 'receiver', 'car']
    })

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)
    return this.transformResponse(sanitizedResults)
  },

  // GET /api/messages/conversations - Lista conversas do usuário (alternativa ao conversations endpoint)
  async conversations(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to view conversations')
    }

    // Buscar todas as mensagens do usuário
    const messages = await strapi.entityService.findMany('api::message.message', {
      filters: {
        $or: [
          { sender: user.id },
          { receiver: user.id }
        ]
      },
      sort: 'createdAt:desc',
      populate: {
        sender: {
          fields: ['id', 'username']
        },
        receiver: {
          fields: ['id', 'username']
        },
        car: {
          fields: ['id', 'title', 'price'],
          populate: {
            images: {
              fields: ['url']
            }
          }
        }
      }
    })

    // Agrupar mensagens por conversa (combinação de usuário + carro)
    const conversationsMap = new Map()

    for (const message of messages as any[]) {
      const otherUserId = message.sender?.id === user.id ? message.receiver?.id : message.sender?.id
      const conversationKey = `${otherUserId}-${message.car?.id || 'no-car'}`
      
      if (!conversationsMap.has(conversationKey)) {
        const otherUser = message.sender?.id === user.id ? message.receiver : message.sender
        
        conversationsMap.set(conversationKey, {
          id: conversationKey,
          otherUser,
          car: message.car,
          lastMessage: message,
          messages: [message],
          updatedAt: message.createdAt
        })
      } else {
        const conversation = conversationsMap.get(conversationKey)
        conversation.messages.push(message)
        
        // Manter a mensagem mais recente como lastMessage
        if (new Date(message.createdAt) > new Date(conversation.lastMessage.createdAt)) {
          conversation.lastMessage = message
          conversation.updatedAt = message.createdAt
        }
      }
    }

    // Converter para array e ordenar por última atividade
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(conv => ({
        ...conv,
        unreadCount: conv.messages.filter((msg: any) => 
          msg.receiver?.id === user.id && !msg.isRead
        ).length
      }))

    const sanitizedResults = await this.sanitizeOutput(conversations, ctx)
    return this.transformResponse(sanitizedResults)
  }
}))