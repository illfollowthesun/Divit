import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
// YAZI_UI_PORT lets two working trees (for example two agents on separate branches) test side by side.
const port = Number(process.env.YAZI_UI_PORT ?? 1420), origin = `http://127.0.0.1:${port}`
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
export default defineConfig({
  testDir: './tests/ui',
  // One Vite dev server serves every test; more parallel browsers than this make research and spelling tests time out.
  workers: process.env.YAZI_UI_WORKERS ? Number(process.env.YAZI_UI_WORKERS) : 4,
  // Playwright clears outputDir at startup. Separate runs must never clear each other's artifacts.
  outputDir: `./test-results/run-${process.pid}-${randomUUID()}`,
  use: { baseURL: origin, viewport: { width: 1440, height: 950 }, trace: 'retain-on-failure', launchOptions: { executablePath: process.env.YAZI_BROWSER_PATH || (existsSync(chrome) ? chrome : undefined) } },
  webServer: { command: port === 1420 ? 'npm.cmd run dev' : `npm.cmd run dev -- --port ${port}`, url: origin, reuseExistingServer: true },
})
