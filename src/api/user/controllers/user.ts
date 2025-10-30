/**
 * A set of functions called "actions" for `user`
 */

export default {
  async me(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in to access this resource')
      }

      // Buscar dados do usuário logado com avatar populado
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: ctx.state.user.id },
        populate: {
          avatar: true
        }
      })

      if (!user) {
        return ctx.notFound('User not found')
      }

      // Sanitizar dados (remover campos sensíveis)
      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        phone: user.phone,
        location: user.location,
        cityState: user.cityState,
        isDealer: user.isDealer,
        avatar: user.avatar ? {
          id: user.avatar.id,
          url: user.avatar.url,
          formats: user.avatar.formats
        } : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }

      ctx.send({ data: sanitizedUser })
    } catch (error) {
      ctx.throw(500, `Internal server error: ${error.message}`)
    }
  },

  async updateMe(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in to access this resource')
      }

      const userId = ctx.state.user.id
      const { data } = ctx.request.body

      // Campos permitidos para atualização
      const allowedFields = ['name', 'phone', 'location', 'cityState', 'isDealer', 'avatar']
      const updateData = {}

      // Filtrar apenas campos permitidos
      allowedFields.forEach(field => {
        if (data && data[field] !== undefined) {
          updateData[field] = data[field]
        }
      })

      // Se não há dados para atualizar
      if (Object.keys(updateData).length === 0) {
        return ctx.badRequest('No valid fields provided for update')
      }

      // Atualizar usuário
      const updatedUser = await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: userId },
        data: updateData,
        populate: {
          avatar: true
        }
      })

      if (!updatedUser) {
        return ctx.notFound('User not found')
      }

      // Sanitizar resposta
      const sanitizedUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        location: updatedUser.location,
        cityState: updatedUser.cityState,
        isDealer: updatedUser.isDealer,
        avatar: updatedUser.avatar ? {
          id: updatedUser.avatar.id,
          url: updatedUser.avatar.url,
          formats: updatedUser.avatar.formats
        } : null,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }

      ctx.send(sanitizedUser)
    } catch (error) {
      strapi.log.error('Error updating user profile:', error)
      ctx.throw(500, `Internal server error: ${error.message}`)
    }
  }
}