import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react() as unknown as PluginOption],
  server: {
    port: 5173,
    strictPort: true
  }
})
