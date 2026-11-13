// Real Vite + browser + spelling worker, with a fresh cache and browser library.
// Run separately from test:ui so a reused dev server cannot hide late optimization.
import { createServer, createLogger } from 'vite'
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const output = resolve('.tmp', `cold-start-${randomUUID()}`)
await mkdir(output, { recursive: true })
const events = []
const logger = createLogger()
const info = logger.info.bind(logger)
logger.info = (message, options) => { events.push({ kind: 'vite', message }); info(message, options) }
let server, browser
try {
  server = await createServer({ configLoader: 'runner', customLogger: logger,
    cacheDir: resolve(output, 'node_modules/.vite'),
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  })
  await server.listen()
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  browser = await chromium.launch({ executablePath: process.env.YAZI_BROWSER_PATH || (existsSync(chrome) ? chrome : undefined) })
  const page = await browser.newPage()
  let navigations = 0
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) { navigations++; events.push({ kind: 'navigation' }) } })
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); events.push({ kind: 'pageerror', message: error.message }) })
  await page.goto(server.resolvedUrls.local[0])
  await page.getByRole('button', { name: /New writing/ }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown text' })
  await editor.fill('Isolated cold start misspelld text.')
  await page.keyboard.press('Control+s')
  await expect(page.locator('.save-state')).toHaveText('Saved')
  await page.keyboard.press('Control+.')
  await page.keyboard.press('Control+2')
  // Await both dictionaries, not an arbitrary delay that may miss a late reload.
  await page.evaluate(async () => {
    const { checkWords } = await import('/src/spell/spell-client.ts')
    await checkWords('en', ['misspelld'])
    await checkWords('tr', ['merhaba'])
  })
  await expect(page.locator('.cm-misspelled')).not.toHaveCount(0)
  await page.keyboard.press('Control+.')
  await expect(editor).toHaveText('Isolated cold start misspelld text.')
  expect(navigations, 'Entering Review must not reload the writing desk').toBe(1)
  expect(errors).toEqual([])
  expect(events.some(event => event.kind === 'vite' && event.message.includes('optimized dependencies changed'))).toBe(false)
  events.push({ kind: 'pass', navigations })
  console.log('Cold start passed: no reload; English/Turkish worker and draft intact.')
} finally {
  await writeFile(resolve(output, 'events.json'), JSON.stringify(events, null, 2))
  await browser?.close()
  await server?.close()
  console.log(`Diagnostic log: ${output}/events.json`)
}
