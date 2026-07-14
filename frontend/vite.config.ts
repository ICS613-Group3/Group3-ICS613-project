import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Configure Vite and load environment variables for the current mode.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],

    // Forward local API requests to the configured backend server.
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,

          // Ivan's demo VM uses a self-signed HTTPS certificate.
          secure: false,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
