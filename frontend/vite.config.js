import { createViteDebugInspectorPlugin } from '@linhey/react-debug-inspector'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    createViteDebugInspectorPlugin(),
    react(),
  ],
})
