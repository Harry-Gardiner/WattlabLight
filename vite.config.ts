import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site from /<repo>/
const base = '/WattlabLight/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' = app shows an "update ready, reload" toast instead of silently swapping
      registerType: 'prompt',
      manifest: {
        name: 'WattlabLight',
        short_name: 'Wattlab',
        description: 'Indoor cycling with your Bluetooth smart trainer',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B0F14',
        theme_color: '#0B0F14',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,json,woff2}'] },
    }),
  ],
  test: { environment: 'node' },
})
