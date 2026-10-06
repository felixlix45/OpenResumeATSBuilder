import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    // pdfjs is large; keep it in its own chunk so the editor shell boots fast.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('@react-pdf') || id.includes('pdfkit')) return 'pdf-renderer';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@react-pdf/renderer', 'pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
