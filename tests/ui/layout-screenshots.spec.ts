import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge } from './desktop-bridge'

// Before/after screenshots for docs/UI_LAYOUT_DOCK.md, invented text only.
// YAZI_LAYOUT_SHOTS=before (or after) npx playwright test layout-screenshots --workers=1
const stage = process.env.YAZI_LAYOUT_SHOTS
test.skip(!stage, 'Set YAZI_LAYOUT_SHOTS=before or after to take the layout screenshots.')
const scene = 'The first ferry left before the city woke. Mira counted the gulls on the railing, as she always did, and lost count at nine.\n\nOn the upper deck a man was reading yesterday’s paper upside down.'
const chapters = ['Karaköy, 06:10', 'The upper deck'].map((title, i) => ({ id: `c${i}`, kind: 'chapter', title, body: '' }))
const scenes = chapters.flatMap((c, i) => [1, 2].map(n => ({ id: `s${i}${n}`, kind: 'scene', parentId: c.id, title: `Scene ${n}`, body: n === 1 ? scene : 'More words here.', status: n === 1 ? 'done' : 'draft' })))
const article = `<!doctype html><html><head><title>The morning crossing | Harbour Notes</title><meta property="og:site_name" content="Harbour Notes"></head><body><article><h1>The morning crossing</h1>${['The first boat of the day leaves at ten past six in winter.', 'Regular passengers keep to the same seats, and the crew learn their faces within a week.', 'Gulls follow the wake until the boat clears the breakwater.'].map(p => `<p>${p}</p>`).join('')}</article></body></html>`

async function open(page: Page, locale: 'en' | 'tr' = 'en') {
  const project = { ...newProject('The Last Ferry', undefined, 'book'), id: randomUUID(), mode: 'normal', language: 'en', place: 'Istanbul', body: 'An opening.', sections: [...chapters, ...scenes] }
  await desktopBridge(page, { config: { enabled: true }, keys: { gemini: true }, projects: [project] })
  await page.addInitScript(locale => { Object.defineProperty(navigator, 'languages', { get: () => [locale === 'tr' ? 'tr-TR' : 'en-GB'] }) }, locale)
  await page.goto('/'); await expect(page.locator('.title-input')).toHaveValue('The Last Ferry')
  await page.locator('.outline-node', { hasText: 'Scene 1' }).first().click(); await page.waitForTimeout(500)
}
for (const size of [{ name: '1440', width: 1440, height: 900 }, { name: '1000', width: 1000, height: 760 }]) for (const locale of ['en', 'tr'] as const) test.describe(`${size.name} ${locale}`, () => {
  test.use({ viewport: { width: size.width, height: size.height } })
  const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/layout-${stage}-${name}-${locale}-${size.name}.png` })
  test('desk', async ({ page }) => { await open(page, locale); await shot(page, 'desk') })
  test('research', async ({ page }) => {
    const server = createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(article) }).listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    await open(page, locale)
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/crossing`
    if (stage === 'before') {
      await page.locator('.document-toolbar .toolbar-action').first().click()
      const drawer = page.getByRole('complementary', { name: /^(Research|Araştırma)$/ })
      await drawer.getByRole('textbox').first().fill(url); await drawer.getByRole('button', { name: /^(Add|Ekle)$/ }).click()
      await expect(drawer.getByRole('button', { name: /The morning crossing/ })).toBeVisible({ timeout: 15000 })
    } else {
      await page.keyboard.press('Control+Alt+r')
      const panel = page.getByRole('region', { name: /^(Research|Araştırma)$/ })
      await panel.getByRole('textbox').first().fill(url); await panel.getByRole('button', { name: /^(Save|Kaydet)$/ }).click()
      await expect(panel.getByRole('button', { name: /The morning crossing/ })).toBeVisible({ timeout: 15000 })
    }
    await page.waitForTimeout(6000); await shot(page, 'research'); server.close()
  })
  test('export', async ({ page }) => { await open(page, locale); await page.locator('.document-toolbar button', { hasText: /^(Export|Dışa aktar)$/ }).click(); await page.waitForTimeout(300); await shot(page, 'export') })
  test('focus', async ({ page }) => {
    await open(page, locale); await page.getByRole('button', { name: /^(Focus|Odak)$/ }).click(); await page.mouse.move(600, 500); await page.mouse.move(300, 4); await page.waitForTimeout(500); await shot(page, 'focus')
  })
})
