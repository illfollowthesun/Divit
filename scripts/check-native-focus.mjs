// Explicit native integration test. Requires the debug executable; never installs
// or edits a real library. Release ignores DIVIT_TEST_LIBRARY, so refuse it here.
import { createServer, createLogger } from 'vite'
import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const output = resolve('.tmp', `native-focus-${randomUUID()}`)
const library = resolve(output, 'library')
await mkdir(library, { recursive: true })
await writeFile(resolve(library, 'settings.json'), JSON.stringify({ schemaVersion: 1, theme: 'light', siteRepo: '', uiLanguage: 'en', checkUpdates: false }))
const events = [], logger = createLogger()
const logInfo = logger.info.bind(logger)
logger.info = (message, options) => { if (message.includes('optimized dependencies changed')) events.push({ kind: 'vite-reload' }); logInfo(message, options) }
let server, native, browser, page, ownedPage = false, succeeded = false
const text = 'Native isolated sentence. Merhaba dünya. A misspelld word.'
const normalize = value => value.replaceAll('\\', '/').toLowerCase()
async function connect() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const targets = await (await fetch('http://127.0.0.1:9443/json/list')).json()
      if (targets.some(target => target.url?.startsWith('http://localhost:1420'))) {
        const connection = await chromium.connectOverCDP('http://127.0.0.1:9443')
        const found = connection.contexts().flatMap(context => context.pages()).find(p => p.url().startsWith('http://localhost:1420'))
        if (found) return { browser: connection, page: found }
        await connection.close()
      }
    } catch { /* Native startup is asynchronous. */ }
    await new Promise(done => setTimeout(done, 200))
  }
  throw new Error('Isolated native WebView did not become ready; check for an existing Divit instance.')
}
async function open() {
  native = spawn(resolve('src-tauri/target/debug/divit.exe'), [], { cwd: resolve('.'), env: {
    ...process.env, DIVIT_TEST_LIBRARY: library, WEBVIEW2_USER_DATA_FOLDER: resolve(output, 'webview'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9443 --remote-debugging-address=127.0.0.1',
  }, stdio: 'ignore' })
  native.on('error', error => events.push({ kind: 'native-spawn-error', name: error.name }))
  ;({ browser, page } = await connect())
  const root = await page.evaluate(async () => { const { invoke } = await import('/node_modules/@tauri-apps/api/core.js'); return (await invoke('library')).dataRoot })
  if (normalize(root) !== normalize(library)) throw new Error('Library isolation check failed; no writing or window-close action was performed.')
  ownedPage = true
  page.on('pageerror', error => events.push({ kind: 'script-error', name: error.name }))
  page.on('crash', () => events.push({ kind: 'renderer-crash' }))
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) events.push({ kind: 'unexpected-navigation' }) })
}
async function closeSaved() {
  await page.keyboard.press('Control+s')
  await expect(page.locator('.save-state')).toHaveText('Saved')
  const exited = new Promise(done => native.once('exit', done))
  await page.evaluate(async () => { const { getCurrentWindow } = await import('/node_modules/@tauri-apps/api/window.js'); await getCurrentWindow().close() })
    .catch(error => { if (!/closed|destroyed/i.test(error.message)) throw error })
  await browser.close(); browser = null; ownedPage = false
  await exited
}
try {
  server = await createServer({ configLoader: 'runner', customLogger: logger, cacheDir: resolve(output, 'node_modules/.vite'), server: { host: '127.0.0.1', port: 1420, strictPort: true } })
  await server.listen()
  await open()
  await page.getByRole('button', { name: /New writing/ }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown text' })
  await editor.fill(text)
  await page.keyboard.press('Control+s'); await expect(page.locator('.save-state')).toHaveText('Saved')
  const session = await browser.newBrowserCDPSession(), target = await page.context().newCDPSession(page)
  const { targetInfo } = await target.send('Target.getTargetInfo')
  const { windowId } = await session.send('Browser.getWindowForTarget', { targetId: targetInfo.targetId })
  for (const width of [1000, 1180, 1440]) {
    await session.send('Browser.setWindowBounds', { windowId, bounds: { width, height: 850 } })
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width)
    await page.keyboard.press('Control+3'); await page.keyboard.press('Control+Alt+t')
    await page.keyboard.press('Control+Alt+r')
    await expect(page.locator('#tab-Research')).toHaveAttribute('aria-selected', 'true')
    if (width < 1240) { await expect(page.locator('.drawer-scrim')).toBeVisible(); await page.keyboard.press('Escape') }
    for (const mode of ['1', '2', '3']) {
      await page.keyboard.press(`Control+${mode}`)
      await page.keyboard.press('Control+.'); await expect(page.locator('.app')).toHaveClass(/focus-mode/)
      await expect(editor).toBeFocused()
      await page.locator('.focus-exit').click(); await expect(page.locator('.app')).not.toHaveClass(/focus-mode/)
      await expect(editor).toBeFocused(); await expect(editor).toHaveText(text)
      await page.keyboard.press('Escape')
    }
    await page.keyboard.press('Control+s'); await expect(page.locator('.save-state')).toHaveText('Saved')
    // The shortcut toggles according to drawer visibility. Select Preview
    // explicitly so every width starts from the same known tab.
    if (!await page.locator('#writing-companion').isVisible()) await page.keyboard.press('Control+Alt+p')
    await page.locator('#tab-Preview').click()
  }
  await page.evaluate(async () => { const { checkWords } = await import('/src/spell/spell-client.ts'); await checkWords('en', ['misspelld']); await checkWords('tr', ['merhaba']) })
  const diagnostics = await page.evaluate(() => JSON.parse(localStorage.getItem('divit-runtime-diagnostics-v1') ?? '[]'))
  expect(diagnostics.filter(record => /error|fatal|rejection|reload/.test(record.kind))).toEqual([])
  expect(events).toEqual([])
  await closeSaved(); await open()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toHaveText(text)
  await expect(page.locator('.save-state')).toHaveText('Saved')
  await closeSaved()
  succeeded = true
  console.log('Native integration passed: 3 widths × 3 modes, Focus, Typewriter, Research, EN/TR worker, save and process reopen; no renderer error/reload.')
} finally {
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ succeeded, source: 'native Tauri debug + Vite; real IPC', events }, null, 2))
  // On failure preserve the isolated window for diagnosis, never close an unowned
  // or potentially unsaved personal session. No real library data is captured.
  await browser?.close()
  if (!ownedPage) await server?.close()
  console.log(`Native evidence: ${output}/result.json`)
}
