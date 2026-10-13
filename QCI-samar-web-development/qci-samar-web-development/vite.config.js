import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      output: {
        // Separate app code from dependencies for cross-deploy caching, and
        // isolate the heavy charting libs. Charts depend on the rest one-way,
        // so keeping everything else in a single vendor chunk avoids the
        // circular-chunk cycles that per-library splitting creates.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('@mui/x-charts')) {
              return 'chart-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
