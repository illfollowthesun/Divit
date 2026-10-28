import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/ui',
  use: { baseURL: 'http://127.0.0.1:1420', viewport: { width: 1440, height: 950 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm.cmd run dev', url: 'http://127.0.0.1:1420', reuseExistingServer: false },
})
