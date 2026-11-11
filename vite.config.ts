// Vite configuration – adds React, Tailwind CSS v4, and PWA plugins
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Network-first for all Supabase API calls – bed data must never be stale (SPEC rule 5)
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'CareRoute – Tumakuru Hospital Availability',
        short_name: 'CareRoute',
        description: 'Real-time hospital bed availability for Tumakuru',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
