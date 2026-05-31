import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5114,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 12000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@babylonjs/core')) {
            return 'babylon-core';
          }
          if (id.includes('@babylonjs/havok')) {
            return 'babylon-havok';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})
