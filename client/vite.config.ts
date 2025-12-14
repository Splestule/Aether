import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "../shared"),
      // Fix for Cesium 1.114 import issue with @zip.js/zip.js
      "@zip.js/zip.js/lib/zip-no-worker.js": "@zip.js/zip.js",
    },
  },
  server: {
    port: 3000,
    host: true, // Allow external connections for VR testing
    allowedHosts: ["recognised-examined-nicole-bras.trycloudflare.com", ".trycloudflare.com", "localhost"], // Cloudflare Tunnel hostname",
  },
  build: {
    target: 'esnext', // Required for WebXR
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei', '@react-three/xr'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/xr'],
  },
})
