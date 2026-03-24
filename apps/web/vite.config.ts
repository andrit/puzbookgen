import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // @puzzle-book/shared is type-only in the client (import type).
      // Point to compiled dist/ so Vite doesn't try to bundle server-side code.
      '@puzzle-book/shared': resolve(__dirname, '../../packages/shared/dist/index.js'),
    },
  },
})
