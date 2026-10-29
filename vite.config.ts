import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // API proxy: the browser talks same-origin to /api, Vite forwards to the backend.
    // The NVIDIA key and every other secret stay strictly on the backend side.
    proxy: {
      '/api': {
        target: process.env.HEALFORGE_API_URL || 'http://127.0.0.1:8001',
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.HEALFORGE_API_URL || 'http://127.0.0.1:8001',
        changeOrigin: false,
      },
    },
  },
})
