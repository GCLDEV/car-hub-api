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
    disabled: true, // Desabilita completamente a pré-otimização
  },
  esbuild: false, // Desabilita esbuild completamente
  build: {
    rollupOptions: {
      external: ['fsevents']
    },
    chunkSizeWarningLimit: 2000
  }
})