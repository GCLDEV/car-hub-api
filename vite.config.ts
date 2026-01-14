import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 1337,
    hmr: {
      port: 1337
    }
  },
  optimizeDeps: {
    force: false,
    disabled: false,
    esbuildOptions: {
      // Disable esbuild service to fix the error
      keepAlive: false,
      loader: {
        '.js': 'jsx',
        '.ts': 'tsx'
      }
    }
  },
  esbuild: {
    // Disable esbuild service worker
    keepAlive: false,
    logOverride: {
      'this-is-undefined-in-esm': 'silent'
    }
  },
  build: {
    rollupOptions: {
      external: ['fsevents']
    },
    chunkSizeWarningLimit: 2000
  }
})