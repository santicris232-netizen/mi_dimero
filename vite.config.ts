import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') } },
  build: { outDir: 'build', chunkSizeWarningLimit: 1200 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'tutor/*.png'],
      manifest: {
        name: 'Mi Control Financiero',
        short_name: 'Mi Control',
        description: 'Tu asistente personal para organizar ingresos, salir de deudas y cumplir tus metas.',
        lang: 'es-CO',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b1324',
        theme_color: '#0b1324',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Los datos financieros de Supabase nunca se guardan en caché del service worker.
        runtimeCaching: [{ urlPattern: /supabase\.co/, handler: 'NetworkOnly' }],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
