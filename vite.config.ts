import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      external: [
        'fs',
        'path',
        'os',
        'child_process',
        'crypto',
        'events',
        'stream',
        'util'
      ],
      output: {
        // Ensure browser compatibility
        format: 'es'
      }
    }
  }
});
