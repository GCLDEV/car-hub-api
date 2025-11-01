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

    // Buscar mensagens específicas desta conversa
    const { results, pagination } = await strapi.entityService.findPage('api::message.message', {
      filters: {
        conversation: conversationId,
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
        },
        conversation: {
          fields: ['id']
        }
      }
    })

    // ⚠️ PROBLEMA: sanitizeOutput remove sender/receiver, vamos preservar manualmente
    const messagesWithUsers = results.map((message: any) => ({
      ...message,
      sender: message.sender ? {
        id: message.sender.id,
        documentId: message.sender.documentId,
        username: message.sender.username
      } : null,
      receiver: message.receiver ? {
        id: message.receiver.id,
        documentId: message.receiver.documentId,
        username: message.receiver.username
      } : null
    }))



    return this.transformResponse(messagesWithUsers, { pagination })
  },

  // POST /api/messages
  async create(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to send messages')
    }

    const { receiver: receiverId, content, conversation: conversationId } = ctx.request.body.data

    // Se temos conversationId, buscar o receiver baseado na conversa
    if (conversationId && !receiverId) {
      const conversation = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
        populate: ['participants']
      })

      if (!conversation) {
        return ctx.badRequest('Conversation not found')
      }

      // Encontrar o outro participante
      const otherParticipant = (conversation as any).participants?.find((p: any) => p.id !== user.id)
      
      if (!otherParticipant) {
        return ctx.badRequest('Other participant not found in conversation')
      }

      ctx.request.body.data.receiver = otherParticipant.id
    }

    const finalReceiverId = ctx.request.body.data.receiver || receiverId

    if (!finalReceiverId || !content) {
      return ctx.badRequest('Receiver and content are required')
    }

    if (finalReceiverId === user.id) {
      return ctx.badRequest('You cannot send a message to yourself')
    }

    // Set the sender to the authenticated user
    ctx.request.body.data.sender = user.id
    ctx.request.body.data.isRead = false

    const entity = await strapi.entityService.create('api::message.message', {
      data: ctx.request.body.data,
      populate: ['sender', 'receiver', 'car', 'conversation']
    })

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)
    return this.transformResponse(sanitizedResults)
  },

  // GET /api/messages/conversations - Lista conversas reais do usuário
  async conversations(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to view conversations')
    }

    // Buscar conversas reais do usuário
    const { results: conversations } = await strapi.entityService.findPage('api::conversation.conversation', {
      filters: {
        participants: {
          id: user.id
        }
      },
      sort: 'lastActivity:desc',
      populate: {
        participants: {
          fields: ['id', 'username', 'email']
        },
        car: {
          fields: ['id', 'title', 'price'],
          populate: {
            images: {
              fields: ['url', 'alternativeText']
            }
          }
        },
        messages: {
          sort: 'createdAt:desc',
          limit: 1, // Apenas a última mensagem
          populate: {
            sender: {
              fields: ['id', 'username']
            },
            receiver: {
              fields: ['id', 'username']
            }
          }
        }
      }
    })

    // Processar conversas para formato esperado pelo frontend
    const processedConversations = conversations.map((conversation: any) => {
      // Encontrar o outro participante
      const otherParticipant = conversation.participants?.find((p: any) => p.id !== user.id)
      
      // Pegar a última mensagem
      const lastMessage = conversation.messages?.[0] || null
      
      // Contar mensagens não lidas (simplificado)
      const unreadCount = 0 // TODO: implementar contagem real se necessário
      
      return {
        id: conversation.id, // ID real da conversa
        otherUser: otherParticipant,
        car: conversation.car,
        lastMessage,
        unreadCount,
        updatedAt: conversation.lastActivity || conversation.updatedAt
      }
    })

    const sanitizedResults = await this.sanitizeOutput(processedConversations, ctx)
    return this.transformResponse(sanitizedResults)
  }
}))