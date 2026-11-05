import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

// `@shared` is code imported by both the Node side (main/preload) and the Vue side.
const sharedAlias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
  },
  preload: {
    resolve: { alias: sharedAlias },
  },
  renderer: {
    resolve: {
      alias: { ...sharedAlias, '@renderer': resolve('src/renderer/src') },
    },
    plugins: [vue()],
    build: {
      rolldownOptions: {
        // One HTML page per window, so each window only loads what it needs.
        input: {
          index: resolve('src/renderer/index.html'),
          panel: resolve('src/renderer/panel.html'),
        },
      },
    },
  },
})
