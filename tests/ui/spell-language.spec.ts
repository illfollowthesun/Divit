import { test, expect } from '@playwright/test'
import { more } from './shell-helpers'

test('a language switch clears English issues while the Turkish dictionary is still loading', async ({ page }) => {
  let release!: () => void, requested!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const loading = new Promise<void>(resolve => { requested = resolve })
  await page.route('**/dictionary-tr/index.dic*', async route => {
    if (route.request().resourceType() === 'fetch') { requested(); await held }
    await route.continue()
  })
  try {
    await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
    await page.getByRole('button', { name: /New writing/ }).click()
    await page.getByRole('combobox', { name: 'LANGUAGE', exact: true }).selectOption('en')
    await more(page, 'Underlines')
    await page.getByRole('textbox', { name: 'Markdown text' }).fill('Türkçe yazıyorr. A misspelld word.')
    await expect(page.locator('.cm-misspelled', { hasText: 'Türkçe' })).toBeVisible()
    await page.keyboard.press('Control+2')
    const status = page.getByRole('complementary', { name: 'Review issues' }).getByRole('status')
    await page.getByRole('combobox', { name: 'LANGUAGE', exact: true }).selectOption('tr')
    await loading
    await expect(status).toHaveText('Checking…')
    // The dictionary has not answered: no issue from the previous language is valid.
    await expect(page.locator('.cm-misspelled')).toHaveCount(0)
    release()
    await expect(status).toHaveText(/\d+ spelling issues?/, { timeout: 15000 })
    await expect(page.locator('.cm-misspelled', { hasText: 'yazıyorr' })).toBeVisible()
    await expect(page.locator('.cm-misspelled', { hasText: 'Türkçe' })).toHaveCount(0)
  } finally { release() }
})
