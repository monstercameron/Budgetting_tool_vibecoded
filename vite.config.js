import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  return {
    root: 'src',
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: '../docs',
      emptyOutDir: true
    }
  }
})
