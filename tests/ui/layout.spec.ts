import { test, expect, type Page } from '@playwright/test'

async function start(page: Page) {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toBeVisible()
}
const row = (page: Page) => page.getByRole('toolbar', { name: 'Project actions' })

test('the app row holds only navigation and Settings; the project row holds the view toggles, the save state and the panel icons', async ({ page }) => {
  await start(page)
  const app = page.getByRole('banner')
  for (const name of ['Typewriter', 'Focus', 'Side panel']) await expect(app.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(app.getByRole('button', { name: 'Settings' })).toBeVisible()
  for (const name of ['Typewriter', 'Focus', 'Export']) await expect(row(page).getByRole('button', { name, exact: true })).toBeVisible()
  await expect(row(page).getByLabel('Writing mode')).toBeVisible()
  await expect(row(page).getByRole('button', { name: 'Library', exact: true })).toHaveAttribute('title', 'Library (Ctrl+Alt+L)')
  await expect(row(page).getByRole('button', { name: 'Side panel', exact: true })).toHaveAttribute('title', /\(Ctrl\+Alt\+P\)/)
  // The save state sits beside the status, not in the bottom row.
  await expect(row(page).locator('.save-state')).toHaveText('Saved')
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('A few words.')
  await expect(row(page).locator('.save-state')).toHaveText(/Unsaved changes|Saving…/)
  await expect(row(page).locator('.save-state')).toHaveText('Saved')
  await expect(page.locator('.editor-footer [role=status]')).toHaveCount(0)
  expect((await page.locator('.editor-footer').boundingBox())!.height).toBeLessThanOrEqual(36)
})

test('the library can be put away with its icon or Ctrl+Alt+L, keeps the text at a reading measure and is remembered', async ({ page }) => {
  await start(page)
  const library = page.getByRole('complementary', { name: 'Writing library' }), icon = row(page).getByRole('button', { name: 'Library', exact: true })
  await expect(library).toBeVisible(); await expect(icon).toHaveAttribute('aria-pressed', 'true')
  await icon.click(); await expect(library).toBeHidden(); await expect(icon).toHaveAttribute('aria-pressed', 'false')
  const paper = (await page.locator('.paper').boundingBox())!, text = (await page.locator('.markdown-editor').boundingBox())!
  expect(text.width).toBeLessThanOrEqual(760); expect(paper.width).toBeGreaterThan(text.width)
  await page.reload(); await expect(page.getByRole('textbox', { name: 'Markdown text' })).toBeVisible(); await expect(library).toBeHidden()
  await page.keyboard.press('Control+Alt+l'); await expect(library).toBeVisible()
  await page.reload(); await expect(library).toBeVisible()
})

test('the side panel icon shows and hides the dock', async ({ page }) => {
  await start(page)
  const dock = page.getByRole('complementary', { name: 'Writing companion' }), icon = row(page).getByRole('button', { name: 'Side panel', exact: true })
  await expect(dock).toBeVisible(); await expect(icon).toHaveAttribute('aria-pressed', 'true')
  await icon.click(); await expect(dock).toBeHidden(); await expect(icon).toHaveAttribute('aria-pressed', 'false')
  await icon.click(); await expect(dock).toBeVisible()
})
