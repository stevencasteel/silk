import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
    chunkSizeWarningLimit: 12000, // Adjusted threshold to reflect consolidated chunks
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Bundles all modular Babylon assets together to reduce network request overhead
          if (id.includes('@babylonjs')) {
            return 'babylon';
          }
        }
      }
    }
  }
})
