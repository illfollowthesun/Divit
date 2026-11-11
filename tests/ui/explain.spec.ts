import { test, expect, type Page } from '@playwright/test'
import { startMenu } from './shell-helpers'

async function book(page: Page) {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book'); await page.getByLabel('Project type').selectOption('book'); await page.getByLabel('Project title').fill('Explain test')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
}
const saved = (page: Page) => page.keyboard.press('Control+s').then(() => expect(page.locator('.editor-footer [role=status]')).toHaveText('All changes saved'))

test('the chosen chapter or scene is remembered after a reload', async ({ page }) => {
  await book(page)
  await page.getByRole('button', { name: '+ Chapter' }).click(); await page.getByRole('button', { name: '+ Scene' }).click()
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('Words in the scene.')
  const title = page.getByLabel('Section title'); await expect(title).toHaveValue(/Scene/)
  const name = await title.inputValue()
  await saved(page); await page.reload()
  await expect(page.getByLabel('Section title')).toHaveValue(name)
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toHaveText('Words in the scene.')
  // Settings tabs and closing must not move the writer to the opening.
  await page.getByRole('button', { name: 'Open settings' }).click()
  for (const tab of ['Your files', 'AI', 'About']) await page.getByRole('tab', { name: tab }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Section title')).toHaveValue(name)
})

test('the library keeps Trash and Keyboard shortcuts in view and scrolls the rest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await book(page)
  await page.getByRole('button', { name: '+ Chapter' }).click()
  for (let i = 0; i < 14; i++) await page.getByRole('button', { name: '+ Scene' }).click()
  const library = page.getByRole('complementary', { name: 'Writing library' })
  for (const name of [/^Trash/, /^Keyboard shortcuts/]) await expect(library.getByRole('button', { name })).toBeInViewport({ ratio: 1 })
  expect(await page.locator('.outline').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  expect(await library.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
})

test('markdown headings are sized, not underlined, and their marks are muted', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('# Big\n\n## A heading\n\n### Small\n\nBody *soft* text')
  const lines = page.locator('.cm-line'), size = (n: number) => lines.nth(n).locator('span').last().evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  const [h1, h2, h3, body] = [await size(0), await size(2), await size(4), await size(6)]
  expect(h1).toBeGreaterThan(h2); expect(h2).toBeGreaterThan(h3); expect(h3).toBeGreaterThan(body)
  const heading = await lines.nth(2).locator('span').last().evaluate(el => getComputedStyle(el).textDecorationLine)
  expect(heading).not.toContain('underline')
  const marks = await lines.nth(2).locator('span').first().evaluate(el => ({ color: getComputedStyle(el).color, text: el.textContent }))
  const bodyColor = await lines.nth(6).evaluate(el => getComputedStyle(el).color)
  expect(marks.text).toContain('##'); expect(marks.color).not.toBe(bodyColor)
})

test('an empty place shows as a "+ place" prompt, a filled one shows its name', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  const summary = page.locator('.metadata-summary')
  await expect(summary).toHaveText(/^\+ place · /); await expect(summary).not.toContainText('Somewhere')
  await summary.click(); await page.getByLabel('PLACE').fill('Kadıköy')
  await expect(summary).toHaveText(/^Kadıköy · /)
})

test('the quiet-screen controls say what they do, and the More menu explains itself', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  await expect(page.getByRole('button', { name: 'Focus', exact: true })).toHaveAttribute('title', /Hide the library and the bars.*\(Ctrl\+\.\)/)
  await expect(page.getByRole('button', { name: 'Typewriter', exact: true })).toHaveAttribute('title', /same height \(Ctrl\+Alt\+T\)/)
  await expect(page.getByRole('button', { name: 'Side panel', exact: true })).toHaveAttribute('title', /preview, cards, notebook \(Ctrl\+Alt\+P\)/)
  await expect(page.locator('.mode-picker')).toContainText('Mode')
  await page.getByRole('button', { name: 'More actions' }).click()
  const menu = page.getByRole('menu', { name: 'More actions' })
  await expect(menu.getByRole('menuitem', { name: /Move to trash/ })).toContainText('restore it there')
  await expect(menu.getByText('Archive')).toHaveCount(0)
})

test('the shortcut sheet is grouped and the Notebook pointer can be dismissed for good', async ({ page }) => {
  await book(page)
  await page.keyboard.press('F1')
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.shortcut-group h3')).toHaveText(['Writing', 'Project', 'View'])
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+Alt+n')
  const note = page.locator('.notebook-moved')
  await expect(note).toContainText('Research notes now live'); await note.getByRole('button', { name: 'Got it' }).click()
  await expect(note).toHaveCount(0)
  await page.reload(); await page.keyboard.press('Control+Alt+n'); await expect(page.locator('.notebook')).toBeVisible(); await expect(page.locator('.notebook-moved')).toHaveCount(0)
})
