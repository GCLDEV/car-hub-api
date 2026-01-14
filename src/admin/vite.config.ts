import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    optimizeDeps: {
      // Disable force refresh to prevent esbuild service issues
      force: false,
      esbuildOptions: {
        // Disable keep alive to prevent "service stopped" errors
        keepAlive: false,
      }
    },
    esbuild: {
      // Disable keep alive for esbuild
      keepAlive: false,
    },
    server: {
      hmr: {
        overlay: false, // Disable HMR overlay that can cause issues
      }
    }
  });
};