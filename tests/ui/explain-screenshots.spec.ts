import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge } from './desktop-bridge'

// Before/after screenshots for docs/UI_EXPLAIN_TIDY.md, invented text only.
// YAZI_EXPLAIN_SHOTS=before (or after) npx playwright test explain-screenshots --workers=1
const stage = process.env.YAZI_EXPLAIN_SHOTS
test.skip(!stage, 'Set YAZI_EXPLAIN_SHOTS=before or after to take the screenshots.')
const scene = '## The first crossing\n\nThe first ferry left before the city woke. Mira counted the *gulls* on the railing, as she always did, and lost count at nine.\n\n### A detail\n\nOn the upper deck a man was reading yesterday’s paper upside down.'
const chapters = ['Karaköy, 06:10', 'The upper deck', 'Kadıköy'].map((title, i) => ({ id: `c${i}`, kind: 'chapter', title, body: '' }))
const scenes = chapters.flatMap((c, i) => [1, 2, 3].map(n => ({ id: `s${i}${n}`, kind: 'scene', parentId: c.id, title: `Scene ${n}`, body: n === 1 ? scene : 'More words here.', status: n === 1 ? 'done' : 'draft' })))

async function open(page: Page, locale: 'en' | 'tr' = 'en') {
  const project = { ...newProject('The morning crossing', undefined, 'book'), id: randomUUID(), mode: 'normal', language: 'en', place: '', body: 'An opening.', lastSectionId: 's11', sections: [...chapters, ...scenes] }
  await desktopBridge(page, { config: { enabled: true }, keys: { gemini: true }, projects: [project] })
  await page.addInitScript(locale => { Object.defineProperty(navigator, 'languages', { get: () => [locale === 'tr' ? 'tr-TR' : 'en-GB'] }) }, locale)
  await page.goto('/'); await expect(page.locator('.title-input')).toHaveValue('The morning crossing')
  // Before this change the chosen section was not remembered, so choose it by hand in both runs.
  await page.locator('.outline-node', { hasText: 'Scene 1' }).nth(1).click(); await page.waitForTimeout(500)
}
for (const size of [{ name: '1440', width: 1440, height: 900 }, { name: '1000', width: 1000, height: 760 }]) test.describe(size.name, () => {
  test.use({ viewport: { width: size.width, height: size.height } })
  const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/explain-${stage}-${name}-${size.name}.png` })
  test(`desk ${size.name}`, async ({ page }) => { await open(page); await shot(page, 'desk') })
  test(`turkish desk ${size.name}`, async ({ page }) => { await open(page, 'tr'); await shot(page, 'desk-tr') })
  test(`more menu ${size.name}`, async ({ page }) => { await open(page); await page.getByRole('button', { name: 'More actions' }).click(); await shot(page, 'more') })
  test(`shortcuts ${size.name}`, async ({ page }) => { await open(page); await page.keyboard.press('F1'); await page.waitForTimeout(200); await shot(page, 'shortcuts') })
})
