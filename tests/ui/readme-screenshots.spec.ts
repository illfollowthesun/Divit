import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge } from './desktop-bridge'
import { select } from './research-helpers'

// README screenshots with invented sample text. Runs only when asked: YAZI_README_SHOTS=1 npx playwright test readme
test.skip(!process.env.YAZI_README_SHOTS, 'Set YAZI_README_SHOTS=1 to refresh the README screenshots.')
test.use({ viewport: { width: 1440, height: 900 } })
const body = 'The first ferry left before the city woke. Mira counted the gulls on the railing, as she always did, and lost count at nine.\n\nOn the upper deck a man was reading yesterday’s paper upside down. Nobody mentioned it. The water was the colour of an old spoon, and the far shore kept its last few lights on, as if it had forgotten to wake.\n\nShe had made this crossing a thousand times. She still counted the ropes as they fell away.'
const misspelled = body.replace('railing', 'raileing').replace('forgotten', 'forgoten')
const article = `<!doctype html><html><head><title>The morning crossing | Harbour Notes</title><meta property="og:site_name" content="Harbour Notes"><meta property="article:published_time" content="2026-10-20T08:00:00Z"></head><body><article><h1>The morning crossing</h1><p class="byline">By A. Writer</p>${['The first boat of the day leaves at ten past six in winter.', 'Regular passengers keep to the same seats, and the crew learn their faces within a week.', 'Gulls follow the wake until the boat clears the breakwater, then turn back towards the fish market.', 'In fog the horn sounds every two minutes; nobody on board seems to notice it any more.'].map(p => `<p>${p}</p>`).join('')}</article></body></html>`

async function open(page: Page, text = body) {
  const project = { ...newProject('The morning crossing', undefined, 'story'), id: randomUUID(), mode: 'normal', language: 'en', body: text }
  await desktopBridge(page, { config: { enabled: true, provider: 'gemini', model: 'gemini-3.8-flash' }, keys: { gemini: true }, projects: [project] })
  await page.goto('/'); await expect(page.getByLabel('Title')).toHaveValue('The morning crossing')
  return project
}

test('Write mode', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Control+1'); await page.waitForTimeout(400)
  await page.screenshot({ path: 'docs/screenshots/divit-write.png' })
})
test('Review with underlines', async ({ page }) => {
  await open(page, misspelled)
  await page.keyboard.press('Control+2'); await expect(page.locator('.cm-misspelled').first()).toBeVisible({ timeout: 10000 }); await page.waitForTimeout(600)
  await page.screenshot({ path: 'docs/screenshots/divit-review.png' })
})
test('Research with a saved source', async ({ page }) => {
  const server = createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(article) }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  await open(page)
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByLabel(/Web address to save/).fill(`http://127.0.0.1:${(server.address() as AddressInfo).port}/crossing`)
  await drawer.getByRole('button', { name: 'Add', exact: true }).click()
  await drawer.getByRole('button', { name: /The morning crossing/ }).click({ timeout: 15000 })
  await select(page, 'Regular passengers keep to the same seats')
  await page.getByRole('dialog', { name: 'Highlight selection' }).getByRole('button', { name: 'Highlight in Sage' }).click()
  await page.mouse.click(5, 300); await page.waitForTimeout(500)
  await page.screenshot({ path: 'docs/screenshots/divit-research.png' })
  server.close()
})
test('Settings, AI', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Open settings' }).click()
  const section = page.getByRole('dialog').locator('.ai-settings')
  await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
  await page.screenshot({ path: 'docs/screenshots/divit-settings-ai.png' })
})
