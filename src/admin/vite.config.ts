import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    optimizeDeps: {
      disabled: true, // Desabilita pré-otimização
    },
    esbuild: false, // Desabilita esbuild
    server: {
      hmr: {
        overlay: false,
      }
    }
  });
};