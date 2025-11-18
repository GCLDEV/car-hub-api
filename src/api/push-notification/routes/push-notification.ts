export default {
  routes: [
    {
      method: 'GET',
      path: '/push-notifications/mine',
      handler: 'push-notification.findMine',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/push-notifications/:id/read',
      handler: 'push-notification.markAsRead',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/push-notifications/mark-all-read',
      handler: 'push-notification.markAllAsRead',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/push-notifications/unread-count',
      handler: 'push-notification.countUnread',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/push-notifications/test',
      handler: 'push-notification.sendTestNotification',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};