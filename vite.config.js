import { defineConfig } from 'vite'
import { assertCloudflarePagesBuildTarget } from './scripts/guard-cloudflare-pages-build.mjs'

assertCloudflarePagesBuildTarget()

export default defineConfig({
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        dev: 'dev.html',
      },
    },
  },
})
