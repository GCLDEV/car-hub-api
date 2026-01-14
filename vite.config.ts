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
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.ts': 'tsx'
      }
    }
  },
  esbuild: {
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