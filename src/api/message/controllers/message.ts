/**
 * message controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::message.message', ({ strapi }) => ({
  // GET /api/messages
  async find(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to view messages')
    }

    const { results, pagination } = await strapi.entityService.findPage('api::message.message', {
      filters: {
        $or: [
          { sender: user.id },
          { receiver: user.id }
        ]
      },
      sort: 'createdAt:desc',
      populate: ['sender', 'receiver', 'car']
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
  }
}))