import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
    // Browsers the portal supports; public/browser-check.js shows an "update your
    // browser" message below these instead of a loader that never finishes. (The
    // browserslist field in package.json is not read by Vite.)
    target: ['chrome107', 'edge107', 'firefox104', 'safari15.4'],
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1700,
    // constants/Icons.js imports ~280 SVGs, which are statically imported by the startup
    // graph. Inlined as data URIs (Vite's default under 4 KB) they made up more than half
    // of the shared 'AccountAction' chunk (~350 KB) that every page, Login included,
    // downloads. Emitted as files they are fetched only when an icon is actually shown and
    // cached immutably like any other hashed asset. Other small assets still inline.
    assetsInlineLimit: filePath => (filePath.endsWith('.svg') ? false : undefined),
    rolldownOptions: {
      output: {
        // Separate app code from dependencies for cross-deploy caching, and keep the
        // charting libraries out of the startup bundle.
        //
        // The previous manualChunks put recharts/@mui/x-charts in 'chart-vendor', but a
        // chunk group also captures its modules' dependencies, and that group claimed
        // React, emotion, MUI and Redux first, so the "chart" chunk was modulepreloaded on
        // every page, Login included. Now:
        //  - 'vendor' takes every dependency the entry imports statically ($initial), at
        //    the higher priority, so shared libraries are always settled here first;
        //  - 'chart-vendor' takes the charting libraries and whatever they pull in that is
        //    not already in vendor (d3, decimal.js, ...). Charts are only imported by the
        //    lazily loaded dashboards (the App*ChartCard components are kept out of the
        //    components/base barrel), so this chunk loads with them and is not preloaded.
        // Any other lazily used dependency falls through to the default splitting.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, tags: ['$initial'], priority: 20 },
            { name: 'chart-vendor', test: /[\\/]node_modules[\\/](recharts|@mui[\\/]x-charts)[\\/]/, priority: 10 },
          ],
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
