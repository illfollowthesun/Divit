import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const article = `<!doctype html><html lang="tr"><head><title>Karaköy iskelesi | Şehir Hatları Günlüğü</title>
<meta property="og:site_name" content="Şehir Hatları Günlüğü"><meta property="article:published_time" content="2026-10-20T08:00:00Z">
<meta name="description" content="Kış tarifesinde ilk vapur 06:10'da kalkıyor."><script>window.pwned = true</script></head>
<body><nav>Menu · Home · About</nav><article><h1>Karaköy iskelesi</h1><p class="byline">By Derya Kaya</p>
${Array.from({ length: 6 }, (_, i) => `<p>Paragraf ${i + 1}: Kış tarifesinde ilk vapur <strong>06:10</strong>'da kalkıyor; martılar ışıktan önce geliyor ve iskele sessiz kalıyor. <a href="/other">Bir bağlantı</a> burada.</p>`).join('')}
<img src="http://127.0.0.1:9/tracker.png" alt="tracker"><iframe src="http://127.0.0.1:9/embed"></iframe></article><footer>© footer</footer></body></html>`

test('Add URL keeps a readable offline copy; the list filters, dedupes and shows new inbox items', async ({ page }) => {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/karakoy')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(article) }
    else if (req.url === '/go') { res.writeHead(302, { Location: '/karakoy' }); res.end() }
    else { res.writeHead(404); res.end() }
  }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const requests: string[] = []; page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:1420')) requests.push(request.url()) })

  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  const toggle = page.getByRole('button', { name: /^Research/ })
  await toggle.click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await expect(drawer.getByLabel('Web address to save')).toBeFocused()
  await drawer.getByLabel('Web address to save').fill(`${base}/go`)
  await drawer.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(drawer.getByRole('status')).toHaveText('Saved a readable copy: Karaköy iskelesi', { timeout: 15000 })
  const row = drawer.getByRole('button', { name: /Karaköy iskelesi/ })
  await expect(row).toContainText('Şehir Hatları Günlüğü · 2026-10-20'); await expect(row).toContainText('article')

  await drawer.getByLabel('Web address to save').fill(`${base}/karakoy?utm_source=newsletter#top`)
  await drawer.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(drawer.getByRole('status')).toHaveText('Already saved: Karaköy iskelesi')
  await expect(drawer.locator('.source-row')).toHaveCount(1)

  server.close() // Everything from here on must come from the saved copy.
  await row.click()
  const reader = drawer.getByRole('article')
  await expect(reader.getByRole('heading', { name: 'Karaköy iskelesi' })).toBeFocused()
  await expect(reader).toContainText("Paragraf 6: Kış tarifesinde ilk vapur 06:10'da kalkıyor; martılar ışıktan önce geliyor")
  await expect(reader).toContainText('Bir bağlantı burada.')
  await expect(reader).not.toContainText('Menu · Home'); await expect(reader).not.toContainText('© footer')
  await expect(reader.locator('img, iframe, script, a')).toHaveCount(0)
  expect(await page.evaluate(() => 'pwned' in window)).toBe(false)
  await page.keyboard.press('Escape'); await expect(drawer.locator('.source-row')).toHaveCount(1)
  await expect(drawer.locator('.source-row.read')).toHaveCount(1)

  const id: string = await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].id)
  const research = join('.tmp/yazi-preview/projects', id, 'research')
  const [file] = await readdir(join(research, 'sources'))
  const saved = await readFile(join(research, 'sources', file), 'utf8')
  expect(saved).toMatch(/^---\ntitle: Karaköy iskelesi\nurl: http:\/\/127\.0\.0\.1:\d+\/karakoy\nsite: Şehir Hatları Günlüğü\nauthor: Derya Kaya\npublished: 2026-10-20\nsaved: \d{4}-\d\d-\d\d\ntype: article\nsummary: /)
  expect(saved).not.toContain('**'); expect(saved).not.toContain('](')

  await mkdir(join(research, 'inbox'), { recursive: true })
  await writeFile(join(research, 'inbox', 'tarife.md'), '---\ntitle: Winter timetable\nurl: https://example.com/tarife\nsite: Example News\ntype: news\n---\nFirst ferry 06:10.')
  await expect(drawer.locator('.research-new')).toHaveText('1 new', { timeout: 10000 })
  await expect(toggle).toHaveText('Research1 new')
  await drawer.getByLabel('Source type').selectOption('news')
  await expect(drawer.locator('.source-row')).toHaveCount(1); await expect(drawer.locator('.source-row')).toContainText('Winter timetable')
  await drawer.getByLabel('Source type').selectOption('all'); await drawer.getByLabel('Find a source').fill('karaköy')
  await expect(drawer.locator('.source-row')).toHaveCount(1); await expect(drawer.locator('.source-row')).toContainText('Karaköy iskelesi')
  await drawer.getByLabel('Find a source').fill(''); await drawer.getByRole('button', { name: /Winter timetable/ }).click()
  await expect(drawer.getByRole('article')).toContainText('First ferry 06:10.')
  await expect(drawer.locator('.research-new')).toHaveCount(0); await expect(toggle).toHaveText('Research')

  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0); await expect(toggle).toBeFocused()
  await page.keyboard.press('Control+Alt+r'); await expect(drawer).toBeVisible()
  await page.keyboard.press('Control+Alt+r'); await expect(drawer).toHaveCount(0)
  expect(requests).toEqual([]) // The page never loads anything remote; only the bridge fetched the URL.
})
