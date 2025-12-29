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
    const results = await strapi.entityService.findMany('api::message.message', {
      filters: {
        conversation: conversationId
      },
      sort: 'createdAt:asc',
      limit: -1, // Sem limite - buscar TODAS as mensagens
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

    const messagesWithUsers = results.map((message: any) => ({
      ...message,
      // Garantir que senderId/receiverId estejam disponíveis
      senderId: message.sender?.id || message.senderId,
      receiverId: message.receiver?.id || message.receiverId,
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



    return this.transformResponse(messagesWithUsers)
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



    // 🔌 WEBSOCKET: Emitir nova mensagem em tempo real
    try {
      if ((strapi as any).io && conversationId) {
        const messagePayload = {
          id: entity.id,
          content: entity.content,
          senderId: user.id,
          receiverId: finalReceiverId,
          conversationId,
          createdAt: entity.createdAt,
          isRead: false,
          type: entity.type || 'text',
          sender: {
            id: user.id,
            username: user.username
          },
          receiver: {
            id: finalReceiverId
          }
        };
        
        // Emitir evento new_message para todos na sala da conversa
        const roomName = `conversation:${conversationId}`;
        
        // Emitir para a sala (método principal)
        (strapi as any).io.to(roomName).emit('new_message', messagePayload);
        
        // Emitir para todos os sockets como fallback (para teste)
        (strapi as any).io.emit('new_message_broadcast', {
          ...messagePayload,
          broadcastType: 'fallback',
          originalRoom: roomName
        });
        
        // Também emitir para salas individuais dos usuários como fallback
        (strapi as any).io.to(`user:${finalReceiverId}`).emit('new_message', messagePayload);
        

        
        // Atualizar lastActivity da conversa
        await strapi.entityService.update('api::conversation.conversation', conversationId, {
          data: {
            lastActivity: new Date(),
            lastMessage: entity.id
          }
        });
      } else {
        
      }
    } catch (error) {
      strapi.log.error('Erro ao emitir mensagem via WebSocket:', error);
    }

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)
    
    // Garantir que temos um objeto base para trabalhar
    const baseResult = typeof sanitizedResults === 'object' && sanitizedResults !== null 
      ? sanitizedResults 
      : { id: entity.id, content: entity.content }
    
    // Garantir que o resultado inclua os dados essenciais
    const enhancedResult = Object.assign({}, baseResult, {
      // Adicionar dados do sender (usuário atual)
      senderId: user.id,
      sender: {
        id: user.id,
        username: user.username
      },
      // Adicionar dados do receiver
      receiverId: finalReceiverId,
      receiver: {
        id: finalReceiverId
      }
    }) as any
    

    
    return this.transformResponse(enhancedResult)
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
