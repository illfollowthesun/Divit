import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function book(page: Page) {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New story or book/ }).click()
  await page.getByLabel('Project type').selectOption('book'); await page.getByLabel('Project title').fill('The morning crossing')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
}
const fits = (page: Page) => page.getByRole('toolbar', { name: 'Project actions' }).evaluate(bar => { const box = bar.getBoundingClientRect(); return bar.scrollWidth <= bar.clientWidth + 1 && [...bar.querySelectorAll('button, select')].every(e => e.getBoundingClientRect().right <= box.right + 1) })

test('the toolbar keeps mode, Research, Export and More, and never overflows at 960 px', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 700 })
  await book(page)
  const bar = page.getByRole('toolbar', { name: 'Project actions' })
  for (const name of ['Research', 'Export', 'More actions']) await expect(bar.getByRole('button', { name, exact: true })).toBeVisible()
  await expect(bar.getByRole('combobox', { name: 'Writing mode' })).toBeVisible()
  for (const name of ['Archive', 'Snapshots', 'Start a rewrite', 'Underlines']) await expect(bar.getByRole('button', { name, exact: true })).toHaveCount(0)
  expect(await fits(page)).toBe(true)
  await page.getByRole('button', { name: 'Research', exact: true }).click()
  expect(await fits(page)).toBe(true)
})

test('the More menu works from the keyboard and lists every moved action', async ({ page }) => {
  await book(page)
  const more = page.getByRole('button', { name: 'More actions' })
  await more.focus(); await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'More actions' })
  await expect(menu.locator('[role^=menuitem]')).toHaveText([/Underlines/, /Snapshots/, /Start a rewrite/, /Archive/])
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Underlines' })).toBeFocused()
  await page.keyboard.press('ArrowDown'); await expect(menu.getByRole('menuitem', { name: /Snapshots/ })).toBeFocused()
  await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(more).toBeFocused()
  await more.click(); await menu.getByRole('menuitem', { name: /Snapshots/ }).click()
  await expect(page.getByRole('dialog', { name: 'A few versions of the same thought' })).toBeVisible()
})

test('on wide windows Research pushes the text instead of covering it; below 1100 px it overlays with a close button', async ({ page }) => {
  await book(page)
  const paper = page.locator('.paper'), before = (await paper.boundingBox())!
  await page.getByRole('button', { name: 'Research', exact: true }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  const [text, side] = [(await paper.boundingBox())!, (await drawer.boundingBox())!]
  expect(text.x + text.width).toBeLessThanOrEqual(side.x + 1)
  expect(Math.abs(text.width - before.width)).toBeLessThan(200) // the drawer takes the companion's place
  await expect(page.locator('#writing-companion')).toBeHidden()
  await page.getByRole('button', { name: 'Close research' }).click(); await expect(page.locator('#writing-companion')).toBeVisible()

  await page.setViewportSize({ width: 960, height: 700 })
  await page.getByRole('button', { name: 'Research', exact: true }).click()
  const close = page.getByRole('button', { name: 'Close research' })
  await expect(close).toBeVisible(); expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(32)
  await close.click(); await expect(drawer).toHaveCount(0)
})
