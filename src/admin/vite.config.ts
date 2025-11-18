import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    server: {
      host: true,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        'b181d97b5f6f.ngrok-free.app',
        '.ngrok.io',
        '.ngrok-free.app'
      ]
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  });
};