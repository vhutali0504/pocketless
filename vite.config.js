import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'client',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        id: '/app/',
        name: 'Pocketless',
        short_name: 'Pocketless',
        description: 'Keep your loyalty cards on your phone. Scan once, show at the till.',
        scope: '/app/',
        start_url: '/app/',
        display: 'standalone',
        theme_color: '#43144F',
        background_color: '#FFF6E6',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The shell: JS, CSS, HTML, woff2 fonts and icons. The ZXing scanner chunk is left out.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        globIgnores: ['**/zxing-*.js'],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
        runtimeCaching: [
          {
            // Scanner library: cached on first use so scanning still works offline afterwards.
            urlPattern: ({ url }) => /^\/assets\/zxing-[\w-]+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'zxing', expiration: { maxEntries: 4 } },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Name the lazily loaded scanner chunk so the service worker can cache it at runtime.
        manualChunks(id) {
          if (id.includes('node_modules/@zxing/')) return 'zxing';
        },
      },
    },
  },
});
