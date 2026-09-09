import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['vim-mark.svg'],
      manifest: {
        id: 'https://learning-vim.phpz.org/',
        start_url: '/',
        scope: '/',
        name: 'Learning Vim',
        short_name: 'Learning Vim',
        description: 'A hands-on Vim course that works offline.',
        theme_color: '#17324d',
        background_color: '#f3f0e8',
        display: 'standalone',
        icons: [
          {
            src: '/vim-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,md,vim}'],
      },
    }),
  ],
})
