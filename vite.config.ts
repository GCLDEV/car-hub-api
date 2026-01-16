import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 1337
  },
  build: {
    rollupOptions: {
      external: ['fsevents']
    },
    chunkSizeWarningLimit: 2000
  }
})