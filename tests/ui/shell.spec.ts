import { test, expect } from '@playwright/test'
import { startMenu } from './shell-helpers'
import type { Page } from '@playwright/test'

async function book(page: Page) {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book')
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

test('place, date, tags and language fold into one line under the title and open on click', async ({ page }) => {
  await book(page)
  const summary = page.locator('.metadata-summary')
  await expect(page.locator('#metadata-fields')).toHaveCount(0)
  await expect(summary).toHaveText(/^Somewhere · \d{1,2} \w{3} \d{4} · Language: auto · \+ tags$/)
  await summary.click(); await expect(summary).toHaveAttribute('aria-expanded', 'true')
  await page.getByLabel('PLACE', { exact: true }).fill('Karaköy'); await page.getByLabel('DATE', { exact: true }).fill('2026-10-30')
  await page.getByLabel('TAGS', { exact: true }).fill('ferry, winter'); await page.getByRole('combobox', { name: 'LANGUAGE', exact: true }).selectOption('en')
  await expect(summary).toHaveText('Karaköy · 30 Oct 2026 · English · #ferry #winter')
  await summary.click(); await expect(page.locator('#metadata-fields')).toHaveCount(0)
})

test('the sidebar starts with New writing and search; stories, books and imports are one click away', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  const library = page.locator('#writing-library')
  const order = await library.evaluate(el => [...el.querySelectorAll('.new-button, .search-label input, .library-filters')].map(e => e.className || (e as HTMLInputElement).placeholder))
  expect(order).toEqual(['new-button', 'Find a piece…', 'library-filters'])
  await expect(library.getByRole('button', { name: /All writing/ })).toContainText('0')
  await library.getByRole('button', { name: 'More ways to start' }).click()
  const menu = page.getByRole('menu', { name: 'More ways to start' })
  await expect(menu.locator('[role=menuitem]')).toHaveText([/New story or book.*Ctrl Shift N/, /Bring in writing….*Ctrl O/])
  await menu.getByRole('menuitem', { name: /Bring in writing/ }).click()
  await expect(page.getByRole('dialog', { name: 'Bring in your writing' })).toBeVisible()
})

test('the status bar shows words, reading time and save state, without the Focus hint; Focus shows its state', async ({ page }) => {
  await book(page)
  const footer = page.locator('.editor-footer')
  await expect(footer).toContainText('0 words'); await expect(footer).toContainText('1 min read'); await expect(footer.getByRole('status')).toBeVisible()
  await expect(footer.getByRole('button')).toHaveCount(0)
  const focus = page.locator('.top-actions').getByRole('button', { name: 'Focus', exact: true })
  await expect(focus).toHaveAttribute('aria-pressed', 'false'); await focus.click()
  await expect(page.locator('.top-actions').getByRole('button', { name: 'Leave focus' })).toHaveAttribute('aria-pressed', 'true')
})

test('Settings opens on side tabs with Save and Cancel always in view; Save turns on with a change', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 700 })
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('tab')).toHaveText(['General', 'Writing', 'Appearance', 'Your files', 'AI', 'About'])
  const save = dialog.getByRole('button', { name: 'Save settings' })
  await expect(save).toBeInViewport(); await expect(save).toBeDisabled(); await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport()
  await dialog.getByRole('tab', { name: 'Writing' }).click(); await dialog.getByLabel('Daily writing goal').fill('300')
  await expect(save).toBeEnabled(); await expect(save).toBeInViewport()
  await dialog.getByRole('tab', { name: 'About' }).click(); await expect(dialog.getByRole('tabpanel', { name: 'About' })).toContainText('Version')
  await save.click(); await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).settings.writingGoal)).toBe(300)
})

test('companion tabs say Reflection and Notebook, so they do not echo Review and research notes', async ({ page }) => {
  await book(page)
  await expect(page.locator('#writing-companion [role=tab]')).toHaveText(['Preview', 'Cards', 'Notebook', 'Reflection', 'Images'])
  await page.keyboard.press('Control+Alt+n'); await expect(page.getByRole('tab', { name: 'Notebook', exact: true })).toHaveAttribute('aria-selected', 'true')
})
