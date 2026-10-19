import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // Bundled deps (MPL-2.0, Apache-2.0) require their license texts to ship with the build.
  build: { license: { fileName: 'third-party-licenses.md' } },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
