import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const realRoot = fs.realpathSync(process.cwd());

// https://vite.dev/config/
export default defineConfig({
  root: realRoot,
  plugins: [react()],
  build: {
    outDir: path.resolve(realRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/recharts')) {
            return 'recharts';
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'pdf';
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }
        }
      }
    }
  }
})
