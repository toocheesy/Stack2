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
      includeAssets: ['icons/favicon-32.png', 'icons/favicon-16.png'],
      manifest: {
        name: 'STACKED',
        short_name: 'STACKED',
        description: 'Pull up a chair. Build combos, capture the table, and race two opponents to the score.',
        theme_color: '#FFF4B8',
        background_color: '#FFF4B8',
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
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 8090 },
})
