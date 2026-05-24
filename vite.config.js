import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const indexHtml = fileURLToPath(new URL('./index.html', import.meta.url))
const devHtml = fileURLToPath(new URL('./dev.html', import.meta.url))

export default defineConfig({
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      input: {
        main: indexHtml,
        dev: devHtml,
      },
    },
  },
})
