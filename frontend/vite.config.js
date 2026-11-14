import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Review 1 API proxy: /api -> ASP.NET Core backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5168', changeOrigin: true },
    },
  },
})
