/**
 * car controller
 * Custom controller with advanced filtering capabilities
 * Following Strapi v5 REST API and controller customization best practices
 */

import { factories } from '@strapi/strapi'

// Helper function to parse sort parameters
function parseSortParam(sortBy: string): string {
  const sortMap = {
    'price_asc': 'price:asc',
    'price_desc': 'price:desc', 
    'year_asc': 'year:asc',
    'year_desc': 'year:desc',
    'km_asc': 'km:asc',
    'km_desc': 'km:desc',
    'created_at': 'createdAt:desc',
    'updated_at': 'updatedAt:desc',
    'title_asc': 'title:asc',
    'title_desc': 'title:desc'
  }

  return sortMap[sortBy] || 'createdAt:desc'
}

export default factories.createCoreController('api::car.car', ({ strapi }) => ({
  // GET /api/cars - Enhanced find method with better defaults
  async find(ctx) {
    try {
      // Extract query parameters
      const { query } = ctx
      const user = ctx.state.user // Get authenticated user (can be null)
      
      // Ensure we always show available cars by default unless explicitly overridden
      const filters = query.filters || {}
      if (typeof filters === 'object' && filters !== null && !('status' in filters)) {
        query.filters = {
          status: 'available',
          ...filters
        }
      }

      // 🚫 EXCLUDE own cars when user is authenticated
      if (user?.id) {
        const currentFilters = query.filters || {}
        query.filters = Object.assign({}, currentFilters, {
          seller: {
            id: {
              $ne: user.id // Exclude cars where seller.id != current user.id
            }
          }
        })
      }

      // Use Strapi's entityService to find cars with the modified query
      const { results, pagination } = await strapi.entityService.findPage(
        'api::car.car',
        {
          ...query,
          populate: {
            images: true,
            seller: true
          }
        }
      )

      // Sanitize and transform the response
      const sanitizedResults = await this.sanitizeOutput(results, ctx)
      return this.transformResponse(sanitizedResults, { pagination })
      
    } catch (error) {
      strapi.log.error('Error in car find controller:', error)
      return ctx.badRequest('Error filtering cars', { 
        error: error.message,
        details: 'Check your filter parameters and try again'
      })
    }
  },

  // GET /api/cars/search - Custom search endpoint with advanced filters
  async search(ctx) {
    const { query } = ctx
    const user = ctx.state.user // Get authenticated user

    try {
      // Extract search parameters
      const {
        q, // General search query
        brand,
        model,
        category,
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
        page = 1,
        pageSize = 25
      } = query

      strapi.log.info('Search parameters received:', {
        q,
        brand,
        yearFrom,
        yearTo,
        priceFrom,
        priceTo,
        fuelType,
        transmission
      })

      // Build advanced filters object
      const filters: any = {
        status: 'available' // Always filter available cars
      }

      // 🚫 EXCLUDE own cars when user is authenticated
      if (user?.id) {
        filters.seller = {
          id: {
            $ne: user.id // Exclude cars where seller.id != current user.id
          }
        }
      }

      // General text search across multiple fields
      if (q) {
        filters.$or = [
          { title: { $containsi: q } },
          { brand: { $containsi: q } },
          { model: { $containsi: q } },
          { description: { $containsi: q } },
          { location: { $containsi: q } }
        ]
      }

      // Exact match filters (case insensitive where appropriate)
      if (brand) filters.brand = { $eqi: brand }
      if (model) filters.model = { $eqi: model }
      if (category) filters.category = { $eqi: category }
      if (fuelType) filters.fuelType = { $eqi: fuelType }
      if (transmission) filters.transmission = { $eqi: transmission }
      if (color) filters.color = { $containsi: color }
      if (location) filters.location = { $containsi: location }

      // Range filters
      if (yearFrom || yearTo) {
        filters.year = {}
        if (yearFrom) filters.year.$gte = parseInt(yearFrom as string, 10)
        if (yearTo) filters.year.$lte = parseInt(yearTo as string, 10)
        strapi.log.info('Year filters applied:', filters.year)
      }

      if (priceFrom || priceTo) {
        filters.price = {}
        if (priceFrom) filters.price.$gte = parseInt(priceFrom as string, 10)
        if (priceTo) filters.price.$lte = parseInt(priceTo as string, 10)
      }

      if (kmFrom || kmTo) {
        filters.km = {}
        if (kmFrom) filters.km.$gte = parseInt(kmFrom as string, 10)
        if (kmTo) filters.km.$lte = parseInt(kmTo as string, 10)
      }

      strapi.log.info('Final filters object:', JSON.stringify(filters, null, 2))

      // Parse sort parameter
      const parsedSort = parseSortParam(sortBy as string)

      // Advanced query options
      const queryOptions = {
        filters,
        sort: parsedSort,
        populate: {
          images: true,
          seller: true
        },
        pagination: {
          page: parseInt(page as string, 10),
          pageSize: Math.min(parseInt(pageSize as string, 10), 100) // Max 100 items per page
        }
      }

      const { results, pagination } = await strapi.entityService.findPage(
        'api::car.car',
        queryOptions as any
      )

      const sanitizedResults = await this.sanitizeOutput(results, ctx)

      strapi.log.info(`Search returned ${results.length} cars`)

      return this.transformResponse(sanitizedResults, { 
        pagination,
        meta: {
          searchQuery: q,
          appliedFilters: Object.keys(filters).filter(key => key !== 'status'),
          totalFilters: Object.keys(filters).length - 1 // Exclude default status filter
        }
      })

    } catch (error) {
      strapi.log.error('Error in car search controller:', error)
      return ctx.badRequest('Search failed', {
        error: error.message,
        details: 'Check your search parameters and try again'
      })
    }
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
        seller: {
          fields: ['id', 'username', 'email', 'name']
        }
      }
    })

    // ⚠️ PROBLEMA IDENTIFICADO: sanitizeOutput remove o seller por questões de permissão
    // Vamos preservar o seller manualmente
    const result = {
      ...(entity as any),
      seller: (entity as any)?.seller ? {
        id: (entity as any).seller.id,
        documentId: (entity as any).seller.documentId,
        username: (entity as any).seller.username,
        // Não incluir email por segurança em produção
      } : null
    }

    return this.transformResponse(result)
  },

  // POST /api/cars
  async create(ctx) {
    const user = ctx.state.user



    if (!user) {
      return ctx.unauthorized('You must be logged in to create a car listing')
    }

    // Set the seller to the authenticated user
    ctx.request.body.data.seller = user.id

    // Validate and set status
    const validStatuses = ['available', 'sold', 'reserved']
    if (!ctx.request.body.data.status || !validStatuses.includes(ctx.request.body.data.status)) {
      ctx.request.body.data.status = 'available'
    }

    // Set default values
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

    // Debug: Log received data
    // Validate status if provided
    if (ctx.request.body.data.status) {
      const validStatuses = ['available', 'sold', 'reserved']
      if (!validStatuses.includes(ctx.request.body.data.status)) {
        ctx.request.body.data.status = 'available' // Force valid value instead of error
      }
    }

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
  },

  // Buscar carros do usuário logado
  async findUserCars(ctx) {
    const { user } = ctx.state

    if (!user) {
      return ctx.unauthorized('You must be authenticated to view your cars')
    }

    try {
      const entities = await strapi.entityService.findMany('api::car.car', {
        filters: {
          seller: user.id
        },
        populate: {
          images: true
        },
        sort: { createdAt: 'desc' }
      })

      const sanitizedResults = await this.sanitizeOutput(entities, ctx)
      return this.transformResponse(sanitizedResults)
    } catch (error) {
      console.error('❌ Erro ao buscar carros do usuário:', error)
      ctx.throw(500, 'Erro ao buscar carros do usuário')
    }
  }
}))