export default {
  /**
   * Lista as notificações do usuário autenticado
   */
  async findMine(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      const { page = 1, pageSize = 20 } = ctx.query;

      const notifications = await strapi.db.query('api::push-notification.push-notification').findWithCount({
        where: {
          recipient: userId
        },
        orderBy: { createdAt: 'desc' },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        populate: {
          sender: {
            select: ['id', 'username', 'email']
          }
        }
      });

      ctx.body = {
        data: notifications[0],
        meta: {
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            pageCount: Math.ceil(notifications[1] / pageSize),
            total: notifications[1]
          }
        }
      };
    } catch (error) {
      console.error('Error in findMine notifications:', error);
      ctx.internalServerError('Internal server error');
    }
  },

  /**
   * Marca uma notificação como lida
   */
  async markAsRead(ctx) {
    try {
      const { id } = ctx.params;
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      const notification = await strapi.db.query('api::push-notification.push-notification').findOne({
        where: { id, recipient: userId }
      });

      if (!notification) {
        return ctx.notFound('Notification not found');
      }

      await strapi.db.query('api::push-notification.push-notification').update({
        where: { id },
        data: { isRead: true }
      });

      ctx.body = {
        message: 'Notification marked as read',
        success: true
      };
    } catch (error) {
      console.error('Error in markAsRead notification:', error);
      ctx.internalServerError('Internal server error');
    }
  },

  /**
   * Marca todas as notificações como lidas
   */
  async markAllAsRead(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      await strapi.db.query('api::push-notification.push-notification').updateMany({
        where: { 
          recipient: userId,
          isRead: false 
        },
        data: { isRead: true }
      });

      ctx.body = {
        message: 'All notifications marked as read',
        success: true
      };
    } catch (error) {
      console.error('Error in markAllAsRead notifications:', error);
      ctx.internalServerError('Internal server error');
    }
  },

  /**
   * Conta notificações não lidas
   */
  async countUnread(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      const count = await strapi.db.query('api::push-notification.push-notification').count({
        where: { 
          recipient: userId,
          isRead: false 
        }
      });

      ctx.body = {
        count,
        success: true
      };
    } catch (error) {
      console.error('Error in countUnread notifications:', error);
      ctx.internalServerError('Internal server error');
    }
  },

  /**
   * Envia uma notificação de teste para o usuário autenticado
   */
  async sendTestNotification(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('User not authenticated');
      }

      const pushNotificationService = require('../../../services/pushNotificationService').default;

      const success = await pushNotificationService.sendNotification({
        recipientId: userId,
        senderId: userId,
        title: '🧪 Notificação de Teste',
        body: 'Esta é uma notificação de teste do Car Hub! Tudo funcionando perfeitamente.',
        type: 'message_from_seller',
        data: {
          test: true,
          timestamp: Date.now()
        }
      });

      ctx.body = {
        message: success ? 'Test notification sent successfully' : 'Failed to send test notification',
        success,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in sendTestNotification:', error);
      ctx.internalServerError('Internal server error');
    }
  }
};