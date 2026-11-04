import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Keep the big charting library separate; everything else in one vendor chunk
        // (splitting React-dependent libs apart causes circular-init crashes).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/recharts|d3-|victory-vendor/.test(id)) return 'charts';
          return 'vendor';
        },
      },
    },
  },
});
