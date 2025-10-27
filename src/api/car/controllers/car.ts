/**
 * car controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::car.car', ({ strapi }) => ({
  // GET /api/cars
  async find(ctx) {
    const { query } = ctx

    // Extract custom filters
    const { 
      brand, 
      model, 
      yearFrom, 
      yearTo, 
      priceFrom, 
      priceTo, 
      kmFrom, 
      kmTo, 
      fuelType, 
      transmission, 
      color, 
      location,
      sortBy = 'createdAt:desc',
      ...otherQuery 
    } = query

    // Build filters object
    const filters: any = {}

    // Add brand filter
    if (brand) {
      filters.brand = { $containsi: brand }
    }

    // Add model filter  
    if (model) {
      filters.model = { $containsi: model }
    }

    // Add year range filter
    if (yearFrom || yearTo) {
      filters.year = {}
      if (yearFrom) filters.year.$gte = parseInt(yearFrom as string)
      if (yearTo) filters.year.$lte = parseInt(yearTo as string)
    }

    // Add price range filter
    if (priceFrom || priceTo) {
      filters.price = {}
      if (priceFrom) filters.price.$gte = parseInt(priceFrom as string)
      if (priceTo) filters.price.$lte = parseInt(priceTo as string)
    }

    // Add km range filter
    if (kmFrom || kmTo) {
      filters.km = {}
      if (kmFrom) filters.km.$gte = parseInt(kmFrom as string)
      if (kmTo) filters.km.$lte = parseInt(kmTo as string)
    }

    // Add exact filters
    if (fuelType) filters.fuelType = fuelType
    if (transmission) filters.transmission = transmission
    if (color) filters.color = { $containsi: color }
    if (location) filters.location = { $containsi: location }

    // Only show available cars by default
    if (!filters.status) {
      filters.status = 'available'
    }

    const queryOptions = {
      filters,
      sort: sortBy,
      populate: {
        images: true,
        seller: true
      }
    }

    const { results, pagination } = await strapi.entityService.findPage('api::car.car', queryOptions)

    const sanitizedResults = await this.sanitizeOutput(results, ctx)

    return this.transformResponse(sanitizedResults, { pagination })
  },

  // GET /api/cars/:id
  async findOne(ctx) {
    const { id } = ctx.params

    // Increment view count
    await strapi.entityService.update('api::car.car', id, {
      data: {
        views: (await strapi.entityService.findOne('api::car.car', id, { fields: ['views'] }))?.views + 1 || 1
      }
    })

    const entity = await strapi.entityService.findOne('api::car.car', id, {
      populate: {
        images: true,
        seller: true
      }
    })

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)

    return this.transformResponse(sanitizedResults)
  },

  // POST /api/cars
  async create(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to create a car listing')
    }

    // Set the seller to the authenticated user
    ctx.request.body.data.seller = user.id

    // Set default values
    ctx.request.body.data.status = 'available'
    ctx.request.body.data.views = 0

    const entity = await strapi.entityService.create('api::car.car', {
      data: ctx.request.body.data,
      populate: {
        images: true,
        seller: true
      }
    })

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)

    return this.transformResponse(sanitizedResults)
  },

  // PUT /api/cars/:id
  async update(ctx) {
    const { id } = ctx.params
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to update a car listing')
    }

    // Check if user owns this car
    const existingCar = await strapi.entityService.findOne('api::car.car', id, {
      populate: { seller: true }
    })

    if (!existingCar) {
      return ctx.notFound('Car not found')
    }

    if ((existingCar as any).seller?.id !== user.id) {
      return ctx.forbidden('You can only update your own car listings')
    }

    // Don't allow updating seller or views
    delete ctx.request.body.data.seller
    delete ctx.request.body.data.views

    const entity = await strapi.entityService.update('api::car.car', id, {
      data: ctx.request.body.data,
      populate: {
        images: true,
        seller: true
      }
    })

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)

    return this.transformResponse(sanitizedResults)
  },

  // DELETE /api/cars/:id
  async delete(ctx) {
    const { id } = ctx.params
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to delete a car listing')
    }

    // Check if user owns this car
    const existingCar = await strapi.entityService.findOne('api::car.car', id, {
      populate: { seller: true }
    })

    if (!existingCar) {
      return ctx.notFound('Car not found')
    }

    if ((existingCar as any).seller?.id !== user.id) {
      return ctx.forbidden('You can only delete your own car listings')
    }

    const entity = await strapi.entityService.delete('api::car.car', id)

    const sanitizedResults = await this.sanitizeOutput(entity, ctx)

    return this.transformResponse(sanitizedResults)
  }
}))