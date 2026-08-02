import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api and /_ to a locally running PocketBase so the
// client can use same-origin relative URLs in development, exactly as it will
// in production where PocketBase serves the built app from pb_public/.
//
// VITE_BASE is set by scripts/build-static.sh for GitHub Pages project pages
// (e.g. /knoxel/). It is empty for PocketBase deployments, which serve at /.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8090', changeOrigin: true, ws: true },
      '/_': { target: 'http://127.0.0.1:8090', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode !== 'production',
  },
}))
