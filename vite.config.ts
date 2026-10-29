import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { previewExports } from './scripts/preview-exports.mjs'
import { previewResearch } from './scripts/preview-research.mjs'
export default defineConfig({
  plugins: [react(), previewExports(), previewResearch()], clearScreen: false,
  // Only the app's sources need watching. Preview data, test output and the Rust side change constantly
  // during tests and would otherwise keep the dev server busy.
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/.tmp/**', '**/test-results/**', '**/playwright-report/**', '**/src-tauri/**', '**/docs/**', '**/.tools/**'] } },
  // Spelling dictionaries are fetched by a worker; the desktop CSP allows 'self' but not data: URLs.
  build: { assetsInlineLimit: file => /\.(aff|dic)$/.test(file) ? false : undefined },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
})
