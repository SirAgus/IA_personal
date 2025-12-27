import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png'],
      manifest: {
        name: 'IA Chat Personal',
        short_name: 'IA Chat',
        description: 'Mi asistente personal de IA con agentes personalizados',
        theme_color: '#0f0f11',
        background_color: '#0f0f11',
        display: 'standalone',
        icons: [
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  envPrefix: ['VITE_', 'CHAT_', 'AUTH_', 'SERPAPI_', 'API_KEY_'],
  server: {
    proxy: {
      '/api/serpapi': {
        target: 'https://serpapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/serpapi/, '')
      }
    }
  }
})
