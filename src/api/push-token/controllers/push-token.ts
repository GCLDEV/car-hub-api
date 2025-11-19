/**
 * push-token controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::push-token.push-token' as any, ({ strapi }) => ({
  // POST /api/push-tokens/register
  async register(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to register a push token')
    }

    const { token, deviceType = 'android' } = ctx.request.body

    if (!token) {
      return ctx.badRequest('Token is required')
    }

    try {
      // Verificar se já existe um token para este usuário e dispositivo
      const existingToken = await strapi.entityService.findMany('api::push-token.push-token' as any, {
        filters: {
          user: user.id,
          token: token
        }
      })

      if (existingToken.length > 0) {
        // Atualizar token existente para ativo
        const updatedToken = await strapi.entityService.update('api::push-token.push-token' as any, existingToken[0].id, {
          data: {
            isActive: true,
            deviceType
          }
        })

        console.log('✅ Push token atualizado:', { userId: user.id, token: token.substring(0, 20) + '...' })
        
        return ctx.send({
          message: 'Push token updated successfully',
          data: updatedToken
        })
      }

      // Criar novo token
      const newToken = await strapi.entityService.create('api::push-token.push-token' as any, {
        data: {
          token,
          deviceType,
          user: user.id,
          isActive: true
        }
      })

      console.log('✅ Novo push token registrado:', { userId: user.id, token: token.substring(0, 20) + '...' })

      return ctx.send({
        message: 'Push token registered successfully',
        data: newToken
      })

    } catch (error) {
      console.error('❌ Erro ao registrar push token:', error)
      return ctx.internalServerError('Error registering push token')
    }
  },

  // POST /api/push-tokens/unregister
  async unregister(ctx) {
    const user = ctx.state.user

    if (!user) {
      return ctx.unauthorized('You must be logged in to unregister a push token')
    }

    const { token } = ctx.request.body

    if (!token) {
      return ctx.badRequest('Token is required')
    }

    try {
      // Encontrar e desativar o token
      const existingTokens = await strapi.entityService.findMany('api::push-token.push-token' as any, {
        filters: {
          user: user.id,
          token: token
        }
      })

      if (existingTokens.length === 0) {
        return ctx.notFound('Push token not found')
      }

      // Desativar o token em vez de deletar
      await strapi.entityService.update('api::push-token.push-token' as any, existingTokens[0].id, {
        data: {
          isActive: false
        }
      })

      console.log('✅ Push token desregistrado:', { userId: user.id, token: token.substring(0, 20) + '...' })

      return ctx.send({
        message: 'Push token unregistered successfully'
      })

    } catch (error) {
      console.error('❌ Erro ao desregistrar push token:', error)
      return ctx.internalServerError('Error unregistering push token')
    }
  }
}))