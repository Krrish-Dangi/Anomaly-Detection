import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose to local network (needed for mobile QR scanning)
    allowedHosts: true, // Allow Cloudflare Tunnel and other proxies to connect without DNS rebinding errors
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/clips': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/snapshots': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/frames': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
