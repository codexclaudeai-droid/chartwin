// vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dev: fileURLToPath(new URL('./dev.html', import.meta.url)),
      },
    },
  },
})
