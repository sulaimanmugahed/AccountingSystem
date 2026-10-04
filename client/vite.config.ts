import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5074'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const useMock = (env.VITE_USE_MOCK ?? (mode === 'mock' ? 'true' : 'false')) === 'true'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT ?? 5173),
      strictPort: false,
      // The preview host is proxied (https://<port>-<sandbox>.e2b.app); allow it.
      allowedHosts: true,
      cors: true,
      proxy: useMock
        ? undefined
        : {
            '/api': { target: API_TARGET, changeOrigin: true, secure: false },
          },
    },
    preview: { host: '0.0.0.0', port: Number(env.VITE_PORT ?? 4173), allowedHosts: true },
    build: { outDir: 'dist', sourcemap: false },
  }
})
