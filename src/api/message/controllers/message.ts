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
        conversation: conversationId
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

    console.log(`📋 Buscando mensagens da conversa ${conversationId}:`, {
      totalMessages: results.length,
      userId: user.id,
      messageIds: results.map(msg => msg.id)
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

    console.log('💾 Criando mensagem com dados:', {
      content: ctx.request.body.data.content,
      senderId: ctx.request.body.data.sender,
      receiverId: ctx.request.body.data.receiver,
      conversationId: ctx.request.body.data.conversation
    })

    const entity = await strapi.entityService.create('api::message.message', {
      data: ctx.request.body.data,
      populate: ['sender', 'receiver', 'car', 'conversation']
    })

    console.log('✅ Mensagem criada com sucesso:', {
      messageId: entity.id,
      content: entity.content,
      conversationId: (entity as any).conversation?.id
    })

    // 🔌 WEBSOCKET: Emitir nova mensagem em tempo real
    try {
      if ((strapi as any).io && conversationId) {
        const messagePayload = {
          id: entity.id,
          content: entity.content,
          senderId: user.id,
          conversationId,
          createdAt: entity.createdAt,
          isRead: false,
          type: entity.type || 'text',
          sender: {
            id: user.id,
            username: user.username
          }
        };
        
        // Emitir evento newMessage para todos na sala da conversa
        (strapi as any).io.to(`conversation-${conversationId}`).emit('newMessage', messagePayload);
        
        console.log(`📡 Mensagem emitida via WebSocket para conversa ${conversationId}:`, {
          messageId: entity.id,
          content: entity.content.substring(0, 50) + '...',
          senderId: user.id,
          roomName: `conversation-${conversationId}`
        });
        
        // Verificar quantos clientes estão na sala
        const room = (strapi as any).io.sockets.adapter.rooms.get(`conversation-${conversationId}`);
        console.log(`👥 Clientes na sala conversation-${conversationId}:`, room?.size || 0);
        
        // Atualizar lastActivity da conversa
        await strapi.entityService.update('api::conversation.conversation', conversationId, {
          data: {
            lastActivity: new Date(),
            lastMessage: entity.id
          }
        });
      } else {
        console.log('⚠️ WebSocket não disponível ou conversationId não fornecido');
      }
    } catch (error) {
      strapi.log.error('Erro ao emitir mensagem via WebSocket:', error);
    }

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