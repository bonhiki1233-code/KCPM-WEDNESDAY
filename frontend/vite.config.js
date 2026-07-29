import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections (required for Docker)
    port: 3000,
    watch: {
      usePolling: true, // Required for file watching in Docker
    },
    hmr: {
      clientPort: 3000, // Port for HMR connection
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})

