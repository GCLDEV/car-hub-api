export default {
  routes: [
    {
      method: 'POST',
      path: '/push-tokens/register',
      handler: 'push-token.register',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/push-tokens/unregister',
      handler: 'push-token.unregister',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/push-tokens/mine',
      handler: 'push-token.findMine',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};