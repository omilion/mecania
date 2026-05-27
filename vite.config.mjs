import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/uploads': 'http://127.0.0.1:8787',
    },
  },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 5200,
    rollupOptions: {
      input: resolve(root, 'index.html'),
      output: {
        manualChunks(id) {
          return id.includes('/src/vehicleData.js') || id.includes('\\src\\vehicleData.js')
            ? 'epa-vehicle-data'
            : undefined;
        },
      },
    },
  },
});
