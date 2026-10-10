import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectRegister 'auto' adds the SW registration script to index.html
      // automatically — no manual main.tsx change needed.
      injectRegister: 'auto',
      includeAssets: ['og-share.png', 'icons/favicon-32.png', 'icons/favicon-16.png'],
      manifest: {
        name: 'STACKED',
        short_name: 'STACKED',
        description: 'A card game of stacks and consequences.',
        theme_color: '#0A0A0A',
        background_color: '#0A0A0A',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        // No orientation lock — game handles rotation.
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only. Music-loop is 2.29 MB and the lazy-
        // load track defers it to first user gesture; if Workbox precached
        // it here the SW would eager-download exactly the file we deferred,
        // undoing the perf win.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        // Smaller precache footprint — default max is 2 MB per file, which
        // would have caught the music anyway, but we exclude it explicitly.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 8090 },
})
