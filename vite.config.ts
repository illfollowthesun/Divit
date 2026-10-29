import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { previewExports } from './scripts/preview-exports.mjs'
export default defineConfig({ plugins: [react(), previewExports()], clearScreen: false, server: { port: 1420, strictPort: true }, build: { assetsInlineLimit: file => /.(aff|dic)$/.test(file) ? false : undefined }, envPrefix: ['VITE_', 'TAURI_ENV_'] })
