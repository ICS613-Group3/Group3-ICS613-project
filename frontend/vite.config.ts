import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

// Vite dev server proxies /api/* to the FastAPI backend on port 8000.
// This means:
//   - The frontend can call /api/v1/... (relative path) and reach the
//     backend without CORS preflight or hard-coded hostnames.
//   - The VITE_API_BASE_URL env var defaults to "/api/v1" so production
//     builds served by the same origin (e.g. behind a reverse proxy)
//     also just work.
// If you change the backend port, update both the proxy target here and
// the CORS_ORIGINS list in backend/.env to match.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
