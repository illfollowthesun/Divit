import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge } from './desktop-bridge'

// Before/after screenshots for docs/UI_TIDY.md, invented text only.
// YAZI_TIDY_SHOTS=before (or after) npx playwright test tidy-screenshots --workers=1
const stage = process.env.YAZI_TIDY_SHOTS
test.skip(!stage, 'Set YAZI_TIDY_SHOTS=before or after to take the tidy-up screenshots.')
const body = 'The first ferry left before the city woke. Mira counted the gulls on the raileing, as she always did, and lost count at nine.\n\nOn the upper deck a man was reading yesterday’s paper upside down. Nobody mentioned it. The water was the colour of an old spoon.'
const article = `<!doctype html><html><head><title>The morning crossing | Harbour Notes</title><meta property="og:site_name" content="Harbour Notes"></head><body><article><h1>The morning crossing</h1>${['The first boat of the day leaves at ten past six in winter.', 'Regular passengers keep to the same seats, and the crew learn their faces within a week.', 'Gulls follow the wake until the boat clears the breakwater.'].map(p => `<p>${p}</p>`).join('')}</article></body></html>`

async function open(page: Page, locale: 'en' | 'tr' = 'en') {
  const project = { ...newProject('The morning crossing', undefined, 'book'), id: randomUUID(), mode: 'normal', language: 'en', body, sections: [{ id: 's1', kind: 'chapter', title: 'Karaköy, 06:10', body }] }
  await desktopBridge(page, { config: { enabled: true }, keys: { gemini: true }, projects: [project] })
  await page.addInitScript(locale => { Object.defineProperty(navigator, 'languages', { get: () => [locale === 'tr' ? 'tr-TR' : 'en-GB'] }) }, locale)
  await page.goto('/'); await expect(page.locator('.title-input')).toHaveValue('The morning crossing'); await page.waitForTimeout(500)
}
for (const size of [{ name: '1440', width: 1440, height: 900 }, { name: '960', width: 960, height: 700 }]) test.describe(size.name, () => {
  test.use({ viewport: { width: size.width, height: size.height } })
  const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/tidy-${stage}-shell-${name}-${size.name}.png` })
  test(`desk ${size.name}`, async ({ page }) => { await open(page); await shot(page, 'desk') })
  test(`turkish desk ${size.name}`, async ({ page }) => { await open(page, 'tr'); await shot(page, 'desk-tr') })
  test(`research ${size.name}`, async ({ page }) => {
    const server = createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(article) }).listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    await open(page)
    await page.getByRole('button', { name: /^Research/ }).first().click()
    const drawer = page.getByRole('complementary', { name: 'Research' })
    await drawer.getByLabel(/Web address to save/).fill(`http://127.0.0.1:${(server.address() as AddressInfo).port}/crossing`)
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(drawer.getByRole('button', { name: /The morning crossing/ })).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(300); await shot(page, 'research'); server.close()
  })
  test(`review ${size.name}`, async ({ page }) => {
    await open(page); await page.keyboard.press('Control+2'); await expect(page.locator('.cm-misspelled').first()).toBeVisible({ timeout: 10000 }); await page.waitForTimeout(400)
    await shot(page, 'review')
  })
})
