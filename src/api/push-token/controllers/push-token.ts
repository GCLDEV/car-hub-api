import pushNotificationService from '../../../services/pushNotificationService';

export default {
  /**
   * Registra um novo push token para o usuário autenticado
   */
  async register(ctx) {
    try {
      const { token, deviceType = 'android' } = ctx.request.body;
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      if (!token) {
        return ctx.badRequest('Token is required');
      }

      const success = await pushNotificationService.registerToken(userId, token, deviceType);

      if (success) {
        ctx.body = {
          message: 'Push token registered successfully',
          success: true
        };
      } else {
        ctx.badRequest('Failed to register push token');
      }
    } catch (error) {
      console.error('Error in register push token:', error);
      ctx.internalServerError('Internal server error');
    }
  },

  /**
   * Remove um push token do usuário autenticado
   */
  async unregister(ctx) {
    try {
      const { token } = ctx.request.body;
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      if (!token) {
        return ctx.badRequest('Token is required');
      }

      const success = await pushNotificationService.unregisterToken(userId, token);

      if (success) {
        ctx.body = {
          message: 'Push token unregistered successfully',
          success: true
        };
      } else {
        ctx.badRequest('Failed to unregister push token');
      }
    } catch (error) {
      console.error('Error in unregister push token:', error);
      ctx.internalServerError('Internal server error');
    }
  },

  /**
   * Lista os push tokens do usuário autenticado
   */
  async findMine(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      const tokens = await strapi.db.query('api::push-token.push-token').findMany({
        where: {
          user: userId,
          isActive: true
        },
        select: ['id', 'deviceType', 'createdAt']
      });

      ctx.body = {
        data: tokens,
        success: true
      };
    } catch (error) {
      console.error('Error in findMine push tokens:', error);
      ctx.internalServerError('Internal server error');
    }
  }
};