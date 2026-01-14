import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    optimizeDeps: {
      // Prevent force refresh to avoid esbuild issues
      force: false,
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
          '.ts': 'tsx'
        }
      }
    },
    server: {
      hmr: {
        overlay: false, // Disable HMR overlay that can cause issues
      }
    }
  });
};