import { test, expect } from '@playwright/test'
import { more } from './shell-helpers'

test('first launch shows a short welcome that explains projects, modes and privacy, once', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  const welcome = page.getByRole('region', { name: 'A quiet place to write' })
  await expect(welcome).toContainText('Projects'); await expect(welcome).toContainText('Three modes'); await expect(welcome).toContainText('Nothing is sent anywhere unless you turn on AI')
  await welcome.getByRole('button', { name: 'Got it' }).click()
  await expect(welcome).toHaveCount(0); await expect(page.getByRole('heading', { name: /There’s a story/ })).toBeVisible()
  await page.reload(); await expect(page.getByRole('region', { name: 'A quiet place to write' })).toHaveCount(0)
})

test('Ctrl O brings in writing, and the shortcut sheet lists it with the theme picker', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('region', { name: 'A quiet place to write' }).getByRole('button', { name: /Start writing/ }).click()
  await page.getByLabel('Title').click(); await page.keyboard.press('Escape')
  await page.locator('.topbar').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Control+o')
  await expect(page.getByRole('dialog', { name: 'Bring in your writing' })).toBeVisible()
  await page.keyboard.press('Escape'); await page.keyboard.press('F1')
  const help = page.getByRole('dialog', { name: 'A few familiar keys' })
  await expect(help.locator('dt', { hasText: 'Bring in writing' })).toBeVisible(); await expect(help.getByLabel('Theme')).toBeVisible()
})

test('turning underlines on does not move the text, and Write mode shows only the text', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('region', { name: 'A quiet place to write' }).getByRole('button', { name: /Start writing/ }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown text' })
  await editor.fill('The gulls arived before the ligth, and the peir was empty.')
  const line = page.locator('.cm-line').first(), before = await line.boundingBox()
  await more(page, 'Underlines')
  await expect(page.locator('.cm-misspelled').first()).toBeVisible()
  expect(await line.boundingBox()).toEqual(before)
  await page.keyboard.press('Control+1')
  const visible = await page.evaluate(() => [...document.querySelectorAll('button, input, select, a, [role=status]')].filter(e => (e as HTMLElement).offsetParent !== null).length)
  expect(visible).toBe(0)
  await expect(editor).toBeVisible()
})
