/**
 * conversation controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::conversation.conversation' as any, ({ strapi }) => ({
  // GET /api/conversations - Lista conversas do usuário logado
  async find(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to view conversations')
    }

    const { results, pagination } = await strapi.entityService.findPage('api::conversation.conversation', {
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
        lastMessage: {
          populate: {
            sender: {
              fields: ['id', 'username']
            }
          }
        }
      }
    })

    // Adicionar informações extras para cada conversa
    const enrichedResults = results.map((conversation: any) => {
      // Encontrar o outro participante (que não é o usuário atual)
      const otherParticipant = conversation.participants?.find((p: any) => p.id !== user.id)
      
      // Contar mensagens não lidas (será implementado depois)
      const unreadCount = 0 // TODO: implementar contagem real
      
      return {
        ...conversation,
        otherUser: otherParticipant,
        unreadCount
      }
    })

    const sanitizedResults = await this.sanitizeOutput(enrichedResults, ctx)
    return this.transformResponse(sanitizedResults, { pagination })
  },

  // GET /api/conversations/:id - Detalhes de uma conversa específica
  async findOne(ctx) {
    const user = ctx.state.user
    const { id } = ctx.params

    if (!user) {
      return ctx.unauthorized('You must be logged in to view conversations')
    }

    const entity = await strapi.entityService.findOne('api::conversation.conversation', id, {
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
        }
      }
    })

    if (!entity) {
      return ctx.notFound('Conversation not found')
    }

    // Verificar se o usuário faz parte desta conversa (simplificado)
    const isParticipant = (entity as any).participants?.some((p: any) => p.id === user.id)
    if (!isParticipant) {
      return ctx.forbidden('You are not authorized to view this conversation')
    }

    // ⚠️ PROBLEMA: sanitizeOutput remove participants, vamos preservar manualmente
    const otherParticipant = (entity as any).participants?.find((p: any) => p.id !== user.id)
    
    const conversationWithParticipants = {
      ...(entity as any),
      participants: (entity as any).participants?.map((p: any) => ({
        id: p.id,
        documentId: p.documentId,
        username: p.username,
        email: p.email
      })),
      otherUser: otherParticipant ? {
        id: otherParticipant.id,
        documentId: otherParticipant.documentId,
        username: otherParticipant.username,
        email: otherParticipant.email
      } : null
    }



    return this.transformResponse(conversationWithParticipants)
  },

  // POST /api/conversations - Criar ou encontrar conversa existente
  async create(ctx) {
    const user = ctx.state.user
    const { carId, participantId } = ctx.request.body.data

    if (!user) {
      return ctx.unauthorized('You must be logged in to create conversations')
    }

    if (!carId || !participantId) {
      return ctx.badRequest('Car ID and participant ID are required')
    }

    if (participantId === user.id) {
      return ctx.badRequest('You cannot create a conversation with yourself')
    }

    // Verificar se o participantId é um ID válido (não pode começar com 'unknown-')
    if (participantId.startsWith('unknown-')) {
      return ctx.badRequest('Invalid participant ID. The car seller information is not available.')
    }

    // Verificar se o participante existe na base de dados
    const participant = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: participantId }
    })

    if (!participant) {
      return ctx.badRequest(`Participant with ID ${participantId} not found`)
    }

    // Verificar se já existe uma conversa entre esses usuários para este carro
    const existingConversations = await strapi.db.query('api::conversation.conversation').findMany({
      where: {
        car: carId
      },
      populate: {
        participants: true,
        car: true,
        lastMessage: true
      }
    })

    // Filtrar manualmente para encontrar conversa com ambos os participantes
    const existingConversation = existingConversations.find((conv: any) => {
      const participantIds = conv.participants?.map((p: any) => p.id) || []
      return participantIds.includes(user.id) && participantIds.includes(parseInt(participantId))
    })

    if (existingConversation) {
      const sanitizedResults = await this.sanitizeOutput(existingConversation, ctx)
      return this.transformResponse(sanitizedResults)
    }

    // Criar nova conversa
    const entity = await strapi.entityService.create('api::conversation.conversation', {
      data: {
        participants: [user.id, participantId] as any,
        car: carId,
        lastActivity: new Date(),
        isActive: true
      },
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
        }
      }
    })

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)
    return this.transformResponse(sanitizedResults)
  }
}))