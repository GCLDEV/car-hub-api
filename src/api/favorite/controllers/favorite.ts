/**
 * favorite controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::favorite.favorite', ({ strapi }) => ({
  // GET /api/favorites
  async find(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to view favorites')
    }

    const { results, pagination } = await strapi.entityService.findPage('api::favorite.favorite', {
      filters: {
        user: user.id
      },
      populate: {
        car: {
          populate: {
            images: true,
            seller: true
          }
        }
      }
    })

    const sanitizedResults = await this.sanitizeOutput(results, ctx)

    return this.transformResponse(sanitizedResults, { pagination })
  },

  // POST /api/favorites
  async create(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to add favorites')
    }

    const { car: carId } = ctx.request.body.data

    if (!carId) {
      return ctx.badRequest('Car ID is required')
    }

    // Check if car exists
    const car = await strapi.entityService.findOne('api::car.car', carId)
    if (!car) {
      return ctx.notFound('Car not found')
    }

    // Check if already favorited
    const existingFavorite = await strapi.entityService.findMany('api::favorite.favorite', {
      filters: {
        user: user.id,
        car: carId
      }
    })

    if (existingFavorite.length > 0) {
      return ctx.badRequest('Car is already in your favorites')
    }

    // Set the user to the authenticated user
    ctx.request.body.data.user = user.id



    const entity = await strapi.entityService.create('api::favorite.favorite', {
      data: ctx.request.body.data,
      populate: {
        car: true
      }
    })

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)

    return this.transformResponse(sanitizedResults)
  },

  // DELETE /api/favorites/:id
  async delete(ctx) {
    const { id } = ctx.params
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to remove favorites')
    }

    // Check if user owns this favorite
    const existingFavorite = await strapi.entityService.findOne('api::favorite.favorite', id, {
      populate: { user: true }
    })

    if (!existingFavorite) {
      return ctx.notFound('Favorite not found')
    }

    if ((existingFavorite as any).user?.id !== user.id) {
      return ctx.forbidden('You can only remove your own favorites')
    }

    const entity = await strapi.entityService.delete('api::favorite.favorite', id)

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)

    return this.transformResponse(sanitizedResults)
  },

  // Custom endpoint: DELETE /api/favorites/by-car/:carId
  async removeByCarId(ctx) {
    const { carId } = ctx.params
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to remove favorites')
    }

    // Find the favorite by user and car
    const favorite = await strapi.entityService.findMany('api::favorite.favorite', {
      filters: {
        user: user.id,
        car: carId
      }
    })

    if (favorite.length === 0) {
      return ctx.notFound('Favorite not found')
    }

    const entity = await strapi.entityService.delete('api::favorite.favorite', favorite[0].id)

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)

    return this.transformResponse(sanitizedResults)
  }
}))