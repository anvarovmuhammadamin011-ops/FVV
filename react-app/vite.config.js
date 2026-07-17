import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend (backend/server.js) ni standart porti 5501.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5501';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, ws: true },
      '/uploads': { target: BACKEND, changeOrigin: true }
    }
  }
});
