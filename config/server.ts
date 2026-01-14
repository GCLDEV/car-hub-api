export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'http://3.236.112.142:1337'),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Configuração personalizada para WebSocket
  extensions: {
    socket: {
      enabled: true,
    },
  },
});
