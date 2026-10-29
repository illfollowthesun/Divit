import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
export default defineConfig({
  testDir: './tests/ui',
  // Playwright clears outputDir at startup. Separate runs must never clear each other's artifacts.
  outputDir: `./test-results/run-${process.pid}-${randomUUID()}`,
  use: { baseURL: 'http://127.0.0.1:1420', viewport: { width: 1440, height: 950 }, trace: 'retain-on-failure', launchOptions: { executablePath: process.env.YAZI_BROWSER_PATH || (existsSync(chrome) ? chrome : undefined) } },
  webServer: { command: 'npm.cmd run dev', url: 'http://127.0.0.1:1420', reuseExistingServer: true },
})
